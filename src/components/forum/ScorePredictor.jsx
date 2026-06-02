import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Users, Share2, TrendingUp, Calendar, Flame, Sparkles, Shield,
  Target, CheckCircle2, ChevronRight, ChevronLeft, Zap, Crown, Info,
  Radio, Clock, MapPin, Star, ArrowRight, Award, BarChart3, XCircle,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { formatKickoff, isNearFixture } from "@/lib/nrl-fixtures";
import { fetchUpcomingFixtures } from "@/lib/nrl-api";
import TeamCrest from "@/components/public/TeamCrest";

// ── Constants ───────────────────────────────────────────────────────
const STORAGE_KEY = "rlt_footy_tips_v2";
const PROFILE_KEY = "rlt_footy_tipster_profile";
const ACCURACY_KEY = "rlt_footy_accuracy";

const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
};
const writeJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
};

const initials = (name) => String(name || "NRL").split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
const shortName = (name) => String(name || "").split(" ").pop();

// ── Game Logic ──────────────────────────────────────────────────────
function deriveScores(game, selectedTeam, margin) {
  const seed = String(game.id || game.home_team).split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const loser = 10 + (seed % 18);
  const winner = loser + Number(margin || 1);
  return selectedTeam === game.home_team
    ? { home: winner, away: loser }
    : { home: loser, away: winner };
}

function getStatus(kickoff, apiStatus) {
  if (apiStatus === "live") return { label: "Live", tone: "text-red-300 border-red-500/40 bg-red-500/15", glow: "shadow-[0_0_20px_rgba(239,68,68,0.2)]" };
  if (apiStatus === "finished") return { label: "Final", tone: "text-slate-400 border-slate-500/20 bg-slate-800/50", glow: "" };
  if (!kickoff) return { label: "Open", tone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10", glow: "" };
  const diff = new Date(kickoff).getTime() - Date.now();
  if (diff < 0) return { label: "Locked", tone: "text-slate-400 border-slate-500/20 bg-slate-800/50", glow: "" };
  if (diff < 3600000) return { label: "Closing", tone: "text-red-300 border-red-500/30 bg-red-500/10", glow: "shadow-[0_0_12px_rgba(239,68,68,0.1)]" };
  if (diff < 86400000) return { label: "Hot", tone: "text-amber-300 border-amber-500/30 bg-amber-500/10", glow: "" };
  return { label: "Open", tone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10", glow: "" };
}

// Check if user's tip was correct for a finished game
function checkTipResult(game, tip) {
  if (!game || !tip || game.status !== "finished" || game.home_score == null) return null;
  const actualWinner = game.home_score > game.away_score ? game.home_team
    : game.away_score > game.home_score ? game.away_team : "draw";
  const tippedCorrect = tip.selected_team === actualWinner;
  const actualMargin = Math.abs(game.home_score - game.away_score);
  const marginDiff = Math.abs((tip.margin || 0) - actualMargin);
  const perfectMargin = marginDiff === 0;
  return { correct: tippedCorrect, perfectMargin, marginDiff, actualMargin };
}

// ── Countdown Hook ──────────────────────────────────────────────────
function useCountdown(kickoff) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!kickoff) return;
    const diff = new Date(kickoff).getTime() - Date.now();
    if (diff <= 0 || diff > 86400000) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [kickoff]);

  if (!kickoff) return null;
  const diff = new Date(kickoff).getTime() - now;
  if (diff <= 0) return null;
  if (diff > 86400000) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

