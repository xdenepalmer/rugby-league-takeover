/**
 * Pure logic for the native Testimonials workflow. Mirrors the web
 * TestimonialsManager's rules exactly — the publish-queue semantics
 * (visitor submissions arrive is_published:false and float above the
 * published rows), pending-first + sort_order ordering, the create-draft
 * seed, the approve write and the entity fields each write touches — so
 * the native screens send payload-parity writes through the same
 * Testimonial entity.
 */

// Web parity: TestimonialsManager.emptyTestimonial — the add-form seed.
export function emptyTestimonialDraft() {
  return {
    author_name: "",
    author_role: "",
    quote: "",
    avatar_url: "",
    rating: 5,
    sort_order: 1,
    is_published: true,
  };
}

// Web parity: TestimonialsManager.ratingOptions (0 hides the stars).
export const RATING_OPTIONS = [0, 1, 2, 3, 4, 5];

export function ratingLabel(rating) {
  const r = Number(rating ?? 0);
  return r === 0 ? "No stars" : `${r} ★`;
}

/** Web parity: a testimonial is pending review when is_published === false. */
export function isPendingTestimonial(t) {
  return t?.is_published === false;
}

/**
 * Web parity: the manager's single list order — pending (visitor
 * submissions awaiting approval) float to the top; the rest by numeric
 * sort_order.
 */
export function sortTestimonials(testimonials) {
  return [...(testimonials || [])].sort((a, b) => {
    const ap = isPendingTestimonial(a) ? 0 : 1;
    const bp = isPendingTestimonial(b) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return Number(a.sort_order || 0) - Number(b.sort_order || 0);
  });
}

/** Web parity: the "N pending" badge count in the section header. */
export function pendingTestimonialCount(testimonials) {
  return (testimonials || []).filter(isPendingTestimonial).length;
}

/**
 * Native queue chips over the SAME web rule (is_published === false).
 * The web shows one combined list with pending floated first; native keeps
 * that as "All" and adds Pending/Live cuts of the identical predicate —
 * a read-side filter only, never a new write rule.
 */
export const TESTIMONIAL_QUEUES = [
  { key: "pending", label: "Pending" },
  { key: "live", label: "Live" },
  { key: "all", label: "All" },
];

export function testimonialQueue(testimonials, queue) {
  const list = sortTestimonials(testimonials);
  switch (queue) {
    case "pending":
      return list.filter(isPendingTestimonial);
    case "live":
      return list.filter((t) => !isPendingTestimonial(t));
    default:
      return list;
  }
}

export function testimonialQueueCounts(testimonials) {
  return Object.fromEntries(
    TESTIMONIAL_QUEUES.map((q) => [q.key, testimonialQueue(testimonials, q.key).length])
  );
}

/** Web parity: the Add button is disabled without a name AND a quote. */
export function canCreateTestimonial(draft) {
  return !!draft?.author_name && !!draft?.quote;
}

/**
 * Exact create payload the web manager sends: Testimonial.create(draft)
 * with the seven emptyTestimonial fields. rating comes off a Number()-coerced
 * select and sort_order off a Number()-coerced input on the web, and
 * is_published follows the Switch's `!== false` semantics.
 */
export function buildTestimonialCreatePayload(draft) {
  return {
    author_name: draft.author_name,
    author_role: draft.author_role,
    quote: draft.quote,
    avatar_url: draft.avatar_url,
    rating: Number(draft.rating ?? 0),
    sort_order: Number(draft.sort_order),
    is_published: draft.is_published !== false,
  };
}

/**
 * Update payload for the detail editor: only the fields the admin actually
 * changed, using the same field names/values the web manager writes per
 * control (author_name, author_role, quote, avatar_url as strings;
 * rating/sort_order as Number; is_published as boolean). Baselines mirror
 * the web editor's render defaults: text fields as "", sort_order as 1,
 * rating as 0, published as `!== false`.
 */
export function buildTestimonialUpdatePayload(original, draft) {
  const data = {};
  if ((draft.author_name ?? "") !== (original.author_name ?? "")) data.author_name = draft.author_name;
  if ((draft.author_role ?? "") !== (original.author_role ?? "")) data.author_role = draft.author_role;
  if ((draft.quote ?? "") !== (original.quote ?? "")) data.quote = draft.quote;
  if ((draft.avatar_url ?? "") !== (original.avatar_url ?? "")) data.avatar_url = draft.avatar_url;
  const rating = Number(draft.rating ?? 0);
  if (rating !== Number(original.rating ?? 0)) data.rating = rating;
  const sort = Number(draft.sort_order);
  if (sort !== Number(original.sort_order ?? 1)) data.sort_order = sort;
  const published = draft.is_published !== false;
  if (published !== (original.is_published !== false)) data.is_published = published;
  return data;
}

export function hasTestimonialChanges(original, draft) {
  return Object.keys(buildTestimonialUpdatePayload(original, draft)).length > 0;
}

/** Web parity: the Approve button writes exactly { is_published: true }. */
export function buildApproveTestimonialPayload() {
  return { is_published: true };
}
