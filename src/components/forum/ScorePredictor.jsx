import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Users, Share2, TrendingUp, Calendar, Shield,
  Target, CheckCircle2, Zap, Crown, Lock, Pencil,
  Radio, Clock, MapPin, Star, BarChart3, XCircle,
  Flame, Award, AlertTriangle, RefreshCw, Trash2, Wand2, Minus, Plus,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import { fetchUpcomingFixtures } from "@/lib/nrl-api";
import TeamCrest from "@/components/public/TeamCrest";
import {
  STORAGE_KEY, PROFILE_KEY, POINTS_KEY, TIP_STREAK_KEY, MARGIN_PRESETS, DEFAULT_MARGIN,
} from "@/components/forum/tipping/constants";
import { readJson, writeJson } from "@/components/forum/tipping/storage";
import {
  isValidTip, sanitizeTips, shortName, deriveScores, getStatus, checkTipResult,
  isFinishedGame, hasKickedOff, isTippable, formatKickoffLocal,
  buildRounds, defaultRoundIndex, computeStreaks, communityFavourite, shortRoundLabel,
} from "@/components/forum/tipping/tipHelpers";
import { playLockSound, playSelectSound } from "@/components/forum/tipping/audio";
import { useCountdown } from "@/components/forum/tipping/hooks";
import { successImpact, selectionChanged, warningImpact } from "@/lib/native/haptics";
import { enqueueTip, removeTipFromQueue, prunedTipQueue } from "@/lib/tip-sync-queue";
import { toast } from "@/components/ui/use-toast";
import ConfettiBurst from "@/components/forum/tipping/ConfettiBurst";
import PointsPopup from "@/components/forum/tipping/PointsPopup";
import HeroStats from "@/components/forum/tipping/HeroStats";
import RoundNav from "@/components/forum/tipping/RoundNav";
import RoundRecap from "@/components/forum/tipping/RoundRecap";
import TipLadder from "@/components/forum/tipping/TipLadder";

