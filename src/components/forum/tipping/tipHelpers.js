// Explicit extension so plain Node (the test runner) can resolve it too.
import { PTS_CORRECT, PTS_MARGIN_BONUS } from "./constants.js";

// ── Tip validation ──────────────────────────────────────────────────
export function isValidTip(tip) {
  return tip && typeof tip === 'object'
    && typeof tip.selected_team === 'string' && tip.selected_team.length > 0
    && typeof tip.margin === 'number' && tip.margin >= 1 && tip.margin <= 60
    && typeof tip.tipped_at === 'string';
}

export function sanitizeTips(tips) {
  if (!tips || typeof tips !== 'object') return {};
  const clean = {};
  Object.entries(tips).forEach(([id, tip]) => {
    if (isValidTip(tip)) clean[id] = tip;
  });
  return clean;
}

export const shortName = (name) => String(name || "").split(" ").pop();

// ── Game Logic ────────────────────────────────────────────────
// Admin matchups go final as 'final' (the DB CHECK only allows
// scheduled|final); API fixtures finish as 'finished'. Every consumer must
// treat the two identically — keying off 'finished' alone hid the result
// (and the points) for every admin-managed game.
export function isFinishedGame(game) {
  return !!game
    && (game.status === "finished" || game.status === "final")
    && game.home_score != null && game.away_score != null;
}

export function hasKickedOff(game, now = Date.now()) {
  if (isFinishedGame(game)) return true;
  if (game?.status === "live") return true;
  if (!game?.kickoff) return false;
  const t = new Date(game.kickoff).getTime();
  return Number.isFinite(t) && t <= now;
}

// A game is open for tipping (and for EDITING an existing tip — the lock is
// kickoff, not first submission, same as every real tipping comp).
export function isTippable(game, now = Date.now()) {
  return !!game && !hasKickedOff(game, now);
}

export function deriveScores(game, selectedTeam, margin) {
  const seed = String(game.id || game.home_team).split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const loser = 10 + (seed % 18);
  const winner = loser + Number(margin || 1);
  return selectedTeam === game.home_team
    ? { home: winner, away: loser }
    : { home: loser, away: winner };
}