// ── Confetti burst on tip lock ──────────────────────────────────────
function ConfettiBurst({ active }) {
  if (!active) return null;
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 200,
    y: -(Math.random() * 120 + 40),
    r: Math.random() * 360,
    color: ["#00ff88", "#ff6b35", "#00d4ff", "#ffd700", "#ff3366"][i % 5],
    size: 4 + Math.random() * 4,
  }));
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: "50%", y: "80%", opacity: 1, scale: 1, rotate: 0 }}
          animate={{ x: `calc(50% + ${p.x}px)`, y: `calc(80% + ${p.y}px)`, opacity: 0, scale: 0.5, rotate: p.r }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ position: "absolute", width: p.size, height: p.size, backgroundColor: p.color, borderRadius: 1 }}
        />
      ))}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function HeroStats({ tips, fixtures }) {
  const tipped = fixtures.filter((g) => tips[g.id]).length;
  const total = fixtures.length || 1;
  const percent = Math.round((tipped / total) * 100);
  const accuracy = useMemo(() => {
    const results = readJson(ACCURACY_KEY, { correct: 0, total: 0 });
    // Also compute from current session
    let correct = results.correct, checked = results.total;
    fixtures.forEach((g) => {
      const tip = tips[g.id];
      const result = checkTipResult(g, tip);
      if (result) {
        checked++;
        if (result.correct) correct++;
      }
    });
    return checked > 0 ? Math.round((correct / checked) * 100) : null;
  }, [fixtures, tips]);

  const streak = Number(readJson(PROFILE_KEY, { streak: 0 }).streak || 0);
  const rank = tipped >= 8 ? "🏆 Immortal" : tipped >= 5 ? "🎯 Sharpshooter" : tipped >= 2 ? "📊 Analyst" : "🆕 Rookie";

  return (
    <div className="grid grid-cols-4 gap-px overflow-hidden border border-border/40 bg-border/20">
      {[
        { label: "Rank", value: rank, sub: `${tipped} tipped` },
        { label: "Accuracy", value: accuracy != null ? `${accuracy}%` : "—", sub: "vs results" },
        { label: "Round", value: `${percent}%`, sub: `${tipped}/${total}` },
        { label: "Streak", value: `${streak || tipped}🔥`, sub: "games" },
      ].map((stat) => (
        <div key={stat.label} className="bg-black/40 p-2 text-center">
          <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
          <p className="mt-0.5 truncate text-[11px] font-bold text-foreground">{stat.value}</p>
          <p className="text-[7px] text-slate-500">{stat.sub}</p>
        </div>
      ))}
    </div>
  );
}

function RoundBadge({ label }) {
  if (!label) return null;
  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-primary/60">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </div>
  );
}