// ── Locked Tip Receipt ──────────────────────────────────────────────
// Editable until kickoff — the lock is the siren, not the first submission,
// exactly like the big tipping platforms.
function LockedTipReceipt({ game, tip, canEdit, onEdit, onShare }) {
  const isHome = tip.selected_team === game.home_team;
  const home = tip.predicted_home_score ?? deriveScores(game, tip.selected_team, tip.margin).home;
  const away = tip.predicted_away_score ?? deriveScores(game, tip.selected_team, tip.margin).away;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-3 border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.06] to-black/30 p-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">
          {canEdit ? "Tip In" : "Tip Locked"}
        </span>
        <Lock className="ml-auto h-2.5 w-2.5 text-emerald-500/50" />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className={`border p-2 text-center ${isHome ? "border-emerald-500/30 bg-emerald-500/10" : "border-border/20 bg-black/20"}`}>
          <TeamCrest name={game.home_team} className="mx-auto h-8 w-8 text-[10px]" />
          <p className="mt-1 truncate text-[10px] font-bold text-foreground">{shortName(game.home_team)}</p>
          {isHome && <Star className="mx-auto mt-0.5 h-3 w-3 text-emerald-400" />}
        </div>
        <div className="text-center">
          <p className="font-display text-lg tabular-nums text-foreground">
            <span className={isHome ? "text-emerald-300" : ""}>{home}</span>
            <span className="mx-1 text-slate-600">-</span>
            <span className={!isHome ? "text-emerald-300" : ""}>{away}</span>
          </p>
          <p className="text-[9px] text-slate-500">by {tip.margin} pts</p>
        </div>
        <div className={`border p-2 text-center ${!isHome ? "border-emerald-500/30 bg-emerald-500/10" : "border-border/20 bg-black/20"}`}>
          <TeamCrest name={game.away_team} className="mx-auto h-8 w-8 text-[10px]" />
          <p className="mt-1 truncate text-[10px] font-bold text-foreground">{shortName(game.away_team)}</p>
          {!isHome && <Star className="mx-auto mt-0.5 h-3 w-3 text-emerald-400" />}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex min-h-8 flex-1 items-center justify-center gap-1 border border-border/40 bg-black/30 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-300 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Pencil className="h-3 w-3" /> Edit tip
          </button>
        )}
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="flex min-h-8 flex-1 items-center justify-center gap-1 border border-border/40 bg-black/30 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-300 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Share2 className="h-3 w-3" /> Share
          </button>
        )}
      </div>
      {canEdit ? (
        <p className="mt-1.5 text-center text-[9px] text-slate-500">
          You can change this until kickoff
        </p>
      ) : (
        <p className="mt-1.5 text-center text-[9px] text-slate-500">
          Locked {new Date(tip.tipped_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
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
      <div className="border-4 border-emerald-400/60 bg-emerald-500/10 px-6 py-2 backdrop-blur-sm">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="font-display text-2xl font-black uppercase tracking-[0.3em] text-emerald-400/80"
        >
          TIP IN
        </motion.p>
      </div>
    </motion.div>
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
        <span className="flex items-center gap-1 text-slate-500">
          <Users className="h-2.5 w-2.5" /> Community pulse
        </span>
        <span className="text-slate-500">{gameEntries.length || "—"} tips</span>
      </div>
      <div className="relative flex h-7 overflow-hidden border border-border/20 bg-black/40">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${homePct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`flex items-center justify-start gap-1 bg-gradient-to-r from-primary/50 to-primary/15 pl-1.5 ${
            userPicked === game.home_team ? "ring-1 ring-inset ring-primary/40" : ""
          }`}
        >
          <TeamCrest name={game.home_team} className="h-4 w-4 shrink-0 text-[9px]" />
          <span className="truncate text-[10px] font-bold text-white/90">{homePct}%</span>
        </motion.div>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${awayPct}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
          className={`flex items-center justify-end gap-1 bg-gradient-to-l from-accent/50 to-accent/15 pr-1.5 ${
            userPicked === game.away_team ? "ring-1 ring-inset ring-accent/40" : ""
          }`}
        >
          <span className="truncate text-[10px] font-bold text-white/90">{awayPct}%</span>
          <TeamCrest name={game.away_team} className="h-4 w-4 shrink-0 text-[9px]" />
        </motion.div>
      </div>
    </div>
  );
}

// ── Fixture Card ────────────────────────────────────────────────────
function FixtureCard({ game, tip, onTip, entries, editing, onStartEdit, onCancelEdit, onShare }) {
  const [selectedTeam, setSelectedTeam] = useState(tip?.selected_team || game.home_team);
  const [margin, setMargin] = useState(tip?.margin || DEFAULT_MARGIN);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showStamp, setShowStamp] = useState(false);
  const [showPoints, setShowPoints] = useState(false);
  const lockingRef = useRef(false);
  const scores = deriveScores(game, selectedTeam, margin);
  const status = getStatus(game.kickoff, game.status);
  const finished = isFinishedGame(game);
  const kickedOff = hasKickedOff(game);
  const open = isTippable(game);
  const alreadyTipped = !!tip;
  const showPicker = open && (!alreadyTipped || editing);
  const canInteract = showPicker && !lockingRef.current;
  const countdown = useCountdown(game.kickoff);
  const tipResult = checkTipResult(game, tip);

  // Prefill from the existing tip when entering edit mode; reset to defaults
  // when the card flips to a different untipped game.
  useEffect(() => {
    if (tip) {
      setSelectedTeam(tip.selected_team);
      setMargin(tip.margin);
    } else {
      setSelectedTeam(game.home_team);
      setMargin(DEFAULT_MARGIN);
    }
  }, [game.id, editing, alreadyTipped, game.home_team]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLock = (e) => {
    e.stopPropagation();
    if (!canInteract || lockingRef.current) return;
    lockingRef.current = true;
    if (!selectedTeam || margin < 1 || margin > 60) {
      lockingRef.current = false;
      return;
    }
    const isEdit = alreadyTipped;
    if (!isEdit) {
      setShowConfetti(true);
      setShowStamp(true);
      playLockSound();
      setTimeout(() => setShowConfetti(false), 1400);
      setTimeout(() => setShowStamp(false), 2000);
    }
    successImpact();
    onTip(game, { selected_team: selectedTeam, margin, predicted_home_score: scores.home, predicted_away_score: scores.away }, { isEdit });
    if (isEdit) onCancelEdit?.();
    setTimeout(() => { lockingRef.current = false; }, 1200);
  };

  const bumpMargin = (delta) => {
    if (!canInteract) return;
    selectionChanged();
    setMargin((m) => Math.min(60, Math.max(1, m + delta)));
  };

  // Points pop when the result first lands
  useEffect(() => {
    if (tipResult?.points > 0 && !showPoints) {
      setShowPoints(true);
      const t = setTimeout(() => setShowPoints(false), 2000);
      return () => clearTimeout(t);
    }
  }, [tipResult]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`relative overflow-hidden border transition-colors ${
        alreadyTipped && !finished
          ? "border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.03] to-black/30"
          : "border-border/30 bg-black/30"
      } ${status.glow}`}
    >
      <ConfettiBurst active={showConfetti} />
      <LockedStamp show={showStamp} />
      <AnimatePresence>
        {showPoints && tipResult?.points > 0 && <PointsPopup key="pts" points={tipResult.points} />}
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
          <div className="flex min-w-0 items-center gap-2">
            {countdown && !kickedOff && (
              <div className="flex items-center gap-1 border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5">
                <Clock className="h-2.5 w-2.5 text-amber-300" />
                <span className="text-[10px] font-mono font-bold tabular-nums text-amber-200">{countdown}</span>
              </div>
            )}
            <div className="flex min-w-0 items-center gap-1">
              <Calendar className="h-2.5 w-2.5 shrink-0 text-slate-500" />
              <span className="truncate text-[10px] text-slate-400">{formatKickoffLocal(game.kickoff)}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
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
              alreadyTipped && open
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : status.tone
            }`}>
              {status.label === "Live" && <Radio className="mr-0.5 inline h-2.5 w-2.5 animate-pulse" />}
              {alreadyTipped && open ? "✓ Tipped" : status.label}
            </span>
          </div>
        </div>

        {/* Venue line */}
        {(game.venue || status.label === "Closing") && (
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-500">
            {game.venue && (
              <span className="flex items-center gap-0.5 truncate">
                <MapPin className="h-2.5 w-2.5 shrink-0" />{game.venue}
              </span>
            )}
            {status.label === "Closing" && !alreadyTipped && (
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="flex items-center gap-0.5 font-bold text-red-400"
              >
                <Flame className="h-2.5 w-2.5" /> Closing soon
              </motion.span>
            )}
          </div>
        )}

        {/* === STATE 1: FINISHED MATCH === */}
        {finished ? (
          <div className="mt-3 border border-border/25 bg-black/50 p-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              {[game.home_team, game.away_team].map((team) => {
                const teamScore = team === game.home_team ? game.home_score : game.away_score;
                const otherScore = team === game.home_team ? game.away_score : game.home_score;
                const isWinner = teamScore > otherScore;
                const tippedThis = tipResult?.correct && tip?.selected_team === team;
                return (
                  <div key={team} className={`p-1.5 text-center ${tippedThis ? "bg-emerald-500/5 ring-1 ring-emerald-500/30" : ""}`}>
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
                    <span className="font-display text-2xl tabular-nums text-foreground">{game.home_score}</span>
                    <span className="text-xs text-slate-600">-</span>
                    <span className="font-display text-2xl tabular-nums text-foreground">{game.away_score}</span>
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

        /* === STATE 2: TIPPED (receipt — editable until kickoff) === */
        ) : alreadyTipped && !showPicker ? (
          <>
            <LockedTipReceipt game={game} tip={tip} canEdit={open} onEdit={onStartEdit} onShare={onShare} />
            <CommunityPulse game={game} entries={entries} tip={tip} />
          </>

        /* === STATE 3: KICKED OFF, NO TIP === */
        ) : kickedOff && !alreadyTipped ? (
          <div className="mt-3 border border-border/20 bg-black/40 p-3 text-center">
            <Shield className="mx-auto h-5 w-5 text-slate-600" />
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Tips closed</p>
            <p className="mt-0.5 text-[9px] text-slate-600">This one got away — next game's still open.</p>
          </div>

        /* === STATE 4: OPEN FOR TIPPING === */
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
                    onClick={(e) => { e.stopPropagation(); playSelectSound(team === game.home_team); selectionChanged(); setSelectedTeam(team); }}
                    aria-pressed={selected}
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
                    {selected && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-1 top-1">
                        <Star className="h-3 w-3 text-primary" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
              <div className="text-center">
                <p className="font-display text-xl text-primary/80">VS</p>
              </div>
            </div>

            {/* Margin: stepper + quick-picks + slider */}
            <div className="mt-3 border border-border/20 bg-black/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Win margin</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!canInteract || margin <= 1}
                    onClick={(e) => { e.stopPropagation(); bumpMargin(-1); }}
                    aria-label="Decrease margin"
                    className="flex h-7 w-7 items-center justify-center border border-border/30 bg-black/30 text-slate-400 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-30"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <div className="flex w-14 items-baseline justify-center gap-1">
                    <motion.span
                      key={margin}
                      initial={{ scale: 1.2 }}
                      animate={{ scale: 1 }}
                      className="font-display text-2xl tabular-nums text-foreground"
                    >
                      {margin}
                    </motion.span>
                    <span className="text-[10px] text-slate-500">pts</span>
                  </div>
                  <button
                    type="button"
                    disabled={!canInteract || margin >= 60}
                    onClick={(e) => { e.stopPropagation(); bumpMargin(1); }}
                    aria-label="Increase margin"
                    className="flex h-7 w-7 items-center justify-center border border-border/30 bg-black/30 text-slate-400 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-30"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1">
                {MARGIN_PRESETS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={!canInteract}
                    onClick={(e) => { e.stopPropagation(); selectionChanged(); setMargin(m); }}
                    className={`min-h-[28px] flex-1 border font-mono text-[10px] font-bold transition-all ${
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
                type="range" min="1" max="40" value={Math.min(margin, 40)}
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

            {/* Lock / update button */}
            <div className="mt-3 flex items-center gap-1.5">
              {editing && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onCancelEdit?.(); }}
                  className="flex min-h-[48px] items-center justify-center border border-border/40 bg-black/30 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
              )}
              <motion.button
                type="button"
                disabled={!canInteract}
                whileTap={canInteract ? { scale: 0.96 } : {}}
                onClick={handleLock}
                aria-label={`${editing ? "Update" : "Lock"} tip for ${shortName(selectedTeam)} by ${margin} points`}
                className="flex min-h-[48px] flex-1 items-center justify-center gap-2 bg-gradient-to-r from-primary via-accent to-primary text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-[0_0_16px_hsl(var(--primary)/0.2)] transition-all hover:shadow-[0_0_28px_hsl(var(--primary)/0.35)] active:scale-95"
              >
                <Target className="h-4 w-4" />
                <span>{editing ? "Update Tip" : "Lock My Tip"}</span>
                <Lock className="h-3 w-3 opacity-60" />
              </motion.button>
            </div>
          </>
        )}
      </div>
    </motion.article>
  );
}

