import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Users, Share2, TrendingUp, Calendar, Sparkles, Shield,
  Target, CheckCircle2, Zap, Crown, Lock,
  Radio, Clock, MapPin, Star, ArrowRight, BarChart3, XCircle,
  Flame, Award, AlertTriangle, RefreshCw, Trash2,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import { formatKickoff, isNearFixture } from "@/lib/nrl-fixtures";
import { fetchUpcomingFixtures } from "@/lib/nrl-api";
import TeamCrest from "@/components/public/TeamCrest";
import {
  STORAGE_KEY, PROFILE_KEY, POINTS_KEY, MARGIN_PRESETS,
  PTS_CORRECT, PTS_MARGIN_BONUS,
} from "@/components/forum/tipping/constants";
import { readJson, writeJson } from "@/components/forum/tipping/storage";
import {
  isValidTip, sanitizeTips, shortName, deriveScores, getStatus, checkTipResult,
} from "@/components/forum/tipping/tipHelpers";
import { playLockSound, playSelectSound } from "@/components/forum/tipping/audio";
import { useCountdown } from "@/components/forum/tipping/hooks";
import { successImpact, selectionChanged, warningImpact } from "@/lib/native/haptics";
import { enqueueTip, removeTipFromQueue, prunedTipQueue } from "@/lib/tip-sync-queue";
import { toast } from "@/components/ui/use-toast";
import ConfettiBurst from "@/components/forum/tipping/ConfettiBurst";
import PointsPopup from "@/components/forum/tipping/PointsPopup";
import HeroStats from "@/components/forum/tipping/HeroStats";

// ── Sub-components ──────────────────────────────────────────────────

function RoundBadge({ label, games, tips }) {
  if (!label) return null;
  const gameCount = games?.length || 0;
  const tippedCount = games?.filter((g) => tips?.[g.id]).length || 0;
  const allTipped = gameCount > 0 && tippedCount === gameCount;
  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/60">{label}</span>
        {gameCount > 0 && (
          <span className={`text-[9px] font-mono px-1.5 py-0.5 border ${
            allTipped
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-border/20 bg-black/30 text-slate-500"
          }`}>
            {tippedCount}/{gameCount}
          </span>
        )}
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </div>
  );
}

// ── Locked Tip Receipt ──────────────────────────────────────────────
function LockedTipReceipt({ game, tip }) {
  const scores = deriveScores(game, tip.selected_team, tip.margin);
  const isHome = tip.selected_team === game.home_team;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-3 border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.06] to-black/30 p-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">Tip Locked</span>
        <Lock className="h-2.5 w-2.5 text-emerald-500/50 ml-auto" />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className={`text-center p-2 border ${isHome ? "border-emerald-500/30 bg-emerald-500/10" : "border-border/20 bg-black/20"}`}>
          <TeamCrest name={game.home_team} className="mx-auto h-8 w-8 text-[10px]" />
          <p className="mt-1 truncate text-[10px] font-bold text-foreground">{shortName(game.home_team)}</p>
          {isHome && <Star className="mx-auto mt-0.5 h-3 w-3 text-emerald-400" />}
        </div>
        <div className="text-center">
          <p className="font-display text-lg tabular-nums text-foreground">
            <span className={isHome ? "text-emerald-300" : ""}>{scores.home}</span>
            <span className="text-slate-600 mx-1">-</span>
            <span className={!isHome ? "text-emerald-300" : ""}>{scores.away}</span>
          </p>
          <p className="text-[9px] text-slate-500">by {tip.margin} pts</p>
        </div>
        <div className={`text-center p-2 border ${!isHome ? "border-emerald-500/30 bg-emerald-500/10" : "border-border/20 bg-black/20"}`}>
          <TeamCrest name={game.away_team} className="mx-auto h-8 w-8 text-[10px]" />
          <p className="mt-1 truncate text-[10px] font-bold text-foreground">{shortName(game.away_team)}</p>
          {!isHome && <Star className="mx-auto mt-0.5 h-3 w-3 text-emerald-400" />}
        </div>
      </div>
      <p className="mt-2 text-center text-[9px] text-slate-500">
        Locked {new Date(tip.tipped_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
      </p>
    </motion.div>
  );
}
// ── Locked Stamp Overlay ────────────────────────────────────────────
function LockedStamp({ show }) {
  if (!show) return null;
  return (
    <motion.div
      initial={{ scale: 2.5, opacity: 0, rotate: -15 }}
      animate={{ scale: 1, opacity: 1, rotate: -12 }}
      transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.1 }}
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
    >
      <div className="border-4 border-emerald-400/60 px-6 py-2 bg-emerald-500/10 backdrop-blur-sm">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="font-display text-2xl font-black uppercase tracking-[0.3em] text-emerald-400/80"
        >
          LOCKED
        </motion.p>
      </div>
    </motion.div>
  );
}

