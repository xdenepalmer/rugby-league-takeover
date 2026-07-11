/**
 * Pure logic for the native Events workflow. Mirrors the web EventsManager's
 * rules exactly — the emptyEvent/emptyTicket create drafts field for field,
 * the sort_order ordering, the published-unless-explicitly-false rule and the
 * ticket-tier list operations — so native saves are payload-parity with the
 * web panel.
 *
 * No admin-log events: the web EventsManager dispatches no rlt_admin_log
 * events, so this module deliberately emits none either (audit parity is
 * "same events", including zero). It also calls no edge functions.
 */

/** Web parity: EventsManager's `emptyEvent` create draft, field for field. */
export function emptyEvent() {
  return {
    title: "",
    event_date: "",
    start_time: "",
    location: "",
    address: "",
    blurb: "",
    ticket_url: "",
    tickets: [],
    photo_urls: [],
    is_coming_soon: true,
    is_published: true,
    sort_order: 1,
  };
}

/**
 * Web parity: EventsManager's `emptyTicket`. `note` is part of the stored
 * shape even though neither surface renders an input for it — new tiers must
 * carry the identical field set the web writes.
 */
export function emptyTicket() {
  return { name: "", price_aud: 0, url: "", note: "", sold_out: false };
}

/** Web rule: an event counts as published unless is_published is exactly false. */
export function isEventPublished(event) {
  return event?.is_published !== false;
}

/** Web rule: the Coming-soon switch reads is_coming_soon !== false. */
export function isEventComingSoon(event) {
  return event?.is_coming_soon !== false;
}

/** Web parity: the create button is disabled until a title exists. */
export function canCreateEvent(draft) {
  return Boolean(draft?.title);
}

/** Same ordering the web manager renders: Number(sort_order || 0) ascending. */
export function sortEvents(events) {
  return [...(events || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

/** Header stats the web manager surfaces: total + published counts. */
export function eventCounts(events) {
  const list = events || [];
  return { total: list.length, published: list.filter((e) => isEventPublished(e)).length };
}

// ── Ticket-tier list operations (web TicketsEditor semantics) ────────────
export function updateTicket(tickets, index, patch) {
  return (tickets || []).map((t, i) => (i === index ? { ...t, ...patch } : t));
}

export function addTicket(tickets) {
  return [...(tickets || []), emptyTicket()];
}

export function removeTicket(tickets, index) {
  return (tickets || []).filter((_, i) => i !== index);
}

// ── Photo list operations (web PhotoUploader/PhotoGrid semantics) ────────
export function addPhoto(photoUrls, url) {
  return [...(photoUrls || []), url];
}

export function removePhoto(photoUrls, url) {
  return (photoUrls || []).filter((u) => u !== url);
}
