// Pure display helpers for the fan leaderboard. Kept dependency-free so it is
// unit-testable under `node --test`. The server `leaderboard` function inlines
// its own copy of safeDisplayName (Base44 forbids cross-function imports) —
// keep the two in sync.

export const LEADERBOARD_SCOPES = [
  { key: "weekly", label: "This Week" },
  { key: "alltime", label: "All-Time" },
  { key: "team", label: "My Team" },
];

const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };
export function medalFor(rank) {
  return MEDALS[rank] || null;
}

// Privacy-safe public display name: first name + last initial, never the email.
// Mirrors the projection used server-side. Falls back to the email handle, then
// a generic label, so the leaderboard never renders a blank row.
export function safeDisplayName(fullName, email) {
  const name = String(fullName || "").trim().replace(/\s+/g, " ");
  if (name) {
    const parts = name.split(" ");
    if (parts.length === 1) return parts[0];
    const last = parts[parts.length - 1];
    return `${parts[0]} ${last.charAt(0).toUpperCase()}.`;
  }
  const handle = String(email || "").split("@")[0].trim();
  return handle || "Fan";
}

// The metric a given scope ranks by (used for the row's headline number).
export function scoreFor(entry, scope) {
  if (scope === "weekly") return Number(entry?.weekly_xp || 0);
  return Number(entry?.xp || 0);
}