// ── Fixture Card ────────────────────────────────────────────────────
function FixtureCard({ game, tip, onTip, entries, active, onSelect }) {
  const [selectedTeam, setSelectedTeam] = useState(tip?.selected_team || game.home_team);
  const [margin, setMargin] = useState(tip?.margin || 8);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showStamp, setShowStamp] = useState(false);
  const [showPoints, setShowPoints] = useState(false);
  const lockingRef = useRef(false); // Prevent double-lock race condition
  const scores = deriveScores(game, selectedTeam, margin);
  const status = getStatus(game.kickoff, game.status);
  const timeLocked = status.label === "Locked" || status.label === "Final" || status.label === "Live";
  const alreadyTipped = !!tip;
  const canInteract = !timeLocked && !alreadyTipped && !lockingRef.current; // Once tipped = permanent
  const countdown = useCountdown(game.kickoff);
  const tipResult = checkTipResult(game, tip);

  useEffect(() => {
    if (!alreadyTipped) {
      setSelectedTeam(game.home_team);
      setMargin(8);
    }
  }, [game.id, alreadyTipped, game.home_team]);

  const handleLock = (e) => {
    e.stopPropagation();
    if (!canInteract || lockingRef.current) return;
    // Double-lock prevention with ref
    lockingRef.current = true;
    // Validate before locking
    if (!selectedTeam || margin < 1 || margin > 60) {
      lockingRef.current = false;
      return;
    }
    setShowConfetti(true);
    setShowStamp(true);
    successImpact();
    playLockSound();
    // Screen shake effect (skipped under prefers-reduced-motion)
    try {
      const el = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
        ? null
        : e.currentTarget?.closest('article');
      if (el) {
        el.style.animation = 'none';
        el.offsetHeight; // force reflow
        el.style.animation = 'shake 0.4s ease-out';
      }
    } catch { /* noop */ }
    setTimeout(() => setShowConfetti(false), 1400);
    setTimeout(() => setShowStamp(false), 2500);
    onTip(game, { selected_team: selectedTeam, margin, predicted_home_score: scores.home, predicted_away_score: scores.away });
    // Release lock after animation
    setTimeout(() => { lockingRef.current = false; }, 1500);
  };

  // Show points animation when result first becomes available
  useEffect(() => {
    if (tipResult?.points > 0 && !showPoints) {
      setShowPoints(true);
      setTimeout(() => setShowPoints(false), 2000);
    }
  }, [tipResult]);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      whileHover={!active ? { scale: 1.005 } : {}}
      onClick={onSelect}
      className={`relative overflow-hidden border transition-all cursor-pointer ${
        active
          ? `border-primary/50 bg-gradient-to-b from-primary/[0.06] to-black/40 ${status.glow}`
          : alreadyTipped
            ? "border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.03] to-black/30 hover:border-emerald-500/30"
            : "border-border/30 bg-black/30 hover:border-primary/25"
      }`}
    >
      <ConfettiBurst active={showConfetti} />
      <LockedStamp show={showStamp} />
      <AnimatePresence>
        {showPoints && tipResult?.points > 0 && (
          <PointsPopup key="pts" points={tipResult.points} />
        )}
      </AnimatePresence>

      {/* Top accent bar */}
      <div className={`h-[2px] w-full ${
        status.label === "Live" ? "bg-red-500 animate-pulse"
        : alreadyTipped ? "bg-gradient-to-r from-emerald-500/60 via-emerald-400/40 to-emerald-500/60"
        : "bg-gradient-to-r from-primary/60 via-accent/40 to-primary/60"
      }`} />

      <div className="p-3">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {countdown && (
              <motion.div
                animate={status.label === "Closing" ? { scale: [1, 1.05, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="flex items-center gap-1 border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5"
              >
                <Clock className="h-2.5 w-2.5 text-amber-300" />
                <span className="text-[10px] font-mono font-bold tabular-nums text-amber-200">{countdown}</span>
              </motion.div>
            )}
            <div className="flex items-center gap-1 min-w-0">
              <Calendar className="h-2.5 w-2.5 shrink-0 text-slate-500" />
              <span className="truncate text-[10px] text-slate-400">{formatKickoff(game.kickoff)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {tipResult && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`flex items-center gap-0.5 text-[10px] font-bold ${tipResult.correct ? "text-emerald-400" : "text-red-400"}`}
              >
                {tipResult.correct ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {tipResult.correct
                  ? tipResult.perfectMargin ? `🎯 +${tipResult.points}` : `✅ +${tipResult.points}`
                  : "Wrong"}
              </motion.span>
            )}
            <span className={`border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] ${
              alreadyTipped && !timeLocked
                ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                : status.tone
            }`}>
              {status.label === "Live" && <Radio className="inline h-2.5 w-2.5 mr-0.5 animate-pulse" />}
              {alreadyTipped && !timeLocked ? "✓ Locked" : status.label}
            </span>
          </div>
        </div>

        {/* Round + venue */}
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-500">
          <span className="font-bold uppercase tracking-[0.15em] text-primary/70">{game.label || "NRL Fixture"}</span>
          {game.venue && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5 truncate">
                <MapPin className="h-2.5 w-2.5 shrink-0" />{game.venue}
              </span>
            </>
          )}
          {status.label === "Closing" && (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="flex items-center gap-0.5 text-red-400 font-bold"
            >
              <Flame className="h-2.5 w-2.5" /> Hot
            </motion.span>
          )}
        </div>

        {/* === STATE 1: FINISHED MATCH === */}
        {game.status === "finished" && game.home_score != null ? (
          <div className="mt-3 border border-border/25 bg-black/50 p-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              {[game.home_team, game.away_team].map((team) => {
                const isWinner = (team === game.home_team ? game.home_score : game.away_score) >
                  (team === game.home_team ? game.away_score : game.home_score);
                const tippedThis = tipResult?.correct && tip?.selected_team === team;
                return (
                  <div key={team} className={`text-center p-1.5 ${tippedThis ? "ring-1 ring-emerald-500/30 bg-emerald-500/5" : ""}`}>
                    <TeamCrest name={team} className={`mx-auto h-10 w-10 text-xs ${!isWinner ? "opacity-60" : ""}`} />
                    <p className={`mt-1 truncate text-[9px] font-bold ${isWinner ? "text-foreground" : "text-slate-500"}`}>
                      {shortName(team)}
                    </p>
                    {isWinner && <Trophy className="mx-auto mt-0.5 h-3 w-3 text-amber-400" />}
                  </div>
                );
              }).reduce((arr, el, i) => i === 0 ? [el] : [...arr, (
                <div key="score" className="text-center">
                  <div className="flex items-baseline gap-1.5">
                    <motion.span
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className="font-display text-2xl tabular-nums text-foreground"
                    >
                      {game.home_score}
                    </motion.span>
                    <span className="text-xs text-slate-600">-</span>
                    <motion.span
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                      className="font-display text-2xl tabular-nums text-foreground"
                    >
                      {game.away_score}
                    </motion.span>
                  </div>
                  <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Full time</p>
                </div>
              ), el], [])}
            </div>
            {tip && tipResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-2 border-t border-border/20 pt-2 text-center text-[9px] ${tipResult.correct ? "text-emerald-400" : "text-red-400"}`}
              >
                {tipResult.correct
                  ? tipResult.perfectMargin
                    ? `🎯 Perfect call! +${tipResult.points} points`
                    : `✅ Winner picked! Margin off by ${tipResult.marginDiff}. +${tipResult.points} points`
                  : `❌ Tipped ${shortName(tip.selected_team)}. Actual margin: ${tipResult.actualMargin}.`}
              </motion.div>
            )}
          </div>

        /* === STATE 2: ALREADY TIPPED (locked — no changes allowed) === */
        ) : alreadyTipped ? (
          <LockedTipReceipt game={game} tip={tip} />

        /* === STATE 3: OPEN FOR TIPPING === */
        ) : (
          <>
            {/* Team Picker */}
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              {[game.home_team, game.away_team].map((team) => {
                const selected = selectedTeam === team;
                return (
                  <motion.button
                    key={team}
                    type="button"
                    disabled={!canInteract}
                    whileTap={canInteract ? { scale: 0.95 } : {}}
                onClick={(e) => { e.stopPropagation(); playSelectSound(team === game.home_team); setSelectedTeam(team); }}
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
                    {/* Light beam behind selected team */}
                    {selected && (
                      <motion.div
                        initial={{ opacity: 0, scaleY: 0 }}
                        animate={{ opacity: 0.15, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0 }}
                        className="absolute inset-x-0 top-0 bottom-0 bg-gradient-to-b from-primary via-primary/50 to-transparent origin-top -z-10"
                      />
                    )}
                    <p className="mt-1.5 truncate text-[9px] font-bold uppercase tracking-wide">{shortName(team)}</p>
                    {selected && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-1 top-1">
                        <Star className="h-3 w-3 text-primary" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
              <div className="text-center">
                <motion.p
                  key={selectedTeam}
                  initial={{ scale: 1.3, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="font-display text-xl text-primary/80"
                >
                  VS
                </motion.p>
              </div>
            </div>

            {/* Margin slider + quick-picks */}
            <div className="mt-3 border border-border/20 bg-black/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Win margin</span>
                <div className="flex items-baseline gap-1">
                  <motion.span
                    key={margin}
                    initial={{ scale: 1.3, color: "hsl(var(--primary))" }}
                    animate={{ scale: 1, color: "hsl(var(--foreground))" }}
                    className="font-display text-2xl tabular-nums"
                  >
                    {margin}
                  </motion.span>
                  <span className="text-[10px] text-slate-500">pts</span>
                </div>
              </div>
              {/* Quick-pick margin buttons */}
              <div className="mt-2 flex items-center gap-1">
                {MARGIN_PRESETS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={!canInteract}
                    onClick={(e) => { e.stopPropagation(); selectionChanged(); setMargin(m); }}
                    className={`flex-1 min-h-[28px] text-[10px] font-bold font-mono border transition-all ${
                      margin === m
                        ? "border-primary/50 bg-primary/20 text-primary"
                        : "border-border/20 bg-black/20 text-slate-500 hover:border-primary/25 hover:text-slate-300"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <input
                type="range" min="1" max="40" value={margin}
                disabled={!canInteract}
                onChange={(e) => setMargin(Number(e.target.value))}
                className="mt-2 w-full accent-primary"
                aria-label="Win margin prediction"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Your prediction</span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-foreground">
                  <span className={selectedTeam === game.home_team ? "text-primary" : ""}>{scores.home}</span>
                  <span className="text-slate-600">-</span>
                  <span className={selectedTeam === game.away_team ? "text-primary" : ""}>{scores.away}</span>
                </span>
              </div>
            </div>

            <CommunityPulse game={game} entries={entries} tip={tip} />

            {/* Lock button — one-time permanent action */}
            <motion.button
              type="button"
              disabled={!canInteract}
              whileTap={canInteract ? { scale: 0.94 } : {}}
              whileHover={canInteract ? { boxShadow: "0 0 28px hsl(var(--primary) / 0.35)" } : {}}
              onClick={handleLock}
              aria-label={timeLocked ? "Game has started" : `Lock tip for ${shortName(selectedTeam)} by ${margin} points`}
              className={`mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${
                timeLocked
                  ? "bg-slate-800/50 text-slate-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-primary via-accent to-primary text-white shadow-[0_0_16px_hsl(var(--primary)/0.2)] hover:shadow-[0_0_28px_hsl(var(--primary)/0.35)] active:scale-95"
              }`}
            >
              {timeLocked ? (
                <><Shield className="h-3.5 w-3.5" /> Game Started</>
              ) : (
                <>
                  <motion.div
                    animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 3 }}
                  >
                    <Target className="h-4 w-4" />
                  </motion.div>
                  <span>Lock My Tip</span>
                  <Lock className="h-3 w-3 opacity-60" />
                </>
              )}
            </motion.button>
          </>
        )}
      </div>
    </motion.article>
  );
}

