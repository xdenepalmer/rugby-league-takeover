// Dependency-free date normalisation for forum timestamps.
//
// The backend returns created_date in UTC, sometimes without a timezone
// marker. A bare ISO string is parsed as LOCAL time by JS, which shows a
// just-posted item as "10h ago" in AEST (and, before this was centralised,
// silently disabled unread-reply tracking for the entire Australian
// audience). Lives outside the component tree so node:test can import it —
// and the modules that depend on it — without JSX or path-alias tooling.
export function parseForumDate(dateStr) {
  if (!dateStr) return null;
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(String(dateStr).trim());
  const normalized = hasTz ? dateStr : `${String(dateStr).trim().replace(" ", "T")}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? new Date(dateStr) : d;
}
