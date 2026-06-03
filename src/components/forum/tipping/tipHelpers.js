import { PTS_CORRECT, PTS_MARGIN_BONUS } from "./constants";

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
  if (apiStatus === "finished") return { label: "Final", tone: "text-slate-400 border-slate-500/20 bg-slate-800/50", glow: "", color: "slate" };
  if (!kickoff) return { label: "Open", tone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10", glow: "", color: "emerald" };
  const diff = new Date(kickoff).getTime() - Date.now();
  if (diff < 0) return { label: "Locked", tone: "text-slate-400 border-slate-500/20 bg-slate-800/50", glow: "", color: "slate" };
  if (diff < 3600000) return { label: "Closing", tone: "text-red-300 border-red-500/30 bg-red-500/10", glow: "shadow-[0_0_12px_rgba(239,68,68,0.15)]", color: "red" };
  if (diff < 86400000) return { label: "Hot", tone: "text-amber-300 border-amber-500/30 bg-amber-500/10", glow: "", color: "amber" };
  return { label: "Open", tone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10", glow: "", color: "emerald" };
}

export function checkTipResult(game, tip) {
  if (!game || !tip || game.status !== "finished" || game.home_score == null) return null;
  const actualWinner = game.home_score > game.away_score ? game.home_team
    : game.away_score > game.home_score ? game.away_team : "draw";
  const tippedCorrect = tip.selected_team === actualWinner;
  const actualMargin = Math.abs(game.home_score - game.away_score);
  const marginDiff = Math.abs((tip.margin || 0) - actualMargin);
  const perfectMargin = marginDiff === 0;
  const points = tippedCorrect ? PTS_CORRECT + (perfectMargin ? PTS_MARGIN_BONUS : 0) : 0;
  return { correct: tippedCorrect, perfectMargin, marginDiff, actualMargin, points };
}