function FixtureCard({ game, tip, onTip, entries, active, onSelect }) {
  const [selectedTeam, setSelectedTeam] = useState(tip?.selected_team || game.home_team);
  const [margin, setMargin] = useState(tip?.margin || 8);
  const [showConfetti, setShowConfetti] = useState(false);
  const scores = deriveScores(game, selectedTeam, margin);
  const status = getStatus(game.kickoff, game.status);
  const locked = status.label === "Locked" || status.label === "Final" || status.label === "Live";
  const countdown = useCountdown(game.kickoff);
  const tipResult = checkTipResult(game, tip);

  useEffect(() => {
    setSelectedTeam(tip?.selected_team || game.home_team);
    setMargin(tip?.margin || 8);
  }, [game.id, tip, game.home_team]);

  const handleLock = (e) => {
    e.stopPropagation();
    if (!tip) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 900);
    }
    onTip(game, { selected_team: selectedTeam, margin, predicted_home_score: scores.home, predicted_away_score: scores.away });
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      whileHover={!active ? { scale: 1.01 } : {}}
      onClick={onSelect}
      className={`relative overflow-hidden border transition-all cursor-pointer ${
        active
          ? `border-primary/50 bg-gradient-to-b from-primary/[0.06] to-black/40 ${status.glow}`
          : "border-border/30 bg-black/30 hover:border-primary/25"
      }`}
    >
      <ConfettiBurst active={showConfetti} />

      {/* Top accent */}
      <div className={`h-[2px] w-full ${status.label === "Live" ? "bg-red-500 animate-pulse" : "bg-gradient-to-r from-primary/60 via-accent/40 to-primary/60"}`} />

      <div className="p-3">
        {/* Header row: time + status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {countdown && (
              <div className="flex items-center gap-1 border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5">
                <Clock className="h-2.5 w-2.5 text-amber-300" />
                <span className="text-[8px] font-mono font-bold tabular-nums text-amber-200">{countdown}</span>
              </div>
            )}
            <div className="flex items-center gap-1 min-w-0">
              <Calendar className="h-2.5 w-2.5 shrink-0 text-slate-500" />
              <span className="truncate text-[8px] text-slate-400">{formatKickoff(game.kickoff)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {tipResult && (
              <span className={`flex items-center gap-0.5 text-[8px] font-bold ${tipResult.correct ? "text-emerald-400" : "text-red-400"}`}>
                {tipResult.correct ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {tipResult.correct ? (tipResult.perfectMargin ? "Perfect!" : "Correct") : "Wrong"}
              </span>
            )}
            <span className={`border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.15em] ${status.tone}`}>
              {status.label === "Live" && <Radio className="inline h-2.5 w-2.5 mr-0.5 animate-pulse" />}
              {tip && !locked ? "Tipped" : status.label}
            </span>
          </div>
        </div>

        {/* Round + venue */}
        <div className="mt-1.5 flex items-center gap-2 text-[8px] text-slate-500">
          <span className="font-bold uppercase tracking-[0.15em] text-primary/70">{game.label || "NRL Fixture"}</span>
          {game.venue && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5 truncate">
                <MapPin className="h-2.5 w-2.5 shrink-0" />{game.venue}
              </span>
            </>
          )}
        </div>

        {/* === SCOREBOARD: Finished matches === */}
        {game.status === "finished" && game.home_score != null ? (
          <div className="mt-3 border border-border/25 bg-black/50 p-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className={`text-center ${tipResult?.correct && tip?.selected_team === game.home_team ? "ring-1 ring-emerald-500/30 bg-emerald-500/5 p-1.5" : "p-1.5"}`}>
                <TeamCrest name={game.home_team} className="mx-auto h-10 w-10 text-xs" />
                <p className="mt-1 truncate text-[9px] font-bold text-foreground">{shortName(game.home_team)}</p>
              </div>
              <div className="text-center">
                <div className="flex items-baseline gap-1.5">
                  <motion.span
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    className="font-display text-2xl tabular-nums text-foreground"
                  >
                    {game.home_score}
                  </motion.span>
                  <span className="text-xs text-slate-600">-</span>
                  <motion.span
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    className="font-display text-2xl tabular-nums text-foreground"
                  >
                    {game.away_score}
                  </motion.span>
                </div>
                <p className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.2em] text-slate-500">Full time</p>
              </div>
              <div className={`text-center ${tipResult?.correct && tip?.selected_team === game.away_team ? "ring-1 ring-emerald-500/30 bg-emerald-500/5 p-1.5" : "p-1.5"}`}>
                <TeamCrest name={game.away_team} className="mx-auto h-10 w-10 text-xs" />
                <p className="mt-1 truncate text-[9px] font-bold text-foreground">{shortName(game.away_team)}</p>
              </div>
            </div>
            {tip && tipResult && (
              <div className={`mt-2 border-t border-border/20 pt-2 text-center text-[9px] ${tipResult.correct ? "text-emerald-400" : "text-red-400"}`}>
                {tipResult.correct
                  ? tipResult.perfectMargin
                    ? "🎯 Nailed it! Perfect margin call."
                    : `✅ Winner picked. Margin off by ${tipResult.marginDiff}.`
                  : `❌ Tipped ${shortName(tip.selected_team)}. Margin was ${tipResult.actualMargin}.`}
              </div>
            )}
          </div>
        ) : (
          /* === TEAM PICKER: Upcoming matches === */
          <>
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              {[game.home_team, game.away_team].map((team) => {
                const selected = selectedTeam === team;
                return (
                  <button
                    key={team}
                    type="button"
                    disabled={locked}
                    onClick={(e) => { e.stopPropagation(); setSelectedTeam(team); }}
                    className={`relative min-w-0 border p-2.5 text-center transition-all ${
                      selected
                        ? "border-primary/50 bg-gradient-to-b from-primary/15 to-primary/5 text-foreground"
                        : "border-border/25 bg-black/25 text-slate-400 hover:border-border/40 hover:text-slate-200"
                    }`}
                  >
                    {selected && (
                      <motion.div
                        layoutId={`pick-${game.id}`}
                        className="absolute inset-0 border-2 border-primary/40"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <TeamCrest name={team} className="mx-auto h-10 w-10 text-xs" />
                    <p className="mt-1.5 truncate text-[9px] font-bold uppercase tracking-wide">{shortName(team)}</p>
                    {selected && <Star className="absolute right-1 top-1 h-3 w-3 text-primary" />}
                  </button>
                );
              })}
              <div className="text-center">
                <p className="font-display text-xl text-primary/80">VS</p>
                <p className="mt-0.5 text-[7px] font-mono text-slate-500">{initials(game.home_team)}-{initials(game.away_team)}</p>
              </div>
            </div>

            {/* Margin slider */}
            <div className="mt-3 border border-border/20 bg-black/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-400">Margin</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-2xl tabular-nums text-foreground">{margin}</span>
                  <span className="text-[8px] text-slate-500">pts</span>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="40"
                value={margin}
                disabled={locked}
                onChange={(e) => setMargin(Number(e.target.value))}
                className="mt-2 w-full accent-primary"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[8px] text-slate-500">Prediction</span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-foreground">
                  <span className={selectedTeam === game.home_team ? "text-primary" : ""}>{scores.home}</span>
                  <span className="text-slate-600">-</span>
                  <span className={selectedTeam === game.away_team ? "text-primary" : ""}>{scores.away}</span>
                </span>
              </div>
            </div>

            <CommunityPulse game={game} entries={entries} />

            {/* Lock button */}
            <motion.button
              type="button"
              disabled={locked}
              whileTap={!locked ? { scale: 0.97 } : {}}
              onClick={handleLock}
              className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${
                locked
                  ? "bg-slate-800/50 text-slate-600 cursor-not-allowed"
                  : tip
                    ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "bg-gradient-to-r from-primary to-accent text-white hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
              }`}
            >
              {locked ? (
                <><Shield className="h-3.5 w-3.5" /> Locked</>
              ) : tip ? (
                <><CheckCircle2 className="h-3.5 w-3.5" /> Update Tip</>
              ) : (
                <><Target className="h-3.5 w-3.5" /> Lock Tip</>
              )}
            </motion.button>
          </>
        )}
      </div>
    </motion.article>
  );
}

function CommunityPulse({ game, entries }) {
  const gameEntries = entries.filter((e) => e.game_id === game.id);
  const home = gameEntries.filter((e) => e.selected_team === game.home_team).length;
  const away = gameEntries.filter((e) => e.selected_team === game.away_team).length;
  const total = Math.max(home + away, 1);
  const homePct = Math.round((home / total) * 100) || 50;
  const awayPct = 100 - homePct;

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-[7px] font-bold uppercase tracking-[0.2em]">
        <span className="text-slate-500">Community pulse</span>
        <span className="text-slate-500">{gameEntries.length || "—"} tips</span>
      </div>
      <div className="relative flex h-6 overflow-hidden border border-border/20 bg-black/40">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${homePct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex items-center justify-start pl-1.5 bg-gradient-to-r from-primary/50 to-primary/20"
        >
          <span className="text-[8px] font-bold text-white/80">{homePct}%</span>
        </motion.div>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${awayPct}%` }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="flex items-center justify-end pr-1.5 bg-gradient-to-l from-accent/50 to-accent/20"
        >
          <span className="text-[8px] font-bold text-white/80">{awayPct}%</span>
        </motion.div>
      </div>
    </div>
  );
}

