import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Gem, Lock, Sparkles, Trophy, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import {
  SLOT_SYMBOLS,
  SLOT_BADGES,
  spinReels,
  evaluateReels,
  parseBadgeIds,
  SPIN_COOLDOWN_MS,
  SLOT_BADGES_KEY,
  SLOT_LAST_SPIN_KEY,
} from "@/lib/slot-badges";

const ALL_EMOJIS = SLOT_SYMBOLS.map((s) => s.emoji);
const REEL_CELL = 76;
const REEL_DURATIONS = [1.65, 2.18, 2.72];
const TIER_STYLES = {
  Common: "text-slate-300 border-slate-500/25 bg-slate-500/5",
  Uncommon: "text-emerald-300 border-emerald-400/25 bg-emerald-400/5",
  Rare: "text-sky-300 border-sky-400/25 bg-sky-400/5",
  Epic: "text-purple-300 border-purple-400/25 bg-purple-400/5",
  Legendary: "text-amber-200 border-amber-300/35 bg-amber-300/[0.08]",
  Mythic: "text-pink-200 border-pink-300/40 bg-pink-400/10",
};
const readIds = () => parseBadgeIds(JSON.parse(localStorage.getItem(SLOT_BADGES_KEY) || "[]"));

const fmtCountdown = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const randomEmoji = () => ALL_EMOJIS[Math.floor(Math.random() * ALL_EMOJIS.length)];

const makeReelTrack = (finalEmoji, reelIndex) => {
  const length = 22 + reelIndex * 7;
  return Array.from({ length }, () => randomEmoji()).concat(finalEmoji);
};

