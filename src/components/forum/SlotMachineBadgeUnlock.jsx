import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCw, Volume2, VolumeX, Lock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import {
  SLOT_SYMBOLS, SLOT_BADGES, spinReels, evaluateReels, parseBadgeIds,
  SPIN_COOLDOWN_MS, SLOT_BADGES_KEY, SLOT_LAST_SPIN_KEY,
} from "@/lib/slot-badges";

const ALL_EMOJIS = SLOT_SYMBOLS.map((s) => s.emoji);
const readIds = () => parseBadgeIds(JSON.parse(localStorage.getItem(SLOT_BADGES_KEY) || "[]"));
const fmtCountdown = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export default function SlotMachineBadgeUnlock() {
  const { user, isAuthenticated, updateProfile } = useAuth();
  const [reels, setReels] = useState(["🎰", "🎰", "🎰"]);
  const [spinning, setSpinning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [message, setMessage] = useState("One spin a day — line up three to win a badge!");
  const [isWin, setIsWin] = useState(false);
  const [ownedIds, setOwnedIds] = useState(() => { try { return readIds(); } catch { return []; } });
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const audioCtxRef = useRef(null);

  // Merge any badges already saved on the user's profile (e.g. won on another device).
  useEffect(() => {
    const serverIds = parseBadgeIds(user?.badges);
    if (serverIds.length) {
      setOwnedIds((prev) => Array.from(new Set([...prev, ...serverIds])));
    }
  }, [user]);

  // 24-hour cooldown countdown.
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
  const playBeep = (freq, duration, type = "sine") => {
    if (!soundEnabled) return;
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + duration);
    } catch { /* ignore */ }
  };
  const playVictory = () => {
    [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => playBeep(f, 0.45, "square"), i * 110));
  };
  const playBuzzer = () => { playBeep(180, 0.3, "sawtooth"); setTimeout(() => playBeep(140, 0.4, "sawtooth"), 150); };

  const awardBadge = (badge) => {
    if (ownedIds.includes(badge.id)) return;
    const next = Array.from(new Set([...ownedIds, badge.id]));
    setOwnedIds(next);
    try { localStorage.setItem(SLOT_BADGES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    // Persist to the profile so it shows on the forum (logged-in only).
    if (isAuthenticated) {
      try { Promise.resolve(updateProfile({ badges: next })).catch(() => {}); } catch { /* ignore */ }
    }
  };

  const handleSpin = () => {
    if (spinning || cooldownLeft > 0) return;
    initAudio();
    setSpinning(true);
    setIsWin(false);
    setMessage("Spinning the reels…");

    // Lock in the daily cooldown the moment they spin.
    localStorage.setItem(SLOT_LAST_SPIN_KEY, String(Date.now()));
    setCooldownLeft(SPIN_COOLDOWN_MS);

    let ticks = 0;
    const tickInterval = setInterval(() => {
      if (ticks < 8) { playBeep(330 + ticks * 40, 0.08, "triangle"); ticks++; } else clearInterval(tickInterval);
    }, 120);

    const duration = 1300;
    const start = Date.now();
    const finalSymbols = spinReels(); // the genuine outcome, decided up front

    const animate = () => {
      if (Date.now() - start < duration) {
        setReels([
          ALL_EMOJIS[Math.floor(Math.random() * ALL_EMOJIS.length)],
          ALL_EMOJIS[Math.floor(Math.random() * ALL_EMOJIS.length)],
          ALL_EMOJIS[Math.floor(Math.random() * ALL_EMOJIS.length)],
        ]);
        requestAnimationFrame(animate);
        return;
      }
      // Land on the real result and judge exactly what's shown.
      setReels(finalSymbols.map((s) => s.emoji));
      setSpinning(false);
      const result = evaluateReels(finalSymbols);

      if (result.type === "win") {
        setIsWin(true);
        playVictory();
        const already = ownedIds.includes(result.badge.id);
        awardBadge(result.badge);
        setMessage(already
          ? `${result.symbol.emoji}${result.symbol.emoji}${result.symbol.emoji} Three of a kind! You already hold the ${result.badge.label} badge.`
          : `🎉 Winner! ${result.symbol.emoji}${result.symbol.emoji}${result.symbol.emoji} — unlocked the ${result.badge.label} badge!`);
        window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "slot_win", badge: result.badge.id } }));
      } else if (result.type === "near") {
        playBeep(523.25, 0.15, "sine");
        setMessage(`So close — two ${result.symbol.emoji}. You need three to win. Come back tomorrow!`);
      } else {
        playBuzzer();
        setMessage("No luck this time. One spin a day — try again tomorrow!");
      }
    };
    requestAnimationFrame(animate);
  };

  const canSpin = !spinning && cooldownLeft <= 0;
  const earnedCount = ownedIds.length;

  return (
    <div className="border border-border/65 bg-card/30 cmd-glass overflow-hidden">
      <div className="h-[2px] w-full bg-gradient-to-r from-pink-500 via-primary to-pink-500" />
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="border border-pink-500/20 bg-pink-500/10 p-1.5 shadow-[0_0_10px_rgba(236,72,153,0.15)]"><span className="text-sm">🎰</span></div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Vegas Slot Machine</h3>
              <p className="text-[8px] font-mono uppercase tracking-wider text-pink-400">One free spin a day · {earnedCount}/{SLOT_BADGES.length} badges</p>
            </div>
          </div>
          <button type="button" onClick={() => setSoundEnabled(!soundEnabled)} className="border border-border/40 bg-neutral-900/60 p-1 text-muted-foreground transition-colors hover:text-foreground" title={soundEnabled ? "Mute" : "Unmute"}>
            {soundEnabled ? <Volume2 className="h-3 w-3 text-pink-400" /> : <VolumeX className="h-3 w-3" />}
          </button>
        </div>

        {/* Reels */}
        <div className="relative border border-border/80 bg-neutral-950 p-4 shadow-[inset_0_0_15px_rgba(0,0,0,0.9)]">
          <div className="absolute inset-0 pointer-events-none border border-pink-500/20" />
          <div className="relative z-10 grid grid-cols-3 gap-3">
            {reels.map((emoji, index) => (
              <div key={index} className="relative flex h-16 items-center justify-center overflow-hidden border border-border/60 bg-neutral-900 shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                <div className="absolute left-0 right-0 top-1/2 h-[1px] -translate-y-1/2 bg-pink-500/10" />
                <AnimatePresence mode="wait">
                  <motion.span key={`${emoji}_${index}_${spinning}`} initial={{ y: spinning ? -30 : 0, opacity: spinning ? 0.3 : 1 }} animate={{ y: 0, opacity: 1 }} exit={{ y: spinning ? 30 : 0, opacity: 0.3 }} transition={{ type: "spring", stiffness: 350, damping: 20 }} className="select-none text-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                    {emoji}
                  </motion.span>
                </AnimatePresence>
              </div>
            ))}
          </div>
          {isWin && (
            <div className="absolute inset-0 flex items-center justify-center bg-pink-500/[0.04] pointer-events-none animate-pulse">
              <div className="animate-bounce border border-pink-500 bg-black px-2 py-0.5 text-[9px] font-mono font-extrabold uppercase text-pink-400">🎉 Winner 🎉</div>
            </div>
          )}
        </div>

        <p className={`mt-3 text-center font-mono text-[10px] ${isWin ? "font-bold text-pink-400" : "text-slate-300"}`}>{message}</p>

        {/* Action / cooldown */}
        <div className="mt-3">
          <Button type="button" disabled={!canSpin} onClick={handleSpin}
            className={`h-9 w-full select-none rounded-none font-mono text-[10px] font-bold uppercase tracking-widest transition-all ${
              canSpin
                ? "bg-gradient-to-r from-pink-600 via-primary to-pink-600 text-white shadow-[0_0_12px_rgba(236,72,153,0.35)] hover:from-pink-500 hover:to-pink-500 hover:shadow-[0_0_18px_rgba(236,72,153,0.55)]"
                : "border border-border bg-neutral-800 text-slate-500"
            }`}>
            {spinning ? (
              <span className="flex items-center justify-center gap-1.5"><RotateCw className="h-3.5 w-3.5 animate-spin" /> Spinning…</span>
            ) : cooldownLeft > 0 ? (
              <span className="flex items-center justify-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Next spin in {fmtCountdown(cooldownLeft)}</span>
            ) : "Pull the lever"}
          </Button>
        </div>

        {/* Badge collection */}
        <div className="mt-3.5 border-t border-border/30 pt-3">
          <p className="mb-2 text-[8px] font-mono uppercase tracking-wider text-slate-400">Badge collection · {earnedCount}/{SLOT_BADGES.length}</p>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {SLOT_BADGES.map((b) => {
              const owned = ownedIds.includes(b.id);
              return (
                <div key={b.id} title={owned ? `${b.label} — unlocked` : `${b.label} — locked (land three ${b.emoji})`}
                  className={`flex flex-col items-center gap-1 border p-1.5 text-center ${owned ? "border-pink-500/40 bg-pink-500/[0.06]" : "border-border/30 bg-neutral-900/60"}`}>
                  <span className={`text-base leading-none ${owned ? "" : "opacity-30 grayscale"}`}>{b.emoji}</span>
                  <span className={`flex items-center gap-0.5 text-[7px] font-bold uppercase leading-tight ${owned ? "text-pink-300" : "text-slate-600"}`}>
                    {owned ? <Check className="h-2 w-2" /> : <Lock className="h-2 w-2" />}
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