function CommunityPulse({ game, entries, tip }) {
  const gameEntries = entries.filter((e) => e.game_id === game.id);
  const home = gameEntries.filter((e) => e.selected_team === game.home_team).length;
  const away = gameEntries.filter((e) => e.selected_team === game.away_team).length;
  const total = Math.max(home + away, 1);
  const homePct = Math.round((home / total) * 100) || 50;
  const awayPct = 100 - homePct;
  const userPicked = tip?.selected_team;

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.2em]">
        <span className="text-slate-500 flex items-center gap-1">
          <Users className="h-2.5 w-2.5" /> Community pulse
        </span>
        <div className="flex items-center gap-2">
          {userPicked && (
            <span className="flex items-center gap-0.5 text-emerald-400/80">
              <CheckCircle2 className="h-2 w-2" /> You: {shortName(userPicked)}
            </span>
          )}
          <span className="text-slate-500">{gameEntries.length || "—"} tips</span>
        </div>
      </div>
      <div className="relative flex h-8 overflow-hidden border border-border/20 bg-black/40">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${homePct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`flex items-center justify-start gap-1 pl-1.5 bg-gradient-to-r from-primary/50 to-primary/15 ${
            userPicked === game.home_team ? 'ring-1 ring-inset ring-primary/40' : ''
          }`}
        >
          <TeamCrest name={game.home_team} className="h-4 w-4 text-[9px] shrink-0" />
          <span className="text-[10px] font-bold text-white/90 truncate">{homePct}%</span>
        </motion.div>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${awayPct}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
          className={`flex items-center justify-end gap-1 pr-1.5 bg-gradient-to-l from-accent/50 to-accent/15 ${
            userPicked === game.away_team ? 'ring-1 ring-inset ring-accent/40' : ''
          }`}
        >
          <span className="text-[10px] font-bold text-white/90 truncate">{awayPct}%</span>
          <TeamCrest name={game.away_team} className="h-4 w-4 text-[9px] shrink-0" />
        </motion.div>
      </div>
      {/* Social proof */}
      {gameEntries.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="flex -space-x-1">
            {Array.from({ length: Math.min(gameEntries.length, 4) }).map((_, i) => (
              <div key={i} className="h-4 w-4 rounded-full border border-black bg-gradient-to-br from-slate-600 to-slate-700" />
            ))}
            {gameEntries.length > 4 && (
              <div className="h-4 w-4 rounded-full border border-black bg-primary/20 flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary">+{gameEntries.length - 4}</span>
              </div>
            )}
          </div>
          <span className="text-[9px] text-slate-500">
            {gameEntries.length} fan{gameEntries.length !== 1 ? 's' : ''} tipped
          </span>
        </div>
      )}
    </div>
  );
}

