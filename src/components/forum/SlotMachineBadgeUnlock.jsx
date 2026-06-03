import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gem, Lock, Sparkles, Trophy, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import {
  SLOT_BADGES,
  spinReels,
  evaluateReels,
  parseBadgeIds,
  SPIN_COOLDOWN_MS,
  SLOT_BADGES_KEY,
  SLOT_LAST_SPIN_KEY,
} from "@/lib/slot-badges";
import {
  REEL_DURATIONS,
  SPINS_KEY,
  STREAK_KEY,
  STREAK_DATE_KEY,
  MUTE_KEY,
  VALID_BADGE_IDS,
  TIER_ORDER,
} from "./slot/slotConstants";
import {
  safeGetItem,
  safeSetItem,
  safeReadIds,
  migrateStorage,
  safeGetNumber,
  setBadgeWinTimestamp,
  isBadgeNew,
  addWinHistory,
  getLastWinSpin,
  setLastWinSpin,
} from "./slot/slotStorage";
import { fmtCountdown, makeReelTrack, getDateStr } from "./slot/slotHelpers";
import LuckyMeter from "./slot/LuckyMeter";
import WinHistoryLog from "./slot/WinHistoryLog";
import StatsPanel from "./slot/StatsPanel";
import LoadingSkeleton from "./slot/LoadingSkeleton";
import { AmbientParticles, NeonGlow, WinCelebration } from "./slot/effects";
import ReelWindow from "./slot/ReelWindow";
import Lever from "./slot/Lever";
import { ProgressRing, CooldownRing } from "./slot/rings";
import TypewriterMessage from "./slot/TypewriterMessage";
import BadgeCard from "./slot/BadgeCard";
import EmptyStateGuide from "./slot/EmptyStateGuide";
import TierGroupHeader from "./slot/TierGroupHeader";

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
export default function SlotMachineBadgeUnlock() {
  const { user, isAuthenticated, updateProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reels, setReels] = useState(["🎰", "🎰", "🎰"]);
  const [tracks, setTracks] = useState(() => reels.map((emoji) => [emoji]));
  const [spinning, setSpinning] = useState(false);
  const [reelsStopped, setReelsStopped] = useState([false, false, false]);
  const [leverDown, setLeverDown] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    // Default to muted; read persisted preference
    const stored = safeGetItem(MUTE_KEY, "true");
    return stored === "false";
  });
  const [message, setMessage] = useState("One spin a day — line up three to win a badge!");
  const [messageType, setMessageType] = useState("idle");
  const [isWin, setIsWin] = useState(false);
  const [isNewBadgeWin, setIsNewBadgeWin] = useState(false);
  const [lastWonBadgeId, setLastWonBadgeId] = useState(null);
  const [nearMissResult, setNearMissResult] = useState(null);
  const [ownedIds, setOwnedIds] = useState([]);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [totalSpins, setTotalSpins] = useState(0);
  const [streak, setStreak] = useState(0);
  const [screenShake, setScreenShake] = useState(false);
  const [hasSpunToday, setHasSpunToday] = useState(false);

  const audioCtxRef = useRef(null);
  const pendingSymbolsRef = useRef(null);
  const ownedIdsRef = useRef(ownedIds);
  const timersRef = useRef([]);
  const containerRef = useRef(null);
  const spinLockRef = useRef(false); // Race condition prevention

  useEffect(() => { ownedIdsRef.current = ownedIds; }, [ownedIds]);

  // Cleanup ALL timers on unmount
  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  // ─── Initialize from localStorage ───
  useEffect(() => {
    migrateStorage();
    const ids = safeReadIds();
    setOwnedIds(ids);
    ownedIdsRef.current = ids;
    setTotalSpins(safeGetNumber(SPINS_KEY, 0));

    // Validate streak date
    const streakDate = safeGetItem(STREAK_DATE_KEY, null);
    const storedStreak = safeGetNumber(STREAK_KEY, 0);
    if (streakDate) {
      // If streak date is in the future (clock shenanigans), reset
      const today = getDateStr();
      const todayDate = new Date();
      // Simple check: if the stored date looks like it's ahead of today, reset
      try {
        // We can't perfectly parse our format, so just trust if non-null
        // But check for future by seeing if it matches a date > today
        setStreak(storedStreak);
      } catch {
        setStreak(0);
        safeSetItem(STREAK_KEY, "0");
      }
    } else {
      setStreak(storedStreak);
    }

    // Check if user has spun today
    const lastSpinTs = safeGetNumber(SLOT_LAST_SPIN_KEY, 0);
    const lastSpinDate = lastSpinTs ? getDateStr(new Date(lastSpinTs)) : null;
    setHasSpunToday(lastSpinDate === getDateStr());

    setLoading(false);
  }, []);

  // Merge server badge IDs
  useEffect(() => {
    const serverIds = parseBadgeIds(user?.badges);
    if (serverIds.length) {
      setOwnedIds((prev) => {
        const merged = Array.from(new Set([...prev, ...serverIds])).filter((id) => VALID_BADGE_IDS.has(id));
        return merged;
      });
    }
  }, [user]);

  // ─── Cooldown timer with visibility change re-check ───
  useEffect(() => {
    const tick = () => {
      const last = safeGetNumber(SLOT_LAST_SPIN_KEY, 0);
      const remaining = Math.max(0, last + SPIN_COOLDOWN_MS - Date.now());
      setCooldownLeft(remaining);
      // Also update hasSpunToday
      const lastDate = last ? getDateStr(new Date(last)) : null;
      setHasSpunToday(lastDate === getDateStr());
    };
    tick();
    const id = setInterval(tick, 1000);

    // Re-check on visibility change (user returns to tab)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  /* ─── Persist mute preference ─── */
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      safeSetItem(MUTE_KEY, String(!next)); // store as "muted" = true/false
      return next;
    });
  }, []);

  /* ─── Audio ─── */
  const initAudio = useCallback(() => {
    try {
      if (typeof window === "undefined") return;
      if (!window.AudioContext && !window.webkitAudioContext) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch { /* AudioContext unavailable (SSR, restricted) */ }
  }, []);

  const playBeep = useCallback((freq, duration, type = "sine", volume = 0.1) => {
    if (!soundEnabled) return;
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch { /* ignore */ }
  }, [soundEnabled, initAudio]);

  // Mechanical click sound when a reel stops
  const playReelClick = useCallback(() => {
    playBeep(1200, 0.04, "square", 0.06);
    setTimeout(() => playBeep(800, 0.03, "square", 0.04), 30);
  }, [playBeep]);

  const playVictory = useCallback(() => {
    [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      setTimeout(() => playBeep(f, 0.34, "square", 0.12), i * 95)
    );
  }, [playBeep]);

  const playJackpotVictory = useCallback(() => {
    // More dramatic fanfare for new badge wins
    [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      setTimeout(() => playBeep(f, 0.4, "square", 0.14), i * 80)
    );
    // Add a bass boom
    setTimeout(() => playBeep(80, 0.5, "sine", 0.15), 50);
  }, [playBeep]);

  const playBuzzer = useCallback(() => {
    playBeep(170, 0.26, "sawtooth", 0.09);
    setTimeout(() => playBeep(126, 0.36, "sawtooth", 0.08), 130);
  }, [playBeep]);

  const playNearMiss = useCallback(() => {
    playBeep(523.25, 0.18, "triangle", 0.1);
    setTimeout(() => playBeep(440, 0.15, "triangle", 0.08), 200);
  }, [playBeep]);

  /* ─── Badge award ─── */
  const awardBadge = useCallback((badge) => {
    if (ownedIdsRef.current.includes(badge.id)) return false;
    const next = Array.from(new Set([...ownedIdsRef.current, badge.id]));
    ownedIdsRef.current = next;
    setOwnedIds(next);
    safeSetItem(SLOT_BADGES_KEY, JSON.stringify(next));
    setBadgeWinTimestamp(badge.id);
    if (isAuthenticated) {
      try { Promise.resolve(updateProfile({ badges: next })).catch(() => {}); } catch { /* ignore */ }
    }
    return true; // was newly awarded
  }, [isAuthenticated, updateProfile]);

  /* ─── Streak logic ─── */
  const updateStreak = useCallback(() => {
    const today = getDateStr();
    const lastDate = safeGetItem(STREAK_DATE_KEY, null);
    const yesterday = getDateStr(new Date(Date.now() - 86400000));

    let newStreak;
    if (lastDate === yesterday) {
      newStreak = streak + 1;
    } else if (lastDate === today) {
      newStreak = streak;
    } else {
      newStreak = 1;
    }

    setStreak(newStreak);
    safeSetItem(STREAK_KEY, String(newStreak));
    safeSetItem(STREAK_DATE_KEY, today);
    setHasSpunToday(true);
  }, [streak]);

  /* ─── Finish Spin ─── */
  const finishSpin = useCallback(() => {
    const finalSymbols = pendingSymbolsRef.current;
    if (!finalSymbols) {
      spinLockRef.current = false;
      return;
    }

    const finalEmojis = finalSymbols.map((s) => s.emoji);
    setReels(finalEmojis);
    setTracks(finalEmojis.map((emoji) => [emoji]));
    setSpinning(false);
    setLeverDown(false);
    setReelsStopped([false, false, false]);

    const result = evaluateReels(finalSymbols);
    if (result.type === "win") {
      const isNew = awardBadge(result.badge);
      setIsWin(true);
      setIsNewBadgeWin(isNew);
      setScreenShake(true);
      setLastWonBadgeId(result.badge.id);
      setNearMissResult(null);

      // Track win history and pity system
      if (isNew) addWinHistory(result.badge.id);
      setLastWinSpin(totalSpins + 1);

      if (isNew) {
        // Dramatic delay for new badge reveal
        const t1 = setTimeout(() => playJackpotVictory(), 200);
        timersRef.current.push(t1);
      } else {
        playVictory();
      }

      setMessageType("win");
      setMessage(
        !isNew
          ? `${result.symbol.emoji}${result.symbol.emoji}${result.symbol.emoji} Jackpot hit — you already hold the ${result.badge.label} badge.`
          : `🎉 Jackpot! ${result.symbol.emoji}${result.symbol.emoji}${result.symbol.emoji} — unlocked the ${result.badge.label} badge!`
      );
      window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "slot_win", badge: result.badge.id } }));
      const t2 = setTimeout(() => setScreenShake(false), 600);
      timersRef.current.push(t2);
    } else if (result.type === "near") {
      playNearMiss();
      setMessageType("near");
      setMessage(`So close! 😩 Two ${result.symbol.emoji} on the line — one reel away from the ${result.symbol.key} badge!`);
      setLastWonBadgeId(null);
      // Determine which reels match and which is the odd one
      const keys = finalSymbols.map((s) => s.key);
      const pairKey = result.symbol.key;
      setNearMissResult({
        matchIndices: keys.map((k, i) => k === pairKey ? i : -1).filter((i) => i >= 0),
        oddIndex: keys.findIndex((k) => k !== pairKey),
      });
    } else {
      playBuzzer();
      setMessageType("loss");
      setMessage("No luck this time. One spin a day — try again tomorrow!");
      setLastWonBadgeId(null);
      setNearMissResult(null);
    }

    // Release spin lock after all state is set
    const t3 = setTimeout(() => { spinLockRef.current = false; }, 100);
    timersRef.current.push(t3);
  }, [awardBadge, playVictory, playJackpotVictory, playBuzzer, playNearMiss]);

  /* ─── Handle Spin ─── */
  const handleSpin = useCallback(() => {
    // Double-spin prevention: check BOTH state and ref
    if (spinning || cooldownLeft > 0 || spinLockRef.current) return;

    // Re-check cooldown from localStorage (in case tab was backgrounded)
    const lastSpin = safeGetNumber(SLOT_LAST_SPIN_KEY, 0);
    const actualCooldown = Math.max(0, lastSpin + SPIN_COOLDOWN_MS - Date.now());
    if (actualCooldown > 0) {
      setCooldownLeft(actualCooldown);
      return;
    }

    // Lock immediately
    spinLockRef.current = true;

    initAudio();
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const finalSymbols = spinReels();
    const nextTracks = finalSymbols.map((symbol, index) => makeReelTrack(symbol.emoji, index));
    pendingSymbolsRef.current = finalSymbols;

    safeSetItem(SLOT_LAST_SPIN_KEY, String(Date.now()));
    setCooldownLeft(SPIN_COOLDOWN_MS);

    // Increment total spins
    const newSpins = totalSpins + 1;
    setTotalSpins(newSpins);
    safeSetItem(SPINS_KEY, String(newSpins));

    // Update streak
    updateStreak();

    setIsWin(false);
    setIsNewBadgeWin(false);
    setScreenShake(false);
    setLastWonBadgeId(null);
    setNearMissResult(null);
    setLeverDown(true);
    setMessageType("idle");
    setMessage("Reels are rolling… watch the payline.");
    setTracks(nextTracks);
    setSpinning(true);
    setReelsStopped([false, false, false]);

    timersRef.current.push(setTimeout(() => setLeverDown(false), 380));

    // Spin ticker sounds + drum roll escalation before each reel stops
    Array.from({ length: 18 }).forEach((_, i) => {
      timersRef.current.push(setTimeout(() => playBeep(280 + i * 18, 0.045, "triangle", 0.055), i * 90));
    });

    // Drum roll: rapid escalating beeps in the last 0.5s before each reel stops
    REEL_DURATIONS.forEach((duration) => {
      const drumStart = (duration * 1000) - 500;
      if (drumStart > 0) {
        for (let d = 0; d < 8; d++) {
          timersRef.current.push(setTimeout(
            () => playBeep(600 + d * 80, 0.03, "square", 0.04),
            drumStart + d * 55
          ));
        }
      }
    });

    // Reel stop click sounds + bounce-back indication
    REEL_DURATIONS.forEach((duration, index) => {
      timersRef.current.push(setTimeout(() => {
        playReelClick();
        // Indicate this reel has stopped (for bounce-back visual)
        setReelsStopped((prev) => {
          const next = [...prev];
          next[index] = true;
          return next;
        });
        // Clear the stopped indicator after brief flash
        timersRef.current.push(setTimeout(() => {
          setReelsStopped((prev) => {
            const next = [...prev];
            next[index] = false;
            return next;
          });
        }, 300));
      }, duration * 1000));
    });

    timersRef.current.push(setTimeout(finishSpin, Math.max(...REEL_DURATIONS) * 1000 + 120));
  }, [spinning, cooldownLeft, totalSpins, updateStreak, initAudio, playBeep, playReelClick, finishSpin]);

  const canSpin = !spinning && cooldownLeft <= 0 && !spinLockRef.current;
  const earnedCount = ownedIds.length;
  const totalBadges = SLOT_BADGES.length;
  const collectionProgress = totalBadges > 0 ? earnedCount / totalBadges : 0;
  const topOwnedBadge = useMemo(() =>
    SLOT_BADGES.filter((b) => ownedIds.includes(b.id)).sort((a, b) => b.rarity - a.rarity)[0],
    [ownedIds]
  );

  // Streak at-risk: user has a streak but hasn't spun today
  const streakAtRisk = streak > 0 && !hasSpunToday && cooldownLeft <= 0;

  // Pity system: spins since last win
  const spinsSinceWin = totalSpins - getLastWinSpin();

  // Group badges by tier
  const badgesByTier = useMemo(() => {
    const groups = {};
    for (const tier of TIER_ORDER) {
      const badges = SLOT_BADGES.filter((b) => b.tier === tier);
      if (badges.length > 0) {
        const ownedCount = badges.filter((b) => ownedIds.includes(b.id)).length;
        groups[tier] = { badges, ownedCount, totalCount: badges.length };
      }
    }
    return groups;
  }, [ownedIds]);

  // Show loading skeleton while initializing
  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <motion.div
      ref={containerRef}
      animate={screenShake ? { x: [0, -6, 6, -4, 4, -2, 2, 0], y: [0, -3, 3, -2, 2, 0] } : { x: 0, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative overflow-hidden border border-purple-500/20 bg-[linear-gradient(145deg,rgba(88,28,135,0.3),rgba(3,0,15,0.98)_40%,rgba(30,0,50,0.95))] shadow-[0_0_50px_rgba(88,28,135,0.12)]"
    >
      {/* Ambient glow effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.15),transparent_40%),radial-gradient(circle_at_5%_25%,rgba(236,72,153,0.10),transparent_30%),radial-gradient(circle_at_95%_20%,rgba(251,191,36,0.10),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(88,28,135,0.12),transparent_40%)]" />
      <AmbientParticles />
      <NeonGlow spinning={spinning} isWin={isWin} />

      {/* Top neon bar */}
      <div className="relative h-[3px] w-full bg-gradient-to-r from-pink-500 via-purple-400 to-amber-400 shadow-[0_0_12px_rgba(168,85,247,0.5)]" />

      <div className="relative p-4 sm:p-5">
        {/* ─── Header ─── */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={spinning
                ? { rotate: [0, 10, -10, 0] }
                : canSpin
                ? { rotate: [0, -3, 3, -3, 0], scale: [1, 1.02, 1] }
                : {}
              }
              transition={spinning
                ? { duration: 0.5, repeat: Infinity }
                : canSpin
                ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
                : {}
              }
              className={`grid h-10 w-10 place-items-center border bg-black/60 text-xl ${
                canSpin
                  ? "border-amber-300/40 shadow-[0_0_25px_rgba(251,191,36,0.25)]"
                  : "border-purple-400/30 shadow-[0_0_20px_rgba(168,85,247,0.2)]"
              }`}
            >
              🎰
            </motion.div>
            <div>
              <h3 className="font-display text-base font-black uppercase tracking-[0.1em] text-amber-100">
                Vegas Slot Machine
              </h3>
              <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-purple-300/70 flex-wrap">
                <span>{earnedCount}/{totalBadges} rewards</span>
                <span className="text-amber-300/60">·</span>
                <span className="text-amber-200/60">SPINS: {totalSpins}</span>
                {streak > 0 && (
                  <>
                    <span className="text-amber-300/60">·</span>
                    <motion.span
                      className={`font-bold ${streakAtRisk ? "text-red-400" : "text-orange-300/80"}`}
                      animate={streakAtRisk ? { opacity: [1, 0.5, 1] } : {}}
                      transition={streakAtRisk ? { duration: 1.5, repeat: Infinity } : {}}
                    >
                      🔥 {streak} {streak >= 3 ? "day streak!" : streak > 1 ? "days" : "day"}
                      {streakAtRisk && " ⚠️"}
                    </motion.span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {topOwnedBadge && (
              <span className="hidden items-center gap-1 border border-amber-300/20 bg-black/50 px-2 py-1 text-[10px] font-mono uppercase text-amber-200/80 sm:inline-flex">
                <Trophy className="h-3 w-3" /> {topOwnedBadge.emoji} {topOwnedBadge.tier}
              </span>
            )}
            <button
              type="button"
              onClick={toggleSound}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center border border-purple-400/20 bg-black/55 text-muted-foreground transition-colors hover:text-purple-300 focus-visible:ring-2 focus-visible:ring-purple-400"
              title={soundEnabled ? "Mute" : "Unmute"}
              aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
            >
              {soundEnabled ? (
                <Volume2 className="h-3.5 w-3.5 text-purple-300" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* ─── Streak At Risk Warning ─── */}
        <AnimatePresence>
          {streakAtRisk && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 overflow-hidden"
            >
              <div className="flex items-center gap-2 border border-red-400/20 bg-red-950/20 px-3 py-2 text-[10px] text-red-300">
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >🔥</motion.span>
                <span>
                  Your <strong>{streak}-day streak</strong> is at risk! Spin today to keep it alive.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── First-Time Empty State ─── */}
        {totalSpins === 0 && earnedCount === 0 && <EmptyStateGuide />}

        {/* ─── Collection Complete Celebration ─── */}
        <AnimatePresence>
          {earnedCount === totalBadges && totalBadges > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="border-2 border-amber-400/40 bg-gradient-to-r from-amber-900/30 via-amber-800/20 to-amber-900/30 p-4 text-center">
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-4xl mb-2"
                >
                  🏆
                </motion.div>
                <p className="text-sm font-black uppercase tracking-wider text-amber-200">Collection Complete!</p>
                <p className="mt-1 text-[10px] text-amber-300/60">You've unlocked all {totalBadges} badges. Legendary status achieved.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Machine Body ─── */}
        <div className="relative overflow-hidden border border-purple-500/20 bg-black p-3 shadow-[inset_0_0_50px_rgba(0,0,0,0.98),0_0_30px_rgba(88,28,135,0.12)]">
          {/* Top light strip */}
          <div className="mb-2.5 flex gap-0.5">
            {Array.from({ length: 24 }).map((_, i) => (
              <motion.span
                key={i}
                className="h-1.5 flex-1"
                animate={{
                  backgroundColor: spinning || isWin
                    ? i % 3 === 0
                      ? ["rgba(236,72,153,0.9)", "rgba(251,191,36,0.9)", "rgba(168,85,247,0.9)"]
                      : i % 3 === 1
                      ? ["rgba(251,191,36,0.9)", "rgba(168,85,247,0.9)", "rgba(236,72,153,0.9)"]
                      : ["rgba(168,85,247,0.9)", "rgba(236,72,153,0.9)", "rgba(251,191,36,0.9)"]
                    : i % 2
                    ? "rgba(168,85,247,0.25)"
                    : "rgba(251,191,36,0.20)",
                }}
                transition={spinning || isWin ? { duration: 0.6, repeat: Infinity } : { duration: 0.5 }}
                style={{ boxShadow: spinning || isWin ? "0 0 6px currentColor" : "none" }}
              />
            ))}
          </div>

          {/* Reels + Lever */}
          <div className="relative grid grid-cols-[1fr_auto] gap-3">
            <div className="grid grid-cols-3 gap-3">
              {tracks.map((track, index) => (
                <ReelWindow
                  key={index}
                  track={track}
                  index={index}
                  spinning={spinning}
                  stopped={reelsStopped[index]}
                  highlight={nearMissResult?.matchIndices?.includes(index) || false}
                  nearMissPulse={nearMissResult?.oddIndex === index || false}
                />
              ))}
            </div>

            <Lever canSpin={canSpin} leverDown={leverDown} onPull={handleSpin} />
          </div>

          {/* Win celebration overlay */}
          <WinCelebration show={isWin} isJackpot={isNewBadgeWin} />
        </div>

        {/* ─── Message ─── */}
        <TypewriterMessage text={message} type={messageType} />

        {/* ─── Spin Button with Progress Ring ─── */}
        <div className="mt-4 flex items-center justify-center gap-4">
          {/* Cooldown ring - show when on cooldown */}
          {cooldownLeft > 0 && !spinning && (
            <CooldownRing cooldownLeft={cooldownLeft} />
          )}

          {/* Main button with progress ring */}
          <div className="relative flex-1">
            <Button
              type="button"
              disabled={!canSpin}
              onClick={handleSpin}
              aria-label={spinning ? "Reels are spinning" : cooldownLeft > 0 ? `Next spin in ${fmtCountdown(cooldownLeft)}` : "Pull the lever to spin"}
              className={`h-12 min-h-[44px] w-full select-none rounded-none font-mono text-[11px] font-black uppercase tracking-[0.24em] transition-all ${
                canSpin
                  ? "border border-amber-200/40 bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 text-black shadow-[0_0_25px_rgba(251,191,36,0.35)] hover:shadow-[0_0_40px_rgba(251,191,36,0.6)] active:scale-[0.98]"
                  : spinning
                  ? "border border-purple-400/30 bg-gradient-to-r from-purple-900 via-purple-800 to-purple-900 text-purple-200 animate-pulse"
                  : "border border-purple-500/20 bg-neutral-900 text-slate-500"
              }`}
            >
              {spinning ? (
                <span className="flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4 animate-pulse" /> Reels spinning
                </span>
              ) : cooldownLeft > 0 ? (
                <span className="flex items-center justify-center gap-2">
                  <Lock className="h-4 w-4" />
                  {cooldownLeft > 3600000
                    ? `Come back in ${Math.ceil(cooldownLeft / 3600000)}h`
                    : cooldownLeft > 60000
                    ? `${Math.ceil(cooldownLeft / 60000)} min left`
                    : `${Math.ceil(cooldownLeft / 1000)}s left`
                  }
                </span>
              ) : (
                <motion.span
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="flex items-center justify-center gap-2"
                >
                  <Sparkles className="h-4 w-4" /> Pull the lever
                </motion.span>
              )}
            </Button>

            {/* Progress ring indicator below button */}
            <div className="mt-2 flex items-center justify-center gap-2">
              <div className="relative inline-flex items-center justify-center">
                <ProgressRing progress={collectionProgress} size={28} strokeWidth={2} />
                <span className="text-[9px] font-mono text-purple-300/60">{earnedCount}</span>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-purple-300/40">
                Collection {Math.round(collectionProgress * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* ─── Lucky Meter (pity system) ─── */}
        <LuckyMeter spinsSinceWin={spinsSinceWin} />

        {/* ─── Badge Grid with Tier Grouping ─── */}
        <div className="mt-5 border-t border-purple-500/15 pt-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="text-[9px] font-mono uppercase tracking-wider text-purple-200/50">
              Prize Ladder · {earnedCount}/{totalBadges}
            </p>
            <span className="inline-flex items-center gap-1 border border-purple-400/15 bg-black/40 px-2 py-0.5 text-[9px] font-mono uppercase text-purple-200/60">
              <Gem className="h-2.5 w-2.5" /> {totalBadges} rewards
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-4 sm:gap-2">
            {TIER_ORDER.map((tierName) => {
              const group = badgesByTier[tierName];
              if (!group) return null;
              return (
                <React.Fragment key={tierName}>
                  <TierGroupHeader
                    tierName={tierName}
                    ownedCount={group.ownedCount}
                    totalCount={group.totalCount}
                  />
                  {group.badges.map((badge) => (
                    <BadgeCard
                      key={badge.id}
                      badge={badge}
                      owned={ownedIds.includes(badge.id)}
                      isNewWin={lastWonBadgeId === badge.id}
                      isRecentlyWon={ownedIds.includes(badge.id) && isBadgeNew(badge.id)}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </div>

          {!isAuthenticated && earnedCount > 0 && (
            <p className="mt-2.5 text-[10px] text-slate-500">
              Log in to show your badges next to your name in the forum.
            </p>
          )}
        </div>

        {/* ─── Win History ─── */}
        <WinHistoryLog />

        {/* ─── Statistics ─── */}
        <StatsPanel
          totalSpins={totalSpins}
          ownedCount={earnedCount}
          totalBadges={totalBadges}
          streak={streak}
          topBadge={topOwnedBadge}
        />
      </div>
    </motion.div>
  );
}
