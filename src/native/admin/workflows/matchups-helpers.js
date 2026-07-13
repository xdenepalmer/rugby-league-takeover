/**
 * Pure logic for the native Matchups workflow. Mirrors the web
 * MatchupsManager's rules — the empty draft shape, the score coercion the
 * web applies to every write, logo snapshot resolution, sort order — so the
 * native screens write payload-parity creates/updates through the same
 * Matchup entity. No React, no side effects: node:test covers this file.
 */

/** Web parity: MatchupsManager.emptyMatchup, field for field. */
export const EMPTY_MATCHUP = {
  home_team: "",
  home_logo: "",
  away_team: "",
  away_logo: "",
  kickoff: "",
  label: "",
  venue: "",
  ticket_url: "",
  sort_order: 1,
  is_published: true,
  status: "scheduled",
  home_score: null,
  away_score: null,
  result_note: "",
};

/**
 * Web parity: MatchupsManager.cleanPayload. Coerce score fields — base44
 * rejects empty strings for numeric columns, so "" / undefined become null
 * and anything else is numeric (falling back to 0, like the web).
 */
export function cleanMatchupPayload(data) {
  const out = { ...data };
  if (out.home_score === "" || out.home_score === undefined) out.home_score = null;
  else out.home_score = Number(out.home_score) || 0;
  if (out.away_score === "" || out.away_score === undefined) out.away_score = null;
  else out.away_score = Number(out.away_score) || 0;
  return out;
}

/** Web parity: MatchupsManager.norm — name matching for logo lookup. */
export function normTeamName(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Club-name → uploaded crest URL index (web parity: logoByName). The web
 * snapshot-copies the Team entity's logo_url onto the matchup at pick time
 * so the fixture keeps rendering even if the club record changes later.
 */
export function buildLogoIndex(teams) {
  return new Map((teams || []).map((t) => [normTeamName(t.name), t.logo_url || ""]));
}

export function logoForTeam(logoIndex, name) {
  return logoIndex.get(normTeamName(name)) || "";
}

/** Web parity: list ordering — ascending numeric sort_order. */
export function sortMatchups(matchups) {
  return [...(matchups || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

/** Web parity: add/save buttons disable until both clubs are picked. */
export function canSaveMatchup(draft) {
  return Boolean(draft?.home_team && draft?.away_team);
}

/** Web parity: MatchupsManager.startEdit seeds the edit draft over the empty shape. */
export function matchupEditSeed(matchup) {
  return { ...EMPTY_MATCHUP, ...(matchup || {}) };
}

/**
 * Update payload for a full save (web parity: saveEdit strips only `id`,
 * then the mutation runs cleanPayload over the rest).
 */
export function buildMatchupSavePayload(draft) {
  const { id: _id, ...data } = draft || {};
  return cleanMatchupPayload(data);
}

/**
 * Quick publish/unpublish toggle. The web row toggle sends
 * `{ is_published }` through cleanPayload, which turns the ABSENT score
 * fields into `home_score: null, away_score: null` — silently wiping a
 * final game's recorded score. Native sends the SAME three fields the web
 * write produces, but carries the record's current scores instead of
 * clobbering them with null. Same entity, same field names — corrected
 * values only.
 */
export function buildPublishTogglePayload(matchup, isPublished) {
  return cleanMatchupPayload({
    is_published: isPublished,
    home_score: matchup?.home_score,
    away_score: matchup?.away_score,
  });
}

/** Centre column of a fixture row: score line when final, "VS" otherwise. */
export function matchupScoreline(matchup) {
  if (matchup?.status === "final") {
    return `${matchup.home_score ?? "-"} - ${matchup.away_score ?? "-"}`;
  }
  return "VS";
}

/**
 * Native-only additive search over the fixture list. The web MatchupsManager
 * has no search box (it renders every fixture inline), so this NEVER changes
 * what is written — it only narrows what the native list displays. Matches the
 * fields a person would scan for: either club, the label, the venue, or a
 * final-result note.
 */
export function filterMatchups(matchups, query = "") {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return matchups || [];
  return (matchups || []).filter((m) =>
    `${m?.home_team || ""} ${m?.away_team || ""} ${m?.label || ""} ${m?.venue || ""} ${m?.result_note || ""}`
      .toLowerCase()
      .includes(q)
  );
}

/**
 * League-grouped roster for the native team picker (web parity: TeamSelect
 * renders an NRL group then a British Super League group from ALL_TEAMS).
 */
export function groupTeamsByLeague(allTeams) {
  const groups = [
    { league: "NRL", label: "NRL", teams: [] },
    { league: "Super League", label: "British Super League", teams: [] },
  ];
  for (const team of allTeams || []) {
    const group = groups.find((g) => g.league === team.league);
    if (group) group.teams.push(team);
  }
  return groups;
}
