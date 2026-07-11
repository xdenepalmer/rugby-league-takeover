/**
 * Pure logic for the native Partners workflow. Mirrors the web
 * PartnersManager's rules exactly — the six-field Partner shape, numeric
 * sort_order ordering, the create-draft seed, the name-required Add gate and
 * the entity fields each write touches — so the native screens send
 * payload-parity writes through the same Partner entity.
 */

/** Same draft the web manager seeds its add form with (PartnersManager.emptyPartner). */
export function emptyPartnerDraft() {
  return { name: "", logo_url: "", url: "", description: "", sort_order: 1, is_published: true };
}

/** Web parity: the Add button is disabled while the name is empty. */
export function canCreatePartner(draft) {
  return !!draft?.name;
}

/** Web ordering: numeric sort_order, missing → 0 (PartnersManager.sorted). */
export function sortPartners(partners) {
  return [...(partners || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

/**
 * Exact create payload the web manager sends: Partner.create(draft) — the six
 * emptyPartner fields, sort_order numeric (the web input coerces with Number
 * on change) and is_published following the Switch's `!== false` semantics.
 */
export function buildPartnerCreatePayload(draft) {
  return {
    name: draft.name,
    logo_url: draft.logo_url,
    url: draft.url,
    description: draft.description,
    sort_order: Number(draft.sort_order),
    is_published: draft.is_published !== false,
  };
}

/**
 * Update payload for the detail editor: only the fields the admin actually
 * changed, using the same field names/values the web manager writes per-blur
 * (name, url, description, logo_url as strings; sort_order as Number;
 * is_published as boolean). The baselines mirror the web editor's render
 * defaults: text fields as "" and sort_order as 1 when unset.
 */
export function buildPartnerUpdatePayload(original, draft) {
  const data = {};
  if ((draft.name ?? "") !== (original.name ?? "")) data.name = draft.name;
  if ((draft.url ?? "") !== (original.url ?? "")) data.url = draft.url;
  if ((draft.description ?? "") !== (original.description ?? "")) data.description = draft.description;
  if ((draft.logo_url ?? "") !== (original.logo_url ?? "")) data.logo_url = draft.logo_url;
  const sort = Number(draft.sort_order);
  if (sort !== Number(original.sort_order ?? 1)) data.sort_order = sort;
  const published = draft.is_published !== false;
  if (published !== (original.is_published !== false)) data.is_published = published;
  return data;
}

export function hasPartnerChanges(original, draft) {
  return Object.keys(buildPartnerUpdatePayload(original, draft)).length > 0;
}