function Leaderboard({ entries, tips, totalPoints, myName }) {
  const community = useMemo(() => {
    const totals = new Map();
    const seen = new Set();
    entries.forEach((entry) => {
      const key = `${entry.game_id}-${entry.tipper_name || "Mystery Fan"}`;
      if (seen.has(key)) return;
      seen.add(key);
      const name = entry.tipper_name || "Mystery Fan";
      // The signed-in tipper already appears as the "You" row
      if (myName && name === myName) return;
      const curr = totals.get(name) || { name, tips: 0 };
      curr.tips += 1;
      totals.set(name, curr);
    });
    // Rank by tips locked (participation) — the only metric verifiable for
    // every fan here (per-rival correctness needs finished-fixture results
    // that this component isn't given). "You" additionally carries real points.
    const yours = { name: "You", tips: Object.keys(tips).length, points: totalPoints, me: true };
    return [yours, ...Array.from(totals.values())]
      .filter((r) => r.tips > 0)
      .sort((a, b) => (b.tips || 0) - (a.tips || 0))
      .slice(0, 8);
  }, [entries, tips, totalPoints, myName]);

  const medals = ["🥇", "🥈", "🥉"];
  const maxTips = Math.max(1, ...community.map((r) => r.tips || 0));

  return (
    <div className="border border-border/30 bg-black/30 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="h-3.5 w-3.5 text-amber-400" />
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300">Tipster Ladder</p>
        </div>
        <span className="text-[9px] text-slate-500">{PTS_CORRECT}pt/correct · {PTS_MARGIN_BONUS}pt margin bonus</span>
      </div>
      <div className="space-y-1.5">
        {community.length ? community.map((row, i) => {
          const barWidth = Math.max(8, ((row.tips || 0) / maxTips) * 100);
          return (
          <motion.div
            key={`${row.name}-${i}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`relative flex items-center gap-2 border p-2 overflow-hidden ${
              row.me
                ? "border-primary/30 bg-gradient-to-r from-primary/10 to-transparent"
                : i === 0
                ? "border-amber-400/20 bg-gradient-to-r from-amber-500/[0.06] to-transparent"
                : "border-border/15 bg-black/20"
            }`}
          >
            {/* Background progress bar */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${barWidth}%` }}
              transition={{ duration: 0.8, delay: i * 0.05, ease: "easeOut" }}
              className={`absolute inset-y-0 left-0 ${
                row.me ? "bg-primary/[0.08]" : i === 0 ? "bg-amber-400/[0.06]" : "bg-white/[0.02]"
              }`}
            />
            <span className="relative w-5 text-center text-xs">
              {i === 0 && !row.me ? "👑" : medals[i] || `${i + 1}`}
            </span>
            <div className="relative min-w-0 flex-1">
              <p className={`truncate text-xs font-bold ${
                row.me ? "text-primary" : i === 0 ? "text-amber-200" : "text-foreground"
              }`}>
                {row.name}
              </p>
              <p className="text-[9px] text-slate-500">{row.tips} tip{row.tips !== 1 ? 's' : ''} locked</p>
            </div>
            <div className="relative flex items-center gap-2">
              {row.me && row.points > 0 && (
                <span className="text-2xs font-bold tabular-nums text-primary">{row.points} pts</span>
              )}
              <span className={`text-[11px] font-bold tabular-nums ${
                row.me ? "text-primary" : i === 0 ? "text-amber-300" : "text-foreground/80"
              }`}>{row.tips}</span>
              <span className="text-2xs text-slate-500">tips</span>
            </div>
          </motion.div>
          );
        }) : (
          <p className="text-xs text-slate-500">Be first to lock a tip.</p>
        )}
      </div>
    </div>
  );
}

