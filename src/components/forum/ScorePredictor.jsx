import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Users, Share2, TrendingUp, Calendar, Flame, Sparkles, Shield, Target, Coins, CheckCircle2, ChevronRight, Zap, Crown, Info, Radio } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { buildRollingNrlFixtures, formatKickoff, isNearFixture } from "@/lib/nrl-fixtures";
import { fetchUpcomingFixtures } from "@/lib/nrl-api";
import TeamCrest from "@/components/public/TeamCrest";

const STORAGE_KEY = "rlt_footy_tips_v2";
const PROFILE_KEY = "rlt_footy_tipster_profile";

const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
};

const writeJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
};

const initials = (name) => String(name || "NRL").split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();

function deriveScores(game, selectedTeam, margin) {
  const seed = String(game.id || game.home_team).split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const loser = 10 + (seed % 18);
  const winner = loser + Number(margin || 1);
  return selectedTeam === game.home_team
    ? { home: winner, away: loser }
    : { home: loser, away: winner };
}

function getStatus(kickoff, apiStatus) {
  // API-sourced statuses take priority
  if (apiStatus === "live") return { label: "Live", tone: "text-red-300 border-red-400/25 bg-red-400/10 animate-pulse" };
  if (apiStatus === "finished") return { label: "Final", tone: "text-slate-300 border-slate-400/20 bg-slate-400/10" };
  if (!kickoff) return { label: "Open", tone: "text-emerald-300 border-emerald-400/25 bg-emerald-400/10" };
  const diff = new Date(kickoff).getTime() - Date.now();
  if (diff < 0) return { label: "Locked", tone: "text-slate-300 border-slate-400/20 bg-slate-400/10" };
  if (diff < 24 * 60 * 60 * 1000) return { label: "Hot", tone: "text-orange-300 border-orange-400/25 bg-orange-400/10" };
  return { label: "Open", tone: "text-emerald-300 border-emerald-400/25 bg-emerald-400/10" };
}