function ReelWindow({ track, index, spinning }) {
  const targetY = -REEL_CELL * (track.length - 1);

  return (
    <div className="relative h-[76px] overflow-hidden border border-amber-300/35 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.10),rgba(0,0,0,0.92)_72%)] shadow-[inset_0_0_22px_rgba(0,0,0,0.95),0_0_18px_rgba(251,191,36,0.10)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-6 bg-gradient-to-b from-black via-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-6 bg-gradient-to-t from-black via-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-1 top-1/2 z-20 h-[2px] -translate-y-1/2 bg-gradient-to-r from-transparent via-amber-300/55 to-transparent shadow-[0_0_10px_rgba(251,191,36,0.55)]" />
      <motion.div
        key={`${index}-${track.join("")}`}
        initial={{ y: 0 }}
        animate={{ y: spinning ? targetY : 0 }}
        transition={{
          duration: REEL_DURATIONS[index],
          ease: [0.12, 0.78, 0.12, 1],
        }}
        className={`will-change-transform ${spinning ? "blur-[0.35px]" : ""}`}
      >
        {track.map((emoji, i) => (
          <div key={`${emoji}-${i}`} className="flex h-[76px] items-center justify-center text-[2.65rem] leading-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]">
            {emoji}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function WinBurst({ show }) {
  const particles = useMemo(() => Array.from({ length: 18 }, (_, i) => i), []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-30 overflow-hidden bg-amber-400/[0.06]"
        >
          <motion.div
            initial={{ scale: 0.6, rotate: -3 }}
            animate={{ scale: [0.6, 1.08, 1], rotate: [ -3, 2, 0 ] }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-amber-300 bg-black px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-amber-200 shadow-[0_0_26px_rgba(251,191,36,0.65)]"
          >
            Jackpot
          </motion.div>
          {particles.map((p) => (
            <motion.span
              key={p}
              initial={{ x: "50%", y: "50%", scale: 0, opacity: 1 }}
              animate={{
                x: `${50 + Math.cos((p / particles.length) * Math.PI * 2) * (34 + (p % 4) * 6)}%`,
                y: `${50 + Math.sin((p / particles.length) * Math.PI * 2) * (30 + (p % 5) * 5)}%`,
                scale: [0, 1.1, 0],
                opacity: [1, 1, 0],
              }}
              transition={{ duration: 1.2, delay: p * 0.025 }}
              className="absolute h-1.5 w-1.5 bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.9)]"
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function SlotMachineBadgeUnlock() {
  const { user, isAuthenticated, updateProfile } = useAuth();
  const [reels, setReels] = useState(["🎰", "🎰", "🎰"]);
  const [tracks, setTracks] = useState(() => reels.map((emoji) => [emoji]));
  const [spinning, setSpinning] = useState(false);
  const [leverDown, setLeverDown] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [message, setMessage] = useState("One spin a day — line up three to win a badge!");
  const [isWin, setIsWin] = useState(false);
  const [ownedIds, setOwnedIds] = useState(() => { try { return readIds(); } catch { return []; } });
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const audioCtxRef = useRef(null);
  const pendingSymbolsRef = useRef(null);
  const ownedIdsRef = useRef(ownedIds);
  const timersRef = useRef([]);

  useEffect(() => {
    ownedIdsRef.current = ownedIds;
  }, [ownedIds]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  useEffect(() => {
    const serverIds = parseBadgeIds(user?.badges);
    if (serverIds.length) setOwnedIds((prev) => Array.from(new Set([...prev, ...serverIds])));
  }, [user]);

  useEffect(() => {
    const tick = () => {
      const last = Number(localStorage.getItem(SLOT_LAST_SPIN_KEY) || 0);
      setCooldownLeft(Math.max(0, last + SPIN_COOLDOWN_MS - Date.now()));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const initAudio = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
  };

  const playBeep = (freq, duration, type = "sine", volume = 0.1) => {
    if (!soundEnabled) return;
    try {
      initAudio();
      const ctx = audioCtxRef.current;
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
  };

  const playVictory = () => {
    [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => setTimeout(() => playBeep(f, 0.34, "square", 0.12), i * 95));
  };

  const playBuzzer = () => {
    playBeep(170, 0.26, "sawtooth", 0.09);
    setTimeout(() => playBeep(126, 0.36, "sawtooth", 0.08), 130);
  };

  const awardBadge = (badge) => {
    if (ownedIdsRef.current.includes(badge.id)) return;
    const next = Array.from(new Set([...ownedIdsRef.current, badge.id]));
    ownedIdsRef.current = next;
    setOwnedIds(next);
    try { localStorage.setItem(SLOT_BADGES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    if (isAuthenticated) {
      try { Promise.resolve(updateProfile({ badges: next })).catch(() => {}); } catch { /* ignore */ }
    }
  };

  const finishSpin = () => {
    const finalSymbols = pendingSymbolsRef.current;
    if (!finalSymbols) return;

    const finalEmojis = finalSymbols.map((s) => s.emoji);
    setReels(finalEmojis);
    setTracks(finalEmojis.map((emoji) => [emoji]));
    setSpinning(false);
    setLeverDown(false);

    const result = evaluateReels(finalSymbols);
    if (result.type === "win") {
      const already = ownedIdsRef.current.includes(result.badge.id);
      setIsWin(true);
      playVictory();
      awardBadge(result.badge);
      setMessage(already
        ? `${result.symbol.emoji}${result.symbol.emoji}${result.symbol.emoji} Jackpot hit — you already hold the ${result.badge.label} badge.`
        : `🎉 Jackpot! ${result.symbol.emoji}${result.symbol.emoji}${result.symbol.emoji} — unlocked the ${result.badge.label} badge!`);
      window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "slot_win", badge: result.badge.id } }));
    } else if (result.type === "near") {
      playBeep(523.25, 0.18, "triangle", 0.1);
      setMessage(`So close — two ${result.symbol.emoji}. The machine wants you back tomorrow.`);
    } else {
      playBuzzer();
      setMessage("No luck this time. One spin a day — try again tomorrow!");
    }
  };

  const handleSpin = () => {
    if (spinning || cooldownLeft > 0) return;

    initAudio();
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const finalSymbols = spinReels();
    const nextTracks = finalSymbols.map((symbol, index) => makeReelTrack(symbol.emoji, index));
    pendingSymbolsRef.current = finalSymbols;

    localStorage.setItem(SLOT_LAST_SPIN_KEY, String(Date.now()));
    setCooldownLeft(SPIN_COOLDOWN_MS);
    setIsWin(false);
    setLeverDown(true);
    setMessage("Reels are rolling… watch the payline.");
    setTracks(nextTracks);
    setSpinning(true);

    timersRef.current.push(setTimeout(() => setLeverDown(false), 380));
    Array.from({ length: 18 }).forEach((_, i) => {
      timersRef.current.push(setTimeout(() => playBeep(280 + i * 18, 0.045, "triangle", 0.055), i * 90));
    });
    REEL_DURATIONS.forEach((duration, index) => {
      timersRef.current.push(setTimeout(() => playBeep(720 - index * 95, 0.12, "square", 0.08), duration * 1000));
    });
    timersRef.current.push(setTimeout(finishSpin, Math.max(...REEL_DURATIONS) * 1000 + 120));
  };

  const canSpin = !spinning && cooldownLeft <= 0;
  const earnedCount = ownedIds.length;
  const topOwnedBadge = SLOT_BADGES.filter((badge) => ownedIds.includes(badge.id)).sort((a, b) => b.rarity - a.rarity)[0];

  return (
    <div className="relative overflow-hidden border border-amber-400/25 bg-[linear-gradient(145deg,rgba(88,28,135,0.26),rgba(7,10,23,0.98)_38%,rgba(127,29,29,0.20))] shadow-[0_0_34px_rgba(251,191,36,0.10)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.18),transparent_34%),radial-gradient(circle_at_8%_20%,rgba(236,72,153,0.12),transparent_28%),radial-gradient(circle_at_92%_18%,rgba(249,115,22,0.12),transparent_28%)]" />
      <div className="relative h-[3px] w-full bg-gradient-to-r from-pink-500 via-amber-300 to-primary" />
      <div className="relative p-4 sm:p-5">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center border border-amber-300/40 bg-black/50 text-lg shadow-[0_0_18px_rgba(251,191,36,0.20)]">🎰</div>
            <div>
              <h3 className="font-display text-base font-black uppercase tracking-[0.08em] text-amber-100">Vegas Slot Machine</h3>
              <p className="text-[8px] font-mono uppercase tracking-wider text-amber-300/80">One free spin a day · {earnedCount}/{SLOT_BADGES.length} rewards</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {topOwnedBadge && (
              <span className="hidden items-center gap-1 border border-amber-300/25 bg-black/45 px-2 py-1 text-[8px] font-mono uppercase text-amber-200 sm:inline-flex">
                <Trophy className="h-3 w-3" /> {topOwnedBadge.emoji} {topOwnedBadge.tier}
              </span>
            )}
            <button type="button" onClick={() => setSoundEnabled(!soundEnabled)} className="border border-amber-300/25 bg-black/55 p-2 text-muted-foreground transition-colors hover:text-amber-200" title={soundEnabled ? "Mute" : "Unmute"}>
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-amber-300" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden border border-amber-300/35 bg-black p-2.5 shadow-[inset_0_0_35px_rgba(0,0,0,0.96),0_0_28px_rgba(251,191,36,0.12)]">
          <div className="mb-2 grid grid-cols-9 gap-1">
            {Array.from({ length: 18 }).map((_, i) => (
              <span key={i} className={`h-1.5 ${i % 2 ? "bg-pink-500/80" : "bg-amber-300/90"} ${spinning || isWin ? "animate-pulse" : "opacity-45"} shadow-[0_0_8px_currentColor]`} />
            ))}
          </div>

          <div className="relative grid grid-cols-[1fr_auto] gap-2">
            <div className="grid grid-cols-3 gap-2.5">
              {tracks.map((track, index) => (
                <ReelWindow key={index} track={track} index={index} spinning={spinning} />
              ))}
            </div>

            <button
              type="button"
              disabled={!canSpin}
              onClick={handleSpin}
              className="relative hidden w-8 border border-red-500/30 bg-gradient-to-b from-red-950 to-black shadow-[inset_0_0_12px_rgba(0,0,0,0.85)] transition-opacity disabled:opacity-45 sm:block"
              title="Pull the lever"
            >
              <motion.span
                animate={{ y: leverDown ? 44 : 5 }}
                transition={{ type: "spring", stiffness: 280, damping: 13 }}
                className="absolute left-1/2 top-0 h-7 w-7 -translate-x-1/2 rounded-full border border-red-200/60 bg-gradient-to-br from-red-400 to-red-800 shadow-[0_0_16px_rgba(239,68,68,0.55)]"
              />
              <span className="absolute left-1/2 top-8 h-12 w-1 -translate-x-1/2 bg-red-900/80" />
            </button>
          </div>

          <div className="mt-2 flex items-center justify-center gap-2 text-[8px] font-mono uppercase tracking-[0.28em] text-amber-200/65">
            <ChevronDown className="h-3 w-3 animate-bounce text-amber-300" /> Payline <ChevronDown className="h-3 w-3 animate-bounce text-amber-300" />
          </div>

          <WinBurst show={isWin} />
        </div>

        <p className={`mt-3 min-h-[2rem] text-center font-mono text-[10px] leading-relaxed ${isWin ? "font-black uppercase tracking-wide text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.55)]" : "text-slate-300"}`}>
          {message}
        </p>

        <div className="mt-3">
          <Button
            type="button"
            disabled={!canSpin}
            onClick={handleSpin}
            className={`h-10 w-full select-none rounded-none font-mono text-[10px] font-black uppercase tracking-[0.24em] transition-all ${
              canSpin
                ? "border border-amber-200/40 bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.35)] hover:shadow-[0_0_30px_rgba(251,191,36,0.55)]"
                : "border border-border bg-neutral-900 text-slate-500"
            }`}
          >
            {spinning ? (
              <span className="flex items-center justify-center gap-2"><Sparkles className="h-3.5 w-3.5 animate-pulse" /> Reels spinning</span>
            ) : cooldownLeft > 0 ? (
              <span className="flex items-center justify-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Next spin in {fmtCountdown(cooldownLeft)}</span>
            ) : "Pull the lever"}
          </Button>
        </div>

        <div className="mt-4 border-t border-amber-300/15 pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[8px] font-mono uppercase tracking-wider text-amber-200/55">Prize ladder · {earnedCount}/{SLOT_BADGES.length}</p>
            <span className="inline-flex items-center gap-1 border border-amber-300/20 bg-black/35 px-1.5 py-0.5 text-[7px] font-mono uppercase text-amber-200/70">
              <Gem className="h-2.5 w-2.5" /> 12 rewards
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {SLOT_BADGES.map((badge) => {
              const owned = ownedIds.includes(badge.id);
              const tierStyle = TIER_STYLES[badge.tier] || TIER_STYLES.Common;
              return (
                <div
                  key={badge.id}
                  title={owned ? `${badge.label} — unlocked` : `${badge.label} — locked (land three ${badge.emoji})`}
                  className={`group relative min-h-[4.25rem] overflow-hidden border p-1.5 text-center transition-all ${owned ? `${tierStyle} shadow-[0_0_16px_rgba(251,191,36,0.12)]` : "border-border/30 bg-black/35"}`}
                >
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-current to-transparent opacity-35" />
                  <span className={`block text-lg leading-none transition-transform group-hover:scale-110 ${owned ? "" : "opacity-25 grayscale"}`}>{badge.emoji}</span>
                  <span className={`mt-1 block truncate text-[7px] font-black uppercase leading-tight ${owned ? "text-current" : "text-slate-600"}`}>{badge.label}</span>
                  <span className={`mt-0.5 flex items-center justify-center gap-0.5 text-[6px] font-bold uppercase tracking-wide ${owned ? "text-current/80" : "text-slate-700"}`}>
                    {owned ? <Check className="h-2 w-2" /> : <Lock className="h-2 w-2" />} {badge.tier}
                  </span>
                </div>
              );
            })}
          </div>
          {!isAuthenticated && earnedCount > 0 && (
            <p className="mt-2 text-[8px] text-slate-500">Log in to show your badges next to your name in the forum.</p>
          )}
        </div>
      </div>
    </div>
  );
}