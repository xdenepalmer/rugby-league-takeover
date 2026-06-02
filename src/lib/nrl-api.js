/**
 * nrl-api.js — Real NRL fixture data from RugbyAPI2 (RapidAPI)
 *
 * Endpoints:
 *   GET /api/rugby/tournament/294/season/{seasonId}/matches/next/0  → upcoming
 *   GET /api/rugby/tournament/294/season/{seasonId}/matches/last/0  → recent results
 *
 * Falls back to buildRollingNrlFixtures() if the API is unreachable.
 */

import { buildRollingNrlFixtures, NRL_CLUBS } from "./nrl-fixtures";

const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY || "";
const API_HOST = "rugbyapi2.p.rapidapi.com";
const NRL_TOURNAMENT_ID = 294;
const NRL_SEASON_2026 = 86317;

// ── Team‑name normaliser ────────────────────────────────────────────
// The API uses its own names; our app uses the NRL_CLUBS list. This map
// resolves the most common mismatches so tipping works with either source.
const TEAM_ALIAS = {
  "Manly Sea Eagles": "Manly Warringah Sea Eagles",
  "St George Illawarra Dragons": "St. George Illawarra Dragons",
  "New Zealand Warriors": "New Zealand Warriors",
};
const normaliseTeam = (apiName) => TEAM_ALIAS[apiName] || apiName;

// ── Status mapping ──────────────────────────────────────────────────
function mapStatus(apiStatus) {
  if (!apiStatus) return "upcoming";
  const t = apiStatus.type || "";
  if (t === "inprogress") return "live";
  if (t === "finished") return "finished";
  return "upcoming"; // notstarted, etc.
}

// ── Single event → fixture shape ────────────────────────────────────
function toFixture(ev) {
  const kickoff = ev.startTimestamp
    ? new Date(ev.startTimestamp * 1000).toISOString()
    : null;

  const home = normaliseTeam(ev.homeTeam?.name || "TBA");
  const away = normaliseTeam(ev.awayTeam?.name || "TBA");
  const round = ev.roundInfo?.round;

  return {
    id: `nrl-api-${ev.id}`,
    home_team: home,
    away_team: away,
    kickoff,
    label: round ? `NRL Round ${round}` : "NRL Fixture",
    venue: ev.venue?.name || "",
    is_published: true,
    generated: false,           // real data — no "Sample draw" badge
    api_source: true,
    status: mapStatus(ev.status),
    home_score: ev.homeScore?.current ?? null,
    away_score: ev.awayScore?.current ?? null,
  };
}

// ── Fetch helpers ───────────────────────────────────────────────────
async function apiFetch(path) {
  if (!RAPIDAPI_KEY) throw new Error("No RAPIDAPI_KEY configured");
  const res = await fetch(`https://${API_HOST}${path}`, {
    headers: {
      "x-rapidapi-host": API_HOST,
      "x-rapidapi-key": RAPIDAPI_KEY,
    },
  });
  if (!res.ok) throw new Error(`RugbyAPI ${res.status}`);
  return res.json();
}

/**
 * Fetch upcoming + recent NRL fixtures.
 * Returns { upcoming: Fixture[], recent: Fixture[] }
 */
export async function fetchNrlFixtures() {
  const base = `/api/rugby/tournament/${NRL_TOURNAMENT_ID}/season/${NRL_SEASON_2026}/matches`;

  const [nextRes, lastRes] = await Promise.all([
    apiFetch(`${base}/next/0`),
    apiFetch(`${base}/last/0`),
  ]);

  const upcoming = (nextRes.events || []).map(toFixture);
  const recent   = (lastRes.events || []).map(toFixture);

  return { upcoming, recent };
}

/**
 * Fetch upcoming fixtures only — primary hook for ScorePredictor.
 * Falls back to generated fixtures on any failure.
 */
export async function fetchUpcomingFixtures() {
  try {
    const { upcoming } = await fetchNrlFixtures();
    if (upcoming.length > 0) return upcoming;
  } catch (err) {
    console.warn("[nrl-api] Falling back to generated fixtures:", err.message);
  }
  // Fallback — generated fixtures with "Sample draw" badge
  return buildRollingNrlFixtures(new Date(), 5);
}

/**
 * Fetch recent results for display.
 */
export async function fetchRecentResults() {
  try {
    const { recent } = await fetchNrlFixtures();
    return recent;
  } catch {
    return [];
  }
}