// ── Main Export ──────────────────────────────────────────────────────
export default function ScorePredictor({ onSharePrediction }) {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const tipperName = (isAuthenticated && (user?.full_name || user?.email)) || "Vegas Fan";
  const [tips, setTips] = useState(() => sanitizeTips(readJson(STORAGE_KEY, {})));
  const [filter, setFilter] = useState("near");
  const [activeGameId, setActiveGameId] = useState("");
  const [dataCorrupted, setDataCorrupted] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const queriesEnabled = appParams.hasBase44Config;

  // Persistent points
  const [totalPoints, setTotalPoints] = useState(() => readJson(POINTS_KEY, 0));

  // Cross-tab sync: listen for localStorage changes from other tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        try {
          const updated = sanitizeTips(JSON.parse(e.newValue || '{}'));
          setTips(updated);
        } catch { /* ignore invalid */ }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Corruption detection
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && typeof JSON.parse(raw) !== 'object') {
        setDataCorrupted(true);
      }
    } catch {
      setDataCorrupted(true);
    }
  }, []);

  // ── Real NRL fixtures from RugbyAPI2 ──
  const { data: apiFixtures = [], isLoading: apiLoading, isError: apiError, refetch: retryApi } = useQuery({
    queryKey: ["nrlApiFixtures"],
    queryFn: fetchUpcomingFixtures,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
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

  // Recalculate total points from results
  useEffect(() => {
    let pts = 0;
    fixtures.forEach((g) => {
      const result = checkTipResult(g, tips[g.id]);
      if (result) pts += result.points;
    });
    if (pts !== totalPoints) {
      setTotalPoints(pts);
      writeJson(POINTS_KEY, pts);
    }
  }, [fixtures, tips]);

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
    // Routed through submitTip so the kickoff deadline is enforced server-side
    // (TippingEntry.create is admin-only; the client UI lock alone is bypassable).
    mutationFn: (payload) => base44.functions.invoke("submitTip", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tippingEntries"] }),
  });

  const handleTip = useCallback((game, tip) => {
    // Tips are permanent — only allow if not already tipped
    if (tips[game.id]) return;

    // Validate the tip before accepting
    const tipObj = {
      ...tip,
      game_id: game.id,
      home_team: game.home_team,
      away_team: game.away_team,
      kickoff: game.kickoff,
      tipped_at: new Date().toISOString(),
    };
    if (!isValidTip(tipObj)) {
      console.warn('[RLT] Invalid tip rejected:', tipObj);
      return;
    }

    const next = { ...tips, [game.id]: tipObj };
    setTips(next);
    writeJson(STORAGE_KEY, next);
    writeJson(PROFILE_KEY, { streak: Math.max(1, Object.keys(next).length), updated_at: new Date().toISOString() });
    try {
      localStorage.setItem(`rlt_match_voted_${game.id}`, "true");
      window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "tip_locked" } }));
    } catch { /* ignore */ }

    const serverPayload = {
      game_id: game.id,
      game_label: game.label || "NRL Fixture",
      home_team: game.home_team,
      away_team: game.away_team,
      selected_team: tip.selected_team,
      predicted_home_score: tip.predicted_home_score,
      predicted_away_score: tip.predicted_away_score,
      margin: tip.margin,
      tipper_name: tipperName,
      kickoff: game.kickoff,
    };
    if (queriesEnabled) {
      createTip.mutate(
        serverPayload,
        {
          onSuccess: () => removeTipFromQueue(game.id),
          onError: (err) => {
            // Don't lose the tip: queue it for retry on reconnect/next visit.
            console.warn('[RLT] Failed to sync tip to server:', err);
            enqueueTip(serverPayload);
            warningImpact();
            toast({
              title: "Tip locked on this device",
              description: "We couldn't reach the server — it will sync automatically before kickoff.",
            });
          },
        }
      );
    }
  }, [tips, queriesEnabled, createTip, tipperName]);

  // Flush tips that failed to sync (offline lock-ins) — on mount + reconnect.
  // prunedTipQueue drops entries whose kickoff has passed (server would reject).
  useEffect(() => {
    if (!queriesEnabled) return undefined;
    const flush = () => {
      prunedTipQueue().forEach((payload) => {
        base44.functions
          .invoke("submitTip", payload)
          .then(() => {
            removeTipFromQueue(payload.game_id);
            queryClient.invalidateQueries({ queryKey: ["tippingEntries"] });
          })
          .catch(() => { /* still unreachable — stays queued */ });
      });
    };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [queriesEnabled, queryClient]);

  // Reset handler (for corruption recovery)
  const handleResetTips = useCallback(() => {
    setTips({});
    setTotalPoints(0);
    writeJson(STORAGE_KEY, {});
    writeJson(POINTS_KEY, 0);
    setDataCorrupted(false);
    setShowResetConfirm(false);
  }, []);

  const handleShare = () => {
    if (!activeGame || !onSharePrediction) return;
    const tip = tips[activeGame.id] || { selected_team: activeGame.home_team, margin: 8, ...deriveScores(activeGame, activeGame.home_team, 8) };
    const homeScore = tip.predicted_home_score ?? tip.home ?? 24;
    const awayScore = tip.predicted_away_score ?? tip.away ?? 16;
    onSharePrediction(activeGame, homeScore, awayScore);
    try { window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "share_tip" } })); } catch { /* ignore */ }
  };

  const tippedCount = fixtures.filter((g) => tips[g.id]).length;
  const untippedUpcoming = fixtures.filter((g) => !tips[g.id] && g.status !== "finished").length;

  return (
    <div className="overflow-hidden border border-border/50 bg-gradient-to-b from-card/40 to-black/60 cmd-glass">
      {/* Premium accent bar */}
      <div className="h-[3px] w-full bg-gradient-to-r from-primary via-accent to-primary" />

      <div className="p-4 sm:p-5">
        {/* Data corruption banner */}
        {dataCorrupted && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-4 border border-amber-500/30 bg-amber-500/5 p-3"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-amber-300">Tips data may be corrupted</p>
                <p className="text-[9px] text-amber-400/60 mt-0.5">Some saved tips couldn't be read. You can reset to start fresh.</p>
              </div>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="shrink-0 flex items-center gap-1 px-2 py-1 border border-amber-500/30 bg-amber-500/10 text-[10px] font-bold uppercase text-amber-300 hover:bg-amber-500/20 transition-colors"
              >
                <RefreshCw className="h-3 w-3" /> Reset
              </button>
            </div>
          </motion.div>
        )}

        {/* Reset confirmation dialog */}
        <AnimatePresence>
          {showResetConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setShowResetConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="border border-border bg-card cmd-glass p-6 max-w-sm mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-500/10 border border-red-500/20">
                    <Trash2 className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <h4 className="font-display text-lg uppercase">Reset All Tips?</h4>
                    <p className="text-[11px] text-muted-foreground">This will permanently delete all your saved tips and points.</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-4 py-2 border border-border text-xs uppercase tracking-wider font-bold hover:bg-muted/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetTips}
                    className="px-4 py-2 bg-red-500 text-white text-xs uppercase tracking-wider font-bold hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="inline h-3 w-3 mr-1" /> Delete Everything
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative border border-primary/25 bg-gradient-to-br from-primary/15 to-primary/5 p-2.5">
              <Trophy className="h-5 w-5 text-primary" />
              {untippedUpcoming > 0 && (
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white"
                >
                  {untippedUpcoming}
                </motion.span>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-lg uppercase leading-none tracking-wide text-foreground">
                Footy Tipping
              </h3>
              <p className="mt-1 text-[9px] font-mono uppercase tracking-[0.3em] text-slate-400">
                NRL 2026 · {totalPoints} pts · {tippedCount}/{fixtures.length} tipped
              </p>
              {/* Mini progress bar */}
              {fixtures.length > 0 && (
                <div className="mt-1.5 h-1 w-full max-w-[140px] bg-black/40 overflow-hidden border border-border/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round((tippedCount / fixtures.length) * 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-primary to-accent"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {totalPoints > 0 && (
              <span className="flex items-center gap-1 border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                <Flame className="h-3 w-3" /> {totalPoints} pts
              </span>
            )}
            {apiLoading && (
              <span className="text-[9px] text-slate-500 animate-pulse">Loading fixtures…</span>
            )}
            {apiError && (
              <button
                onClick={() => retryApi()}
                className="flex items-center gap-1 text-[9px] text-red-400 hover:text-red-300 transition-colors"
              >
                <AlertTriangle className="h-2.5 w-2.5" /> API Error
                <RefreshCw className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-4">
          <HeroStats tips={tips} fixtures={fixtures} totalPoints={totalPoints} />
        </div>

        {/* Filter tabs */}
        <div className="mt-4 grid grid-cols-3 border border-border/30 bg-black/30 p-0.5">
          {[
            { id: "near", label: "Upcoming", icon: Clock, count: untippedUpcoming },
            { id: "all", label: "Full Draw", icon: BarChart3 },
            { id: "mine", label: "My Tips", icon: Target, count: tippedCount },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`relative flex items-center justify-center gap-1 min-h-9 text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${
                filter === item.id
                  ? "text-primary-foreground"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {filter === item.id && (
                <motion.div
                  layoutId="filter-indicator"
                  className="absolute inset-0 bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1">
                <item.icon className="h-3 w-3" />
                {item.label}
                {item.count > 0 && (
                  <span className={`ml-0.5 text-[9px] ${filter === item.id ? "opacity-80" : "text-primary"}`}>
                    ({item.count})
                  </span>
                )}
              </span>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-accent" />
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/80">Featured Match</p>
              </div>
              {tips[activeGame.id] && (
                <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Tipped
                </span>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <motion.div
                className="min-w-0 text-center flex-1"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <TeamCrest name={activeGame.home_team} className="mx-auto h-12 w-12 text-xs" />
                <p className="mt-1 truncate text-[10px] font-bold text-foreground">{shortName(activeGame.home_team)}</p>
              </motion.div>
              <div className="text-center px-2">
                {activeGame.status === "finished" && activeGame.home_score != null ? (
                  <>
                    <motion.p
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                      className="font-display text-xl text-foreground"
                    >
                      {activeGame.home_score} - {activeGame.away_score}
                    </motion.p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider">Final</p>
                  </>
                ) : (
                  <>
                    <motion.p
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="font-display text-2xl text-primary/80"
                    >
                      VS
                    </motion.p>
                    <p className="text-[9px] text-slate-500">{formatKickoff(activeGame.kickoff)}</p>
                  </>
                )}
              </div>
              <motion.div
                className="min-w-0 text-center flex-1"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.15 }}
              >
                <TeamCrest name={activeGame.away_team} className="mx-auto h-12 w-12 text-xs" />
                <p className="mt-1 truncate text-[10px] font-bold text-foreground">{shortName(activeGame.away_team)}</p>
              </motion.div>
            </div>
            <button
              type="button"
              onClick={handleShare}
              className="group mt-3 flex min-h-9 w-full items-center justify-center gap-2 border border-primary/25 bg-black/30 text-[9px] font-bold uppercase tracking-[0.2em] text-primary transition-all hover:bg-primary hover:text-primary-foreground"
            >
              <Share2 className="h-3 w-3 transition-transform group-hover:rotate-12" /> Share To Forum
            </button>
          </motion.div>
        )}

        {/* Fixture cards grouped by round */}
        <div className="mt-4 space-y-2">
          <AnimatePresence mode="popLayout">
            {groupedFixtures.map((group) => (
              <div key={group.label}>
                <RoundBadge label={group.label} games={group.games} tips={tips} />
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
              {apiLoading ? (
                <>
                  <div className="mx-auto h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="mt-3 text-xs font-bold text-slate-400">Loading real NRL fixtures…</p>
                  <p className="mt-1 text-[9px] text-slate-500">Connecting to live data feed</p>
                </>
              ) : apiError ? (
                <>
                  <AlertTriangle className="mx-auto h-8 w-8 text-amber-400/60" />
                  <p className="mt-2 text-xs font-bold text-amber-300">Couldn't load fixtures</p>
                  <p className="mt-1 text-[9px] text-slate-500">The NRL data feed is temporarily unavailable.</p>
                  <button
                    onClick={() => retryApi()}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 border border-primary/30 bg-primary/10 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" /> Try Again
                  </button>
                </>
              ) : filter === "mine" ? (
                <>
                  <Target className="mx-auto h-8 w-8 text-slate-600" />
                  <p className="mt-2 text-xs font-bold text-slate-400">No tips locked yet</p>
                  <p className="mt-1 text-[9px] text-slate-500">Pick your winners and lock them in!</p>
                  <button onClick={() => setFilter("near")} className="mt-3 inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                    Browse upcoming games <ArrowRight className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <>
                  <Shield className="mx-auto h-8 w-8 text-slate-600" />
                  <p className="mt-2 text-xs font-bold text-slate-400">No fixtures available</p>
                  <p className="mt-1 text-[9px] text-slate-500">Check back later for the latest NRL draw.</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Bottom panels */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Leaderboard entries={entries} tips={tips} totalPoints={totalPoints} myName={isAuthenticated ? tipperName : ""} />
          <div className="border border-border/30 bg-black/30 p-3">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300">How It Works</p>
            </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { step: 1, icon: Target, color: "text-primary", text: "Pick a winner & set your margin prediction" },
              { step: 2, icon: Lock, color: "text-amber-400", text: "Lock it in \u2014 tips are permanent. No take-backs!" },
              { step: 3, icon: Award, color: "text-emerald-400", text: `+${PTS_CORRECT}pts correct pick, +${PTS_MARGIN_BONUS}pts perfect margin bonus` },
              { step: 4, icon: Trophy, color: "text-amber-400", text: "Climb the ladder \u2014 results update live from the NRL API" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-2.5 p-2 border border-border/10 bg-black/20">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center bg-primary/10 border border-primary/20">
                  <span className="text-[10px] font-black text-primary">{item.step}</span>
                </div>
                <div className="flex items-start gap-1.5 min-w-0">
                  <item.icon className={`mt-0.5 h-3 w-3 shrink-0 ${item.color}`} />
                  <p className="text-[10px] leading-relaxed text-slate-400">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-border/15 pt-3 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-primary/60" /> Live tipping hub
          </span>
          <span className="flex items-center gap-1.5">
            <Flame className="h-3 w-3 text-amber-400/60" /> {totalPoints} pts earned
          </span>
        </div>
      </div>
    </div>
  );
}