function Leaderboard({ entries, tips }) {
  const community = useMemo(() => {
    const totals = new Map();
    const seen = new Set();
    entries.forEach((entry) => {
      const key = `${entry.game_id}-${entry.tipper_name || "Mystery Fan"}`;
      if (seen.has(key)) return;
      seen.add(key);
      const name = entry.tipper_name || "Mystery Fan";
      const curr = totals.get(name) || { name, tips: 0 };
      curr.tips += 1;
      totals.set(name, curr);
    });
    const yours = { name: "You", tips: Object.keys(tips).length, me: true };
    return [yours, ...Array.from(totals.values())]
      .filter((r) => r.tips > 0)
      .sort((a, b) => b.tips - a.tips)
      .slice(0, 5);
  }, [entries, tips]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="border border-border/30 bg-black/30 p-3">
      <div className="mb-3 flex items-center gap-2">
        <Crown className="h-3.5 w-3.5 text-amber-400" />
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300">Tipster Ladder</p>
      </div>
      <div className="space-y-1.5">
        {community.length ? community.map((row, i) => (
          <motion.div
            key={`${row.name}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-center gap-2 border p-2 ${
              row.me
                ? "border-primary/30 bg-gradient-to-r from-primary/10 to-transparent"
                : "border-border/15 bg-black/20"
            }`}
          >
            <span className="w-5 text-center text-xs">{medals[i] || i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-foreground">{row.name}</p>
            </div>
            <span className="text-[10px] font-bold tabular-nums text-primary">{row.tips}</span>
            <span className="text-[7px] text-slate-500">tips</span>
          </motion.div>
        )) : (
          <p className="text-xs text-slate-500">Be first to lock a tip.</p>
        )}
      </div>
    </div>
  );
}

// ── Main Export ──────────────────────────────────────────────────────
export default function ScorePredictor({ onSharePrediction }) {
  const queryClient = useQueryClient();
  const [tips, setTips] = useState(() => readJson(STORAGE_KEY, {}));
  const [filter, setFilter] = useState("near");
  const [activeGameId, setActiveGameId] = useState("");
  const queriesEnabled = appParams.hasBase44Config;

  // ── Real NRL fixtures from RugbyAPI2 ──
  const { data: apiFixtures = [], isLoading: apiLoading } = useQuery({
    queryKey: ["nrlApiFixtures"],
    queryFn: fetchUpcomingFixtures,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
    meta: { silent: true },
  });

  const { data: matchups = [] } = useQuery({
    queryKey: ["matchups"],
    queryFn: () => base44.entities.Matchup.list("kickoff", 100),
    enabled: queriesEnabled,
    retry: false,
    meta: { silent: true },
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["tippingEntries"],
    queryFn: () => base44.entities.TippingEntry.list("-created_date", 500),
    enabled: queriesEnabled,
    retry: false,
    meta: { silent: true },
  });

  const fixtures = useMemo(() => {
    const adminGames = (matchups || [])
      .filter((m) => m.is_published !== false && m.home_team && m.away_team)
      .map((m) => ({ ...m, id: m.id || `${m.home_team}-${m.away_team}-${m.kickoff || "tba"}` }));
    const seen = new Set(adminGames.map((g) => `${g.home_team}-${g.away_team}-${String(g.kickoff).slice(0, 10)}`));
    const apiGames = (apiFixtures || []).filter(
      (g) => !seen.has(`${g.home_team}-${g.away_team}-${String(g.kickoff).slice(0, 10)}`)
    );
    return [...adminGames, ...apiGames]
      .filter((g) => filter === "all" || filter === "mine" ? true : isNearFixture(g.kickoff))
      .filter((g) => filter !== "mine" || tips[g.id])
      .sort((a, b) => new Date(a.kickoff || 0) - new Date(b.kickoff || 0))
      .slice(0, filter === "all" ? 30 : 12);
  }, [matchups, apiFixtures, filter, tips]);

  // Group by round
  const groupedFixtures = useMemo(() => {
    const groups = [];
    let lastLabel = "";
    fixtures.forEach((g) => {
      const label = g.label || "NRL Fixture";
      if (label !== lastLabel) {
        groups.push({ label, games: [] });
        lastLabel = label;
      }
      groups[groups.length - 1].games.push(g);
    });
    return groups;
  }, [fixtures]);

  useEffect(() => {
    if (!activeGameId && fixtures[0]?.id) setActiveGameId(fixtures[0].id);
  }, [fixtures, activeGameId]);

  const activeGame = fixtures.find((g) => g.id === activeGameId) || fixtures[0];

  const createTip = useMutation({
    mutationFn: (payload) => base44.entities.TippingEntry.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tippingEntries"] }),
  });

  const handleTip = (game, tip) => {
    const next = {
      ...tips,
      [game.id]: {
        ...tip,
        game_id: game.id,
        home_team: game.home_team,
        away_team: game.away_team,
        kickoff: game.kickoff,
        tipped_at: new Date().toISOString(),
      },
    };
    setTips(next);
    writeJson(STORAGE_KEY, next);
    writeJson(PROFILE_KEY, { streak: Math.max(1, Object.keys(next).length), updated_at: new Date().toISOString() });
    try {
      localStorage.setItem(`rlt_match_voted_${game.id}`, "true");
      window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "tip_locked" } }));
    } catch { /* ignore */ }

    if (queriesEnabled && !tips[game.id]) {
      createTip.mutate({
        game_id: game.id,
        game_label: game.label || "NRL Fixture",
        home_team: game.home_team,
        away_team: game.away_team,
        selected_team: tip.selected_team,
        predicted_home_score: tip.predicted_home_score,
        predicted_away_score: tip.predicted_away_score,
        margin: tip.margin,
        tipper_name: "Vegas Fan",
        kickoff: game.kickoff,
      });
    }
  };

  const handleShare = () => {
    if (!activeGame || !onSharePrediction) return;
    const tip = tips[activeGame.id] || { selected_team: activeGame.home_team, margin: 8, ...deriveScores(activeGame, activeGame.home_team, 8) };
    const homeScore = tip.predicted_home_score ?? tip.home ?? 24;
    const awayScore = tip.predicted_away_score ?? tip.away ?? 16;
    onSharePrediction(activeGame, homeScore, awayScore);
    try { window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "share_tip" } })); } catch { /* ignore */ }
  };

  const tippedCount = fixtures.filter((g) => tips[g.id]).length;

  return (
    <div className="overflow-hidden border border-border/50 bg-gradient-to-b from-card/40 to-black/60 cmd-glass">
      {/* Premium accent bar */}
      <div className="h-[3px] w-full bg-gradient-to-r from-primary via-accent to-primary" />

      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative border border-primary/25 bg-gradient-to-br from-primary/15 to-primary/5 p-2.5">
              <Trophy className="h-5 w-5 text-primary" />
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-400"
              />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-lg uppercase leading-none tracking-wide text-foreground">
                Footy Tipping
              </h3>
              <p className="mt-1 text-[7px] font-mono uppercase tracking-[0.3em] text-slate-400">
                NRL 2026 · Live fixtures
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="border border-primary/25 bg-primary/10 px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.2em] text-primary">
              Season 2026
            </span>
            {apiLoading && (
              <span className="text-[7px] text-slate-500 animate-pulse">Loading fixtures…</span>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-4">
          <HeroStats tips={tips} fixtures={fixtures} />
        </div>

        {/* Filter tabs */}
        <div className="mt-4 grid grid-cols-3 border border-border/30 bg-black/30 p-0.5">
          {[
            { id: "near", label: "Upcoming", icon: Clock },
            { id: "all", label: "Full Draw", icon: BarChart3 },
            { id: "mine", label: "My Tips", icon: Target },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`flex items-center justify-center gap-1 min-h-9 text-[8px] font-bold uppercase tracking-[0.15em] transition-all ${
                filter === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <item.icon className="h-3 w-3" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Featured battle */}
        {activeGame && (
          <motion.div
            key={activeGame.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 border border-primary/20 bg-gradient-to-b from-primary/[0.06] to-transparent p-3"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-accent" />
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-primary/80">Featured Match</p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="min-w-0 text-center flex-1">
                <TeamCrest name={activeGame.home_team} className="mx-auto h-12 w-12 text-xs" />
                <p className="mt-1 truncate text-[10px] font-bold text-foreground">{shortName(activeGame.home_team)}</p>
              </div>
              <div className="text-center px-2">
                {activeGame.status === "finished" && activeGame.home_score != null ? (
                  <>
                    <p className="font-display text-xl text-foreground">{activeGame.home_score} - {activeGame.away_score}</p>
                    <p className="text-[7px] text-slate-500 uppercase tracking-wider">Final</p>
                  </>
                ) : (
                  <>
                    <p className="font-display text-2xl text-primary/80">VS</p>
                    <p className="text-[7px] text-slate-500">{formatKickoff(activeGame.kickoff)}</p>
                  </>
                )}
              </div>
              <div className="min-w-0 text-center flex-1">
                <TeamCrest name={activeGame.away_team} className="mx-auto h-12 w-12 text-xs" />
                <p className="mt-1 truncate text-[10px] font-bold text-foreground">{shortName(activeGame.away_team)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleShare}
              className="mt-3 flex min-h-9 w-full items-center justify-center gap-2 border border-primary/25 bg-black/30 text-[9px] font-bold uppercase tracking-[0.2em] text-primary transition-all hover:bg-primary hover:text-primary-foreground"
            >
              <Share2 className="h-3 w-3" /> Share To Forum
            </button>
          </motion.div>
        )}

        {/* Fixture cards grouped by round */}
        <div className="mt-4 space-y-2">
          <AnimatePresence mode="popLayout">
            {groupedFixtures.map((group) => (
              <div key={group.label}>
                <RoundBadge label={group.label} />
                <div className="space-y-2">
                  {group.games.map((game) => (
                    <FixtureCard
                      key={game.id}
                      game={game}
                      tip={tips[game.id]}
                      onTip={handleTip}
                      entries={entries}
                      active={activeGame?.id === game.id}
                      onSelect={() => setActiveGameId(game.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </AnimatePresence>
          {fixtures.length === 0 && (
            <div className="border border-border/30 bg-black/30 p-6 text-center">
              <Shield className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-2 text-xs font-bold text-slate-400">
                {filter === "mine" ? "No tips locked yet." : "No fixtures in this view."}
              </p>
              {filter === "mine" && (
                <button onClick={() => setFilter("near")} className="mt-2 text-[10px] text-primary hover:underline">
                  Browse upcoming games →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom panels */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Leaderboard entries={entries} tips={tips} />
          <div className="border border-border/30 bg-black/30 p-3">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300">How to play</p>
            </div>
            <ul className="mt-3 space-y-2 text-[10px] leading-relaxed text-slate-400">
              <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />Pick the winner for each NRL game.</li>
              <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />Set your margin prediction for bonus points.</li>
              <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />Lock before kickoff — tips auto-lock at game time.</li>
              <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />Results update live — see if you nailed it!</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-border/15 pt-3 text-[7px] font-bold uppercase tracking-[0.2em] text-slate-500">
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-primary/60" /> Live tipping hub
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-accent/60" /> {tippedCount} tipped
          </span>
        </div>
      </div>
    </div>
  );
}