function TipProgress({ tips, fixtures }) {
  const total = fixtures.length || 1;
  const tipped = fixtures.filter((g) => tips[g.id]).length;
  const percent = Math.round((tipped / total) * 100);
  return (
    <div className="border border-border/40 bg-black/35 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-primary">Round Card</p>
          <p className="mt-1 text-xs text-slate-200">{tipped}/{total} games tipped</p>
        </div>
        <div className="font-display text-3xl tabular-nums text-foreground">{percent}%</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden bg-neutral-900">
        <motion.div className="h-full bg-gradient-to-r from-primary via-accent to-primary" initial={{ width: 0 }} animate={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function TipsterProfile({ tips, fixtures }) {
  const tipped = fixtures.filter((g) => tips[g.id]).length;
  const chips = Object.values(tips).reduce((sum, tip) => sum + Number(tip.confidence || 0), 0);
  const streak = Number(readJson(PROFILE_KEY, { streak: 0 }).streak || 0);
  const rank = tipped >= 8 ? "Immortal Tipster" : tipped >= 5 ? "Sharp Shooter" : tipped >= 2 ? "Form Analyst" : "Rookie Punter";
  return (
    <div className="grid grid-cols-3 divide-x divide-border/30 border border-border/40 bg-card/20">
      {[
        { icon: Trophy, label: "Rank", value: rank },
        { icon: Coins, label: "Chips", value: chips || 25 },
        { icon: Flame, label: "Streak", value: `${streak || tipped}x` },
      ].map(({ icon: Icon, label, value }) => (
        <div key={label} className="min-w-0 p-2.5 text-center">
          <Icon className="mx-auto h-3.5 w-3.5 text-primary" />
          <p className="mt-1 truncate text-[10px] font-bold text-foreground">{value}</p>
          <p className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
        </div>
      ))}
    </div>
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
      <div className="mb-1 flex items-center justify-between text-[8px] font-bold uppercase tracking-[0.2em] text-slate-400">
        <span>Community pulse</span>
        <span>{gameEntries.length || "Live"} tips</span>
      </div>
      <div className="flex h-5 overflow-hidden border border-border/30 bg-neutral-950">
        <motion.div initial={{ width: 0 }} animate={{ width: `${homePct}%` }} className="bg-amber-500/80" />
        <motion.div initial={{ width: 0 }} animate={{ width: `${awayPct}%` }} className="bg-red-500/80" />
      </div>
    </div>
  );
}

function FixtureCard({ game, tip, onTip, entries, active, onSelect }) {
  const [selectedTeam, setSelectedTeam] = useState(tip?.selected_team || game.home_team);
  const [margin, setMargin] = useState(tip?.margin || 8);
  const [confidence, setConfidence] = useState(tip?.confidence || 3);
  const scores = deriveScores(game, selectedTeam, margin);
  const status = getStatus(game.kickoff, game.status);
  const locked = status.label === "Locked" || status.label === "Final" || status.label === "Live";

  useEffect(() => {
    setSelectedTeam(tip?.selected_team || game.home_team);
    setMargin(tip?.margin || 8);
    setConfidence(tip?.confidence || 3);
  }, [game.id, tip, game.home_team]);

  return (
    <motion.article
      layout
      whileHover={{ y: -2 }}
      onClick={onSelect}
      className={`relative overflow-hidden border bg-card/30 transition-all ${active ? "border-primary/50 shadow-[0_0_24px_hsl(var(--primary)/0.12)]" : "border-border/45 hover:border-primary/25"}`}
    >
      <div className="h-[2px] w-full bg-gradient-to-r from-primary via-accent to-primary" />
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-primary" />
              <p className="truncate text-[8px] font-bold uppercase tracking-[0.22em] text-slate-300">{formatKickoff(game.kickoff)}</p>
            </div>
            <p className="mt-1 truncate text-[8px] font-bold uppercase tracking-[0.2em] text-primary/80">{game.label || "NRL Fixture"}</p>
          </div>
          <span className={`shrink-0 border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.18em] ${status.tone}`}>
            {status.label === "Live" && <Radio className="inline h-2.5 w-2.5 mr-0.5" />}
            {tip && status.label !== "Final" && status.label !== "Live" ? "Tipped" : status.label}
          </span>
        </div>
        {game.status === "finished" && game.home_score != null && (
          <div className="mt-1.5 flex items-center justify-center gap-2 border border-border/30 bg-black/30 py-1.5 px-3">
            <span className="text-xs font-bold text-foreground">{game.home_team.split(" ").pop()}</span>
            <span className="font-display text-lg tabular-nums text-primary">{game.home_score}</span>
            <span className="text-[8px] text-slate-500">-</span>
            <span className="font-display text-lg tabular-nums text-primary">{game.away_score}</span>
            <span className="text-xs font-bold text-foreground">{game.away_team.split(" ").pop()}</span>
          </div>
        )}
        {game.generated && (
          <div className="mt-1.5 flex items-center gap-1 text-[8px] text-amber-400/70">
            <Info className="h-3 w-3 shrink-0" />
            <span>Sample draw — real fixtures coming soon</span>
          </div>
        )}

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {[game.home_team, game.away_team].map((team) => {
            const selected = selectedTeam === team;
            return (
              <button
                key={team}
                type="button"
                disabled={locked}
                onClick={(e) => { e.stopPropagation(); setSelectedTeam(team); }}
                className={`min-w-0 border p-2 text-center transition-all ${selected ? "border-primary/60 bg-primary/12 text-foreground" : "border-border/30 bg-black/25 text-slate-300 hover:border-border"}`}
              >
                <TeamCrest name={team} className="mx-auto h-10 w-10 text-xs" />
                <p className="mt-2 truncate text-[10px] font-bold uppercase tracking-wide">{team}</p>
              </button>
            );
          })}
          <div className="text-center">
            <p className="font-display text-xl text-primary">VS</p>
            <p className="mt-1 text-[8px] font-mono text-slate-400">{initials(game.home_team)}-{initials(game.away_team)}</p>
          </div>
        </div>

        <div className="mt-3 border border-border/30 bg-black/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-300">Margin</span>
            <span className="font-display text-xl tabular-nums text-foreground">{margin}</span>
          </div>
          <input type="range" min="1" max="40" value={margin} disabled={locked} onChange={(e) => setMargin(Number(e.target.value))} className="mt-2 w-full accent-primary" />
          <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400">
            <span>Predicted score</span>
            <span className="font-mono text-slate-200">{scores.home} - {scores.away}</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-300">Confidence</span>
            <span className="text-[8px] text-slate-400">{confidence}/5 chips wagered</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={locked}
                onClick={(e) => { e.stopPropagation(); setConfidence(chip); }}
                aria-label={`${chip} confidence chip${chip > 1 ? 's' : ''}`}
                className={`flex h-8 flex-1 items-center justify-center border text-[10px] font-bold transition-all ${confidence >= chip ? "border-amber-400/50 bg-amber-400/15 text-amber-200" : "border-border/30 bg-black/20 text-slate-500"}`}
              >
                <Coins className="h-3 w-3" />
              </button>
            ))}
          </div>
        </div>

        <CommunityPulse game={game} entries={entries} />

        <button
          type="button"
          disabled={locked}
          onClick={(e) => {
            e.stopPropagation();
            onTip(game, { selected_team: selectedTeam, margin, confidence, predicted_home_score: scores.home, predicted_away_score: scores.away });
          }}
          className={`mt-3 flex min-h-10 w-full items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${locked ? "bg-slate-800 text-slate-500" : tip ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
        >
          {tip ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
          {tip ? "Update Tip" : "Lock Tip"}
        </button>
      </div>
    </motion.article>
  );
}

function Leaderboard({ entries, tips }) {
  const community = useMemo(() => {
    const totals = new Map();
    entries.forEach((entry) => {
      const name = entry.tipper_name || "Mystery Fan";
      const curr = totals.get(name) || { name, tips: 0, chips: 0 };
      curr.tips += 1;
      curr.chips += Number(entry.confidence || 1);
      totals.set(name, curr);
    });
    const yours = { name: "You", tips: Object.keys(tips).length, chips: Object.values(tips).reduce((s, t) => s + Number(t.confidence || 0), 0), me: true };
    return [yours, ...Array.from(totals.values())]
      .filter((r) => r.tips > 0)
      .sort((a, b) => b.chips - a.chips || b.tips - a.tips)
      .slice(0, 5);
  }, [entries, tips]);

  return (
    <div className="border border-border/45 bg-card/20 p-3">
      <div className="mb-3 flex items-center gap-2">
        <Crown className="h-3.5 w-3.5 text-amber-300" />
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300">Tipster ladder</p>
      </div>
      <div className="space-y-2">
        {community.length ? community.map((row, i) => (
          <div key={`${row.name}-${i}`} className={`flex items-center gap-2 border px-2 py-2 ${row.me ? "border-primary/35 bg-primary/10" : "border-border/25 bg-black/20"}`}>
            <span className="w-5 text-center text-xs">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-foreground">{row.name}</p>
              <p className="text-[8px] text-slate-400">{row.tips} tips · {row.chips} confidence chips</p>
            </div>
          </div>
        )) : <p className="text-xs text-slate-400">Be first to lock a tip.</p>}
      </div>
    </div>
  );
}

export default function ScorePredictor({ onSharePrediction }) {
  const queryClient = useQueryClient();
  const [tips, setTips] = useState(() => readJson(STORAGE_KEY, {}));
  const [filter, setFilter] = useState("near");
  const [activeGameId, setActiveGameId] = useState("");
  const queriesEnabled = appParams.hasBase44Config;

  // ── Real NRL fixtures from RugbyAPI2 ──
  const { data: apiFixtures = [] } = useQuery({
    queryKey: ["nrlApiFixtures"],
    queryFn: fetchUpcomingFixtures,
    staleTime: 5 * 60 * 1000,    // 5 min cache to conserve API calls
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
    // Admin-entered games take top priority
    const adminGames = (matchups || [])
      .filter((m) => m.is_published !== false && m.home_team && m.away_team)
      .map((m) => ({ ...m, id: m.id || `${m.home_team}-${m.away_team}-${m.kickoff || "tba"}` }));
    const seen = new Set(adminGames.map((g) => `${g.home_team}-${g.away_team}-${String(g.kickoff).slice(0, 10)}`));

    // API fixtures fill in (already falls back to generated internally)
    const apiGames = (apiFixtures || []).filter(
      (g) => !seen.has(`${g.home_team}-${g.away_team}-${String(g.kickoff).slice(0, 10)}`)
    );

    return [...adminGames, ...apiGames]
      .filter((g) => filter === "all" || filter === "mine" ? true : isNearFixture(g.kickoff))
      .filter((g) => filter !== "mine" || tips[g.id])
      .sort((a, b) => new Date(a.kickoff || 0) - new Date(b.kickoff || 0))
      .slice(0, filter === "all" ? 24 : 10);
  }, [matchups, apiFixtures, filter, tips]);

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

    if (queriesEnabled) {
      createTip.mutate({
        game_id: game.id,
        game_label: game.label || "NRL Fixture",
        home_team: game.home_team,
        away_team: game.away_team,
        selected_team: tip.selected_team,
        predicted_home_score: tip.predicted_home_score,
        predicted_away_score: tip.predicted_away_score,
        margin: tip.margin,
        confidence: tip.confidence,
        tipper_name: "Vegas Fan",
        kickoff: game.kickoff,
      });
    }
  };

  const handleShare = () => {
    if (!activeGame || !onSharePrediction) return;
    const tip = tips[activeGame.id] || { selected_team: activeGame.home_team, margin: 8, confidence: 3, ...deriveScores(activeGame, activeGame.home_team, 8) };
    const homeScore = tip.predicted_home_score ?? tip.home ?? 24;
    const awayScore = tip.predicted_away_score ?? tip.away ?? 16;
    onSharePrediction(activeGame, homeScore, awayScore);
    try { window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "share_tip" } })); } catch { /* ignore */ }
  };

  return (
    <div className="overflow-hidden border border-border/65 bg-card/30 cmd-glass">
      <div className="h-[2px] w-full cmd-accent-bar" />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative border border-primary/20 bg-primary/10 p-2">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-400 cmd-pulse" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-lg uppercase leading-none tracking-wide text-foreground">Footy Tipping Arena</h3>
              <p className="mt-1 text-[8px] font-mono uppercase tracking-[0.25em] text-slate-300">Rolling NRL slate · all year</p>
            </div>
          </div>
          <span className="shrink-0 border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.2em] text-amber-200">Elite Mode</span>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-300">
          Tip every nearby NRL game, stake confidence chips, chase streaks, and compare your read with the community pulse.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <TipProgress tips={tips} fixtures={fixtures} />
          <TipsterProfile tips={tips} fixtures={fixtures} />
        </div>

        <div className="mt-4 grid grid-cols-3 border border-border/40 bg-black/25 p-0.5">
          {[
            { id: "near", label: "Near" },
            { id: "all", label: "Slate" },
            { id: "mine", label: "Mine" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`min-h-9 text-[9px] font-bold uppercase tracking-[0.2em] transition-all ${filter === item.id ? "bg-primary text-primary-foreground" : "text-slate-300 hover:bg-muted/20"}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {activeGame && (
          <div className="mt-4 border border-primary/25 bg-primary/[0.05] p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-primary">Featured battle</p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="min-w-0 text-center">
                <TeamCrest name={activeGame.home_team} className="mx-auto h-11 w-11 text-xs" />
                <p className="mt-1 truncate text-[10px] font-bold text-foreground">{activeGame.home_team}</p>
              </div>
              <div className="text-center">
                <p className="font-display text-2xl text-primary">VS</p>
                <p className="text-[8px] text-slate-400">{formatKickoff(activeGame.kickoff)}</p>
              </div>
              <div className="min-w-0 text-center">
                <TeamCrest name={activeGame.away_team} className="mx-auto h-11 w-11 text-xs" />
                <p className="mt-1 truncate text-[10px] font-bold text-foreground">{activeGame.away_team}</p>
              </div>
            </div>
            <button type="button" onClick={handleShare} className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 border border-primary/35 bg-black/30 text-[10px] font-bold uppercase tracking-[0.2em] text-primary transition-all hover:bg-primary hover:text-primary-foreground">
              <Share2 className="h-3.5 w-3.5" /> Share Tip To Forum
            </button>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {fixtures.map((game) => (
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
          </AnimatePresence>
          {fixtures.length === 0 && (
            <div className="border border-border/40 bg-black/25 p-5 text-center">
              <Shield className="mx-auto h-8 w-8 text-slate-500" />
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-300">No tips in this view yet</p>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Leaderboard entries={entries} tips={tips} />
          <div className="border border-border/45 bg-black/25 p-3">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300">Game rules</p>
            </div>
            <ul className="mt-3 space-y-2 text-[10px] leading-relaxed text-slate-300">
              <li className="flex gap-2"><ChevronRight className="mt-0.5 h-3 w-3 text-primary" />Pick the winner and exact margin.</li>
              <li className="flex gap-2"><ChevronRight className="mt-0.5 h-3 w-3 text-primary" />Confidence chips boost ladder bragging rights.</li>
              <li className="flex gap-2"><ChevronRight className="mt-0.5 h-3 w-3 text-primary" />Lock more games to build your streak and badges.</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border/20 pt-3 text-[8px] font-bold uppercase tracking-[0.22em] text-slate-400">
          <span className="flex items-center gap-1.5"><TrendingUp className="h-3 w-3 text-primary" /> Live tipping hub</span>
          <span className="flex items-center gap-1.5"><Users className="h-3 w-3 text-accent" /> {entries.length || "Community"}</span>
        </div>
      </div>
    </div>
  );
}