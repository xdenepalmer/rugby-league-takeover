/**
 * Pure logic for the native FAQs workflow. Mirrors the web FaqManager's
 * rules exactly — the two scopes (store vs general, with legacy no-category
 * rows counted as store), sort_order ordering, the create-draft shape and
 * the entity fields each write touches — so the native screens send
 * payload-parity writes through the same Faq entity.
 */

// Web parity: FaqManager.SCOPES. "store" drives the merch-store FAQ block;
// "general" drives the public /faq page. Legacy rows with no category are
// treated as "store" (the old default), so nothing disappears from the store.
export const FAQ_SCOPES = [
  {
    key: "store",
    label: "Store",
    title: "Store FAQs",
    description: "Shown in the merch store FAQ section — returns, shipping, sizing, anything.",
    placeholder: "Question (e.g. What's your returns policy?)",
    matches: (f) => f.category === "store" || !f.category,
  },
  {
    key: "general",
    label: "Website",
    title: "Website FAQs",
    description: "Shown on the public FAQ page (/faq) — travel, events, community, general questions.",
    placeholder: "Question (e.g. What is Rugby League Takeover?)",
    matches: (f) => f.category === "general",
  },
];

export function faqScope(key) {
  return FAQ_SCOPES.find((s) => s.key === key) || FAQ_SCOPES[0];
}

/** Only this scope's FAQs, ordered like the web manager (numeric sort_order). */
export function faqsForScope(faqs, key) {
  const scope = faqScope(key);
  return (faqs || [])
    .filter(scope.matches)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

export function faqScopeCounts(faqs) {
  return Object.fromEntries(FAQ_SCOPES.map((s) => [s.key, faqsForScope(faqs, s.key).length]));
}

/** Same draft the web manager seeds its add form with (FaqManager.emptyFaq). */
export function emptyFaqDraft(category = "store") {
  return { question: "", answer: "", category, sort_order: 1, is_published: true };
}

/** Web parity: the Add button is disabled while the question is empty. */
export function canCreateFaq(draft) {
  return !!draft?.question;
}

/**
 * Exact create payload the web manager sends: Faq.create({ ...draft, category }).
 * The scope's category always wins (the web spreads draft then overrides it),
 * sort_order is numeric (the web input coerces with Number on change) and
 * is_published follows the Switch's `!== false` semantics.
 */
export function buildFaqCreatePayload(draft, category) {
  return {
    question: draft.question,
    answer: draft.answer,
    sort_order: Number(draft.sort_order),
    is_published: draft.is_published !== false,
    category,
  };
}

/**
 * Update payload for the detail editor: only the fields the admin actually
 * changed, using the same field names/values the web manager writes per-blur
 * (question, answer, sort_order as Number, is_published as boolean). The
 * baselines mirror the web editor's defaults: question/answer render as ""
 * and sort_order as 1 when unset.
 */
export function buildFaqUpdatePayload(original, draft) {
  const data = {};
  if ((draft.question ?? "") !== (original.question ?? "")) data.question = draft.question;
  if ((draft.answer ?? "") !== (original.answer ?? "")) data.answer = draft.answer;
  const sort = Number(draft.sort_order);
  if (sort !== Number(original.sort_order ?? 1)) data.sort_order = sort;
  const published = draft.is_published !== false;
  if (published !== (original.is_published !== false)) data.is_published = published;
  return data;
}

export function hasFaqChanges(original, draft) {
  return Object.keys(buildFaqUpdatePayload(original, draft)).length > 0;
}