// ── Round header: deadline + auto-fill ──────────────────────────────
function RoundHeader({ round, tips, onAutoFill, autoFilling }) {
  const deadlineIso = round?.deadline ? new Date(round.deadline).toISOString() : null;
  const countdown = useCountdown(deadlineIso);
  if (!round) return null;
  const untippedOpen = round.games.filter((g) => isTippable(g) && !tips[g.id]);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-border/20 bg-black/25 px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-2">
        {round.state === "live" ? (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-400">
            <Radio className="h-3 w-3 animate-pulse" /> Round in play
          </span>
        ) : round.state === "done" ? (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Round complete
          </span>
        ) : round.deadline ? (
          <span className="flex min-w-0 items-center gap-1 text-[10px] text-slate-400">
            <Clock className="h-3 w-3 shrink-0 text-amber-400" />
            {countdown ? (
              <>
                <span className="hidden sm:inline">Next lockout in</span>
                <span className="font-mono font-bold tabular-nums text-amber-200">{countdown}</span>
              </>
            ) : (
              <span className="truncate">Next lockout {formatKickoffLocal(new Date(round.deadline).toISOString())}</span>
            )}
          </span>
        ) : (
          <span className="text-[10px] text-slate-500">Kickoff times TBA</span>
        )}
      </div>
      {untippedOpen.length > 1 && (
        <button
          type="button"
          onClick={onAutoFill}
          disabled={autoFilling}
          className="flex min-h-8 items-center gap-1 border border-primary/30 bg-primary/10 px-2 text-[9px] font-bold uppercase tracking-[0.15em] text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
        >
          <Wand2 className="h-3 w-3" />
          {autoFilling ? "Filling…" : `Auto-fill ${untippedOpen.length} tips`}
        </button>
      )}
    </div>
  );
}