export function getStatus(kickoff, apiStatus) {
  if (apiStatus === "live") return { label: "Live", tone: "text-red-300 border-red-500/40 bg-red-500/15", glow: "shadow-[0_0_20px_rgba(239,68,68,0.2)]", color: "red" };
  if (apiStatus === "finished" || apiStatus === "final") return { label: "Final", tone: "text-slate-400 border-slate-500/20 bg-slate-800/50", glow: "", color: "slate" };
  if (!kickoff) return { label: "Open", tone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10", glow: "", color: "emerald" };
  const diff = new Date(kickoff).getTime() - Date.now();
  if (diff < 0) return { label: "Locked", tone: "text-slate-400 border-slate-500/20 bg-slate-800/50", glow: "", color: "slate" };
  if (diff < 3600000) return { label: "Closing", tone: "text-red-300 border-red-500/30 bg-red-500/10", glow: "shadow-[0_0_12px_rgba(239,68,68,0.15)]", color: "red" };
  if (diff < 86400000) return { label: "Hot", tone: "text-amber-300 border-amber-500/30 bg-amber-500/10", glow: "", color: "amber" };
  return { label: "Open", tone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10", glow: "", color: "emerald" };
}

export function checkTipResult(game, tip) {
  if (!tip || !isFinishedGame(game)) return null;
  const actualWinner = game.home_score > game.away_score ? game.home_team
    : game.away_score > game.home_score ? game.away_team : "draw";
  const tippedCorrect = tip.selected_team === actualWinner;
  const actualMargin = Math.abs(game.home_score - game.away_score);
  const marginDiff = Math.abs((tip.margin || 0) - actualMargin);
  const perfectMargin = marginDiff === 0;
  const points = tippedCorrect ? PTS_CORRECT + (perfectMargin ? PTS_MARGIN_BONUS : 0) : 0;
  return { correct: tippedCorrect, perfectMargin, marginDiff, actualMargin, points };
}

// ── Kickoff display ─────────────────────────────────────────────────
// Tipping shows kickoff in the FAN'S timezone (like every tipping platform);
// the Vegas-time formatter stays for event-themed surfaces.
export function formatKickoffLocal(value) {
  if (!value) return "TBA";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d.toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Rounds ──────────────────────────────────────────────────────────
// Real tipping platforms are organised by ROUND — one round on screen, a
// selector to page between them, a deadline on the round. Rounds are built
// from fixture labels ("NRL Round 23"), ordered by earliest kickoff.
export function shortRoundLabel(label) {
  const m = /round\s*(\d+)/i.exec(String(label || ""));
  if (m) return `RD ${m[1]}`;
  const raw = String(label || "Fixtures").trim();
  return raw.length > 10 ? `${raw.slice(0, 9)}…` : raw;
}

// A fixture with no (or an unparseable) kickoff must sort LAST, not first:
// treating it as epoch 0 put every TBA game ahead of the whole season and
// handed the default landing round to a fixture nobody can tip yet.
export const kickoffMs = (g) => {
  const t = new Date(g?.kickoff || 0).getTime();
  return g?.kickoff && Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
};

export function buildRounds(fixtures, now = Date.now()) {
  const byLabel = new Map();
  (fixtures || []).forEach((g) => {
    const label = g.label || "NRL Fixture";
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push(g);
  });
  const rounds = Array.from(byLabel.entries()).map(([label, games]) => {
    games.sort((a, b) => kickoffMs(a) - kickoffMs(b));
    const finished = games.filter((g) => isFinishedGame(g)).length;
    const live = games.some((g) => g.status === "live");
    const open = games.filter((g) => isTippable(g, now));
    // Round deadline = the next kickoff still open for tips (TBA games have
    // no deadline to show).
    const deadline = open.reduce((min, g) => {
      const t = kickoffMs(g);
      return Number.isFinite(t) && t > now && (min === 0 || t < min) ? t : min;
    }, 0);
    const state = live ? "live"
      : finished === games.length && games.length > 0 ? "done"
      : open.length === 0 ? "locked"
      : "open";
    const first = games.length ? kickoffMs(games[0]) : Number.POSITIVE_INFINITY;
    return {
      label,
      games,
      state,
      finishedCount: finished,
      deadline: deadline || null,
      firstKickoff: first,
    };
  });
  rounds.sort((a, b) => a.firstKickoff - b.firstKickoff);
  return rounds;
}

// ── Fixture identity ────────────────────────────────────────────────
// The same real match can arrive twice: once from the external API
// (`nrl-api-123`) and once as an admin matchup (a uuid). Dedup used a raw
// date-string slice, which broke on timezone-boundary kickoffs and on TBA
// admin games — so one match could render twice and be tipped (and scored)
// twice. Match on normalised team names plus a kickoff WINDOW instead.
const DEDUPE_WINDOW_MS = 36 * 60 * 60 * 1000;

const normaliseTeamName = (name) =>
  String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const fixturePairKey = (game) =>
  `${normaliseTeamName(game?.home_team)}|${normaliseTeamName(game?.away_team)}`;

export function isSameFixture(a, b) {
  if (fixturePairKey(a) !== fixturePairKey(b)) return false;
  const ta = kickoffMs(a);
  const tb = kickoffMs(b);
  // One side TBA: same teams is enough — the season has one such meeting.
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return true;
  return Math.abs(ta - tb) <= DEDUPE_WINDOW_MS;
}

// Merge admin matchups with API fixtures, admin winning. Returns the merged
// list plus the id remapping (apiId -> adminId) so local tips saved against
// the API id can follow the game that survived.
export function mergeFixtures(adminGames, apiGames) {
  const merged = [...(adminGames || [])];
  const idMap = {};
  (apiGames || []).forEach((apiGame) => {
    const match = merged.find((admin) => isSameFixture(admin, apiGame));
    if (match) {
      if (apiGame.id && match.id && apiGame.id !== match.id) idMap[apiGame.id] = match.id;
      return;
    }
    merged.push(apiGame);
  });
  merged.sort((a, b) => kickoffMs(a) - kickoffMs(b));
  return { fixtures: merged, idMap };
}

// Move tips saved under a superseded fixture id onto the surviving one.
// Without this, an admin publishing a matchup for a game the fan already
// tipped made the tip vanish — from My Tips, from the season score, and from
// the card, which then invited a duplicate tip on the same real match.
export function remapTipIds(tips, idMap) {
  const entries = Object.entries(idMap || {}).filter(([from, to]) => tips?.[from] && !tips[to]);
  if (!entries.length) return { tips, changed: false };
  const next = { ...tips };
  entries.forEach(([from, to]) => {
    next[to] = { ...next[from], game_id: to };
    delete next[from];
  });
  return { tips: next, changed: true };
}

// Land the fan on the round that needs them: the first round still taking
// tips (or live), else the most recent one.
export function defaultRoundIndex(rounds) {
  if (!rounds?.length) return 0;
  const active = rounds.findIndex((r) => r.state === "open" || r.state === "live");
  return active >= 0 ? active : rounds.length - 1;
}

// ── Streaks ─────────────────────────────────────────────────────────
// results: [{ kickoff, correct }] in ANY order. Current streak counts
// consecutive wins backwards from the most recent settled result; best is the
// longest run anywhere in the season.
export function computeStreaks(results) {
  const ordered = (results || [])
    .filter((r) => r && typeof r.correct === "boolean")
    .sort((a, b) => new Date(a.kickoff || 0) - new Date(b.kickoff || 0));
  let best = 0;
  let run = 0;
  ordered.forEach((r) => {
    run = r.correct ? run + 1 : 0;
    if (run > best) best = run;
  });
  let current = 0;
  for (let i = ordered.length - 1; i >= 0 && ordered[i].correct; i -= 1) current += 1;
  return { current, best };
}

// ── Community favourite ─────────────────────────────────────────────
export function communityFavourite(game, entries) {
  const relevant = (entries || []).filter((e) => e.game_id === game.id);
  const home = relevant.filter((e) => e.selected_team === game.home_team).length;
  const away = relevant.filter((e) => e.selected_team === game.away_team).length;
  if (home === 0 && away === 0) return null;
  if (home === away) return null;
  return home > away ? game.home_team : game.away_team;
}
