/**
 * Pure logic for the native Teams workflow. Mirrors the web TeamsManager's
 * rules exactly — name normalisation, bulk-import parsing, roster/custom
 * detection and the Team entity payloads — so the native screens write
 * payload-parity creates/updates through the same entity.
 *
 * Relative import (not the @ alias) so node:test can load this module
 * without the Vite resolver, same as workflow-helpers.js stays node-clean.
 */
import { ALL_TEAMS } from "../../../lib/nrl-teams.js";

/** Same normaliser the web TeamsManager uses for every name comparison. */
export const normTeamName = (s) => String(s || "").trim().toLowerCase();

/**
 * Web parity (TeamsManager.parseBulk): one club per line as
 * `Name = url` (also accepts `|`, comma or tab as the separator); only rows
 * whose URL is http(s) survive.
 */
export function parseBulkLogos(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)[\s]*(?:=|\||\t|,)[\s]*(\S+)\s*$/);
      if (!m) return null;
      return { name: m[1].trim(), url: m[2].trim() };
    })
    .filter((r) => r && r.name && /^https?:\/\//i.test(r.url));
}

/** DB teams that aren't part of the built-in NRL/Super League roster. */
export function rosterCustomTeams(teams) {
  const rosterNames = new Set(ALL_TEAMS.map((t) => normTeamName(t.name)));
  return (teams || []).filter((t) => !rosterNames.has(normTeamName(t.name)));
}

/**
 * Attach the known club (built-in roster + custom DB teams) to each parsed
 * bulk row — unmatched rows keep team === undefined and are skipped, exactly
 * like the web manager's bulkMatched filter.
 */
export function matchBulkRows(rows, teams) {
  const known = new Map(
    [...ALL_TEAMS, ...rosterCustomTeams(teams)].map((t) => [normTeamName(t.name), t])
  );
  return (rows || []).map((r) => ({ ...r, team: known.get(normTeamName(r.name)) }));
}

/** League groups shown as filter chips (web shows the same three groupings). */
export const TEAM_GROUPS = [
  { key: "all", label: "All" },
  { key: "nrl", label: "NRL" },
  { key: "super", label: "Super League" },
  { key: "custom", label: "Custom" },
];

/**
 * Full display roster: every built-in club (always available, exactly like
 * the web's grouped tiles) plus custom DB teams, each carrying its DB record
 * (for logo + delete) and a custom flag (only custom teams are deletable).
 */
export function teamRoster(teams) {
  const byName = new Map((teams || []).map((t) => [normTeamName(t.name), t]));
  const builtIn = ALL_TEAMS.map((t) => ({
    ...t,
    custom: false,
    db: byName.get(normTeamName(t.name)) || null,
  }));
  const custom = rosterCustomTeams(teams).map((t) => ({
    name: t.name,
    short_name: t.short_name || t.name,
    league: "Custom",
    custom: true,
    db: t,
  }));
  return [...builtIn, ...custom];
}

export function filterTeamRoster(roster, { query = "", group = "all" } = {}) {
  const q = query.trim().toLowerCase();
  return (roster || []).filter((t) => {
    if (group === "nrl" && t.league !== "NRL") return false;
    if (group === "super" && t.league !== "Super League") return false;
    if (group === "custom" && !t.custom) return false;
    if (!q) return true;
    return `${t.name} ${t.short_name || ""}`.toLowerCase().includes(q);
  });
}

/**
 * The exact write the web setLogo/applyBulk mutations perform: update the
 * existing Team's logo_url, or create the club with the web's exact field
 * set (name, short_name fallback, is_active: true, sort_order: 1).
 */
export function buildLogoWrite(existing, team, logo_url) {
  if (existing) return { op: "update", id: existing.id, data: { logo_url } };
  return {
    op: "create",
    data: {
      name: team.name,
      short_name: team.short_name || team.name,
      logo_url,
      is_active: true,
      sort_order: 1,
    },
  };
}

/** Exact Team.create payload the web addCustom mutation writes. */
export function buildCustomTeamPayload(name) {
  return { name, short_name: name, logo_url: "", is_active: true, sort_order: 1 };
}