// ── My Tips tab ─────────────────────────────────────────────────────
function MyTipsList({ fixtures, tips, onJumpToGame }) {
  const rows = fixtures
    .filter((g) => tips[g.id])
    .sort((a, b) => new Date(b.kickoff || 0) - new Date(a.kickoff || 0));
  if (!rows.length) {
    return (
      <div className="border border-border/30 bg-black/30 p-6 text-center">
        <Target className="mx-auto h-8 w-8 text-slate-600" />
        <p className="mt-2 text-xs font-bold text-slate-400">No tips yet</p>
        <p className="mt-1 text-[9px] text-slate-500">Pick your winners round by round — your tips land here.</p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {rows.map((game) => {
        const tip = tips[game.id];
        const result = checkTipResult(game, tip);
        const open = isTippable(game);
        const live = game.status === "live";
        return (
          <button
            key={game.id}
            type="button"
            onClick={() => onJumpToGame(game)}
            className={`flex w-full items-center gap-2 border p-2 text-left transition-colors ${
              result
                ? result.correct
                  ? "border-emerald-500/20 bg-emerald-500/[0.04] hover:border-emerald-500/40"
                  : "border-red-500/15 bg-red-500/[0.03] hover:border-red-500/30"
                : "border-border/20 bg-black/25 hover:border-primary/30"
            }`}
          >
            <div className="flex shrink-0 items-center gap-1">
              <TeamCrest name={game.home_team} className="h-6 w-6 text-[8px]" />
              <span className="text-[8px] text-slate-600">v</span>
              <TeamCrest name={game.away_team} className="h-6 w-6 text-[8px]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-bold text-foreground">
                {shortName(tip.selected_team)} by {tip.margin}
              </p>
              <p className="truncate text-[9px] text-slate-500">
                {shortRoundLabel(game.label)} · {formatKickoffLocal(game.kickoff)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {result ? (
                <span className={`text-[10px] font-bold ${result.correct ? "text-emerald-400" : "text-red-400"}`}>
                  {result.correct ? (result.perfectMargin ? `🎯 +${result.points}` : `+${result.points}`) : "✗"}
                </span>
              ) : live ? (
                <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase text-red-400">
                  <Radio className="h-2.5 w-2.5 animate-pulse" /> Live
                </span>
              ) : open ? (
                <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase text-primary">
                  <Pencil className="h-2.5 w-2.5" /> Edit
                </span>
              ) : (
                <span className="text-[9px] font-bold uppercase text-slate-500">Locked</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Main Export ──────────────────────────────────────────────────────
export default function ScorePredictor({ onSharePrediction }) {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const tipperName = (isAuthenticated && (user?.full_name || user?.email)) || "Vegas Fan";
  const [tips, setTips] = useState(() => sanitizeTips(readJson(STORAGE_KEY, {})));
  const [view, setView] = useState("round");
  const [roundIndex, setRoundIndex] = useState(null); // null = follow the active round
  const [editingGameId, setEditingGameId] = useState("");
  const [autoFilling, setAutoFilling] = useState(false);
  const [dataCorrupted, setDataCorrupted] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const queriesEnabled = appParams.hasBase44Config;

  // Cross-tab sync
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        try {
          setTips(sanitizeTips(JSON.parse(e.newValue || "{}")));
        } catch { /* ignore invalid */ }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Corruption detection
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && typeof JSON.parse(raw) !== "object") setDataCorrupted(true);
    } catch {
      setDataCorrupted(true);
    }
  }, []);

  // ── Data ──
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

  // ALL fixtures, unfiltered — points and streaks must never depend on which
  // tab or round the fan happens to be looking at.
  const allFixtures = useMemo(() => {
    const adminGames = (matchups || [])
      .filter((m) => m.is_published !== false && m.home_team && m.away_team)
      .map((m) => ({ ...m, id: m.id || `${m.home_team}-${m.away_team}-${m.kickoff || "tba"}` }));
    const seen = new Set(adminGames.map((g) => `${g.home_team}-${g.away_team}-${String(g.kickoff).slice(0, 10)}`));
    const apiGames = (apiFixtures || []).filter(
      (g) => !seen.has(`${g.home_team}-${g.away_team}-${String(g.kickoff).slice(0, 10)}`)
    );
    return [...adminGames, ...apiGames]
      .sort((a, b) => new Date(a.kickoff || 0) - new Date(b.kickoff || 0));
  }, [matchups, apiFixtures]);

  const rounds = useMemo(() => buildRounds(allFixtures), [allFixtures]);
  const activeRoundIdx = roundIndex ?? defaultRoundIndex(rounds);
  const activeRound = rounds[Math.min(activeRoundIdx, Math.max(0, rounds.length - 1))] || null;

  // Tips follow the account: hydrate the local mirror from my server entries,
  // so a new phone (or cleared storage) still shows what I've already tipped.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !isAuthenticated || !user?.id || !entries.length) return;
    const missing = {};
    entries.forEach((e) => {
      if (e.user_id !== user.id || tips[e.game_id]) return;
      const candidate = {
        selected_team: e.selected_team,
        margin: Number(e.margin) || DEFAULT_MARGIN,
        predicted_home_score: e.predicted_home_score,
        predicted_away_score: e.predicted_away_score,
        game_id: e.game_id,
        home_team: e.home_team,
        away_team: e.away_team,
        kickoff: e.kickoff,
        tipped_at: e.created_date || new Date().toISOString(),
      };
      if (isValidTip(candidate)) missing[e.game_id] = candidate;
    });
    hydratedRef.current = true;
    if (Object.keys(missing).length) {
      setTips((prev) => {
        const next = { ...missing, ...prev };
        writeJson(STORAGE_KEY, next);
        return next;
      });
    }
  }, [entries, isAuthenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Season stats: server-settled points first, local results as fallback ──
  const settledByGame = useMemo(() => {
    const map = new Map();
    if (isAuthenticated && user?.id) {
      entries.forEach((e) => {
        if (e.user_id === user.id && e.settled_at) map.set(e.game_id, e);
      });
    }
    return map;
  }, [entries, isAuthenticated, user?.id]);

  const { totalPoints, record, streaks } = useMemo(() => {
    let points = 0;
    let correct = 0;
    let checked = 0;
    const results = [];
    // Server-settled entries are authoritative for my account…
    settledByGame.forEach((e) => {
      const won = e.result === "win" || e.result === "perfect";
      points += Number(e.points) || 0;
      checked += 1;
      if (won) correct += 1;
      results.push({ kickoff: e.kickoff, correct: won });
    });
    // …and locally-scored results cover API fixtures / guests.
    allFixtures.forEach((g) => {
      if (settledByGame.has(g.id)) return;
      const result = checkTipResult(g, tips[g.id]);
      if (!result) return;
      points += result.points;
      checked += 1;
      if (result.correct) correct += 1;
      results.push({ kickoff: g.kickoff, correct: result.correct });
    });
    return { totalPoints: points, record: { correct, checked }, streaks: computeStreaks(results) };
  }, [allFixtures, tips, settledByGame]);

  // Persist for anything else that reads these keys (badges, profile).
  useEffect(() => {
    writeJson(POINTS_KEY, totalPoints);
    writeJson(TIP_STREAK_KEY, streaks.current);
  }, [totalPoints, streaks.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy settlement (idempotent server-side)
  const settleTriggeredRef = useRef(new Set());
  useEffect(() => {
    if (!isAuthenticated || !queriesEnabled) return;
    const unsettledFinished = (matchups || []).filter((m) =>
      (m.status === "final" || m.status === "finished") &&
      m.home_score != null && m.away_score != null &&
      !settleTriggeredRef.current.has(m.id) &&
      (entries || []).some((e) => e.game_id === m.id && !e.settled_at)
    );
    unsettledFinished.forEach((m) => {
      settleTriggeredRef.current.add(m.id);
      base44.functions.invoke("settleTips", { gameId: m.id })
        .then(() => queryClient.invalidateQueries({ queryKey: ["tippingEntries"] }))
        .catch(() => { /* another viewer may have settled it first */ });
    });
  }, [matchups, entries, isAuthenticated, queriesEnabled, queryClient]);

  const createTip = useMutation({
    // Routed through submitTip so the kickoff deadline is enforced server-side;
    // the server treats a repeat submission as an edit while the game is open.
    mutationFn: (payload) => base44.functions.invoke("submitTip", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tippingEntries"] }),
  });

  const handleTip = useCallback((game, tip, { isEdit = false } = {}) => {
    // The only lock is kickoff — edits before then are fair game.
    if (!isTippable(game)) return;

    const tipObj = {
      ...tip,
      game_id: game.id,
      home_team: game.home_team,
      away_team: game.away_team,
      kickoff: game.kickoff,
      tipped_at: new Date().toISOString(),
    };
    if (!isValidTip(tipObj)) {
      console.warn("[RLT] Invalid tip rejected:", tipObj);
      return;
    }

    setTips((prev) => {
      const next = { ...prev, [game.id]: tipObj };
      writeJson(STORAGE_KEY, next);
      writeJson(PROFILE_KEY, { streak: Math.max(1, Object.keys(next).length), updated_at: new Date().toISOString() });
      return next;
    });
    try {
      localStorage.setItem(`rlt_match_voted_${game.id}`, "true");
      if (!isEdit) window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "tip_locked" } }));
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
      createTip.mutate(serverPayload, {
        onSuccess: () => {
          removeTipFromQueue(game.id);
          if (isEdit) toast({ title: "Tip updated", description: `${shortName(tip.selected_team)} by ${tip.margin} — you can keep editing until kickoff.` });
        },
        onError: (err) => {
          // Don't lose the tip: queue it for retry on reconnect/next visit.
          console.warn("[RLT] Failed to sync tip to server:", err);
          enqueueTip(serverPayload);
          warningImpact();
          toast({
            title: isEdit ? "Change saved on this device" : "Tip locked on this device",
            description: "We couldn't reach the server — it will sync automatically before kickoff.",
          });
        },
      });
    }
  }, [queriesEnabled, createTip, tipperName]);

  // One-tap round completion: back the community favourite (or the home side
  // when the crowd is silent) in every open game left untipped this round.
  const handleAutoFill = useCallback(() => {
    if (!activeRound || autoFilling) return;
    const targets = activeRound.games.filter((g) => isTippable(g) && !tips[g.id]);
    if (!targets.length) return;
    setAutoFilling(true);
    targets.forEach((game) => {
      const team = communityFavourite(game, entries) || game.home_team;
      const scores = deriveScores(game, team, DEFAULT_MARGIN);
      handleTip(game, {
        selected_team: team,
        margin: DEFAULT_MARGIN,
        predicted_home_score: scores.home,
        predicted_away_score: scores.away,
      });
    });
    successImpact();
    toast({
      title: `${targets.length} tip${targets.length !== 1 ? "s" : ""} auto-filled`,
      description: "Community favourites locked in — tap any game to fine-tune before kickoff.",
    });
    setTimeout(() => setAutoFilling(false), 800);
  }, [activeRound, autoFilling, tips, entries, handleTip]);

  // Flush tips that failed to sync — on mount + reconnect.
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

  const handleResetTips = useCallback(() => {
    setTips({});
    writeJson(STORAGE_KEY, {});
    writeJson(POINTS_KEY, 0);
    setDataCorrupted(false);
    setShowResetConfirm(false);
  }, []);

  const handleShare = useCallback((game) => {
    if (!game || !onSharePrediction) return;
    const tip = tips[game.id] || { selected_team: game.home_team, margin: DEFAULT_MARGIN, ...deriveScores(game, game.home_team, DEFAULT_MARGIN) };
    const homeScore = tip.predicted_home_score ?? tip.home ?? 24;
    const awayScore = tip.predicted_away_score ?? tip.away ?? 16;
    onSharePrediction(game, homeScore, awayScore);
    try { window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "share_tip" } })); } catch { /* ignore */ }
  }, [tips, onSharePrediction]);

  const jumpToGame = useCallback((game) => {
    const idx = rounds.findIndex((r) => r.games.some((g) => g.id === game.id));
    if (idx >= 0) setRoundIndex(idx);
    if (isTippable(game) && tips[game.id]) setEditingGameId(game.id);
    setView("round");
  }, [rounds, tips]);

  const tippedTotal = allFixtures.filter((g) => tips[g.id]).length;
  const openUntipped = allFixtures.filter((g) => !tips[g.id] && isTippable(g)).length;
  const roundGames = activeRound?.games || [];

  return (
    <div className="cmd-glass overflow-hidden border border-border/50 bg-gradient-to-b from-card/40 to-black/60">
      <div className="h-[3px] w-full bg-gradient-to-r from-primary via-accent to-primary" />

      <div className="p-4 sm:p-5">
        {/* Data corruption banner */}
        {dataCorrupted && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-4 border border-amber-500/30 bg-amber-500/5 p-3"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-amber-300">Tips data may be corrupted</p>
                <p className="mt-0.5 text-[9px] text-amber-400/60">Some saved tips couldn't be read. You can reset to start fresh.</p>
              </div>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex shrink-0 items-center gap-1 border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase text-amber-300 transition-colors hover:bg-amber-500/20"
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
                className="cmd-glass mx-4 max-w-sm border border-border bg-card p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="border border-red-500/20 bg-red-500/10 p-2">
                    <Trash2 className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <h4 className="font-display text-lg uppercase">Reset All Tips?</h4>
                    <p className="text-[11px] text-muted-foreground">This clears the tips saved on this device.</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-muted/20"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetTips}
                    className="bg-red-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-600"
                  >
                    <Trash2 className="mr-1 inline h-3 w-3" /> Delete Everything
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
              {openUntipped > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white">
                  {openUntipped}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-lg uppercase leading-none tracking-wide text-foreground">
                Footy Tipping
              </h3>
              <p className="mt-1 text-[9px] font-mono uppercase tracking-[0.3em] text-slate-400">
                NRL 2026 · {totalPoints} pts
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {streaks.current > 1 && (
              <span className="flex items-center gap-1 border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                <Flame className="h-3 w-3" /> {streaks.current} streak
              </span>
            )}
            {apiLoading && (
              <span className="animate-pulse text-[9px] text-slate-500">Loading fixtures…</span>
            )}
            {apiError && (
              <button
                onClick={() => retryApi()}
                className="flex items-center gap-1 text-[9px] text-red-400 transition-colors hover:text-red-300"
              >
                <AlertTriangle className="h-2.5 w-2.5" /> API Error
                <RefreshCw className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-4">
          <HeroStats
            totalPoints={totalPoints}
            correct={record.correct}
            checked={record.checked}
            streak={streaks}
            tipped={tippedTotal}
            total={allFixtures.length}
          />
        </div>

        {/* View tabs */}
        <div className="mt-4 grid grid-cols-3 border border-border/30 bg-black/30 p-0.5" role="tablist" aria-label="Tipping views">
          {[
            { id: "round", label: "Tipping", icon: Calendar, count: openUntipped },
            { id: "mytips", label: "My Tips", icon: Target, count: tippedTotal },
            { id: "ladder", label: "Ladder", icon: Crown },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={view === item.id}
              onClick={() => setView(item.id)}
              className={`relative flex min-h-9 items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${
                view === item.id ? "text-primary-foreground" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {view === item.id && (
                <motion.div
                  layoutId="tipping-view-indicator"
                  className="absolute inset-0 bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1">
                <item.icon className="h-3 w-3" />
                {item.label}
                {item.count > 0 && (
                  <span className={`ml-0.5 text-[9px] ${view === item.id ? "opacity-80" : "text-primary"}`}>
                    ({item.count})
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* ── VIEW: Round tipping ── */}
        {view === "round" && (
          <>
            {rounds.length > 0 && (
              <div className="mt-3">
                <RoundNav rounds={rounds} index={activeRoundIdx} onSelect={(i) => { setRoundIndex(i); setEditingGameId(""); }} tips={tips} />
              </div>
            )}
            <RoundHeader round={activeRound} tips={tips} onAutoFill={handleAutoFill} autoFilling={autoFilling} />
            {activeRound?.state === "done" && (
              <div className="mt-3">
                <RoundRecap round={activeRound} tips={tips} />
              </div>
            )}

            <div className="mt-3 space-y-2">
              <AnimatePresence mode="popLayout">
                {roundGames.map((game) => (
                  <FixtureCard
                    key={game.id}
                    game={game}
                    tip={tips[game.id]}
                    onTip={handleTip}
                    entries={entries}
                    editing={editingGameId === game.id}
                    onStartEdit={() => setEditingGameId(game.id)}
                    onCancelEdit={() => setEditingGameId("")}
                    onShare={onSharePrediction ? () => handleShare(game) : null}
                  />
                ))}
              </AnimatePresence>
              {roundGames.length === 0 && (
                <div className="border border-border/30 bg-black/30 p-6 text-center">
                  {apiLoading ? (
                    <>
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
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
                        className="mt-3 inline-flex items-center gap-1.5 border border-primary/30 bg-primary/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
                      >
                        <RefreshCw className="h-3 w-3" /> Try Again
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
          </>
        )}

        {/* ── VIEW: My tips ── */}
        {view === "mytips" && (
          <div className="mt-3">
            <MyTipsList fixtures={allFixtures} tips={tips} onJumpToGame={jumpToGame} />
          </div>
        )}

        {/* ── VIEW: Ladder ── */}
        {view === "ladder" && (
          <div className="mt-3 space-y-3">
            <TipLadder
              entries={entries}
              roundLabel={activeRound?.label || null}
              myUserId={isAuthenticated ? user?.id : null}
              myName={isAuthenticated ? tipperName : ""}
              localTipCount={tippedTotal}
              localPoints={totalPoints}
            />
            <div className="border border-border/30 bg-black/30 p-3">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300">How It Works</p>
              </div>
              <div className="mt-3 grid gap-2">
                {[
                  { step: 1, icon: Target, color: "text-primary", text: "Pick a winner & set your margin for every game in the round" },
                  { step: 2, icon: Pencil, color: "text-amber-400", text: "Change your mind any time until kickoff — then it locks" },
                  { step: 3, icon: Award, color: "text-emerald-400", text: "+3 pts for the winner, +2 bonus for the exact margin" },
                  { step: 4, icon: Trophy, color: "text-amber-400", text: "Climb the season ladder — results settle automatically" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-2.5 border border-border/10 bg-black/20 p-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center border border-primary/20 bg-primary/10">
                      <span className="text-[10px] font-black text-primary">{item.step}</span>
                    </div>
                    <div className="flex min-w-0 items-start gap-1.5">
                      <item.icon className={`mt-0.5 h-3 w-3 shrink-0 ${item.color}`} />
                      <p className="text-[10px] leading-relaxed text-slate-400">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-border/15 pt-3 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-primary/60" /> Live tipping hub
          </span>
          <span className="flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3 text-amber-400/60" /> {record.correct}/{record.checked} correct
          </span>
        </div>
      </div>
    </div>
  );
}
