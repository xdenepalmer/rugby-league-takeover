import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Check, Gem, Lock, Sparkles, Trophy, Volume2, VolumeX } from "lucide-react";
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

/* ─── constants ─── */
const ALL_EMOJIS = SLOT_SYMBOLS.map((s) => s.emoji);
const REEL_CELL = 90;
const VISIBLE_ROWS = 3;
const REEL_WINDOW_H = REEL_CELL * VISIBLE_ROWS;
const REEL_DURATIONS = [1.8, 2.4, 3.0];
const SPINS_KEY = "rlt_slot_spins";
const STREAK_KEY = "rlt_slot_streak";
const STREAK_DATE_KEY = "rlt_slot_streak_date";

const TIER_STYLES = {
  Common: { border: "border-slate-400/30", bg: "bg-slate-500/8", text: "text-slate-200", glow: "rgba(148,163,184,0.3)" },
  Uncommon: { border: "border-emerald-400/30", bg: "bg-emerald-500/8", text: "text-emerald-300", glow: "rgba(52,211,153,0.35)" },
  Rare: { border: "border-sky-400/30", bg: "bg-sky-500/8", text: "text-sky-300", glow: "rgba(56,189,248,0.4)" },
  Epic: { border: "border-purple-400/30", bg: "bg-purple-500/8", text: "text-purple-300", glow: "rgba(168,85,247,0.4)" },
  Legendary: { border: "border-amber-300/40", bg: "bg-amber-400/10", text: "text-amber-200", glow: "rgba(251,191,36,0.5)" },
  Mythic: { border: "border-pink-300/45", bg: "bg-pink-500/12", text: "text-pink-200", glow: "rgba(236,72,153,0.5)" },
};

const TIER_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"];

const readIds = () => parseBadgeIds(JSON.parse(localStorage.getItem(SLOT_BADGES_KEY) || "[]"));
const randomEmoji = () => ALL_EMOJIS[Math.floor(Math.random() * ALL_EMOJIS.length)];

const fmtCountdown = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const makeReelTrack = (finalEmoji, reelIndex) => {
  const length = 24 + reelIndex * 8;
  const track = Array.from({ length }, () => randomEmoji());
  const prevEmoji = randomEmoji();
  const nextEmoji = randomEmoji();
  track.push(prevEmoji, finalEmoji, nextEmoji);
  return track;
};

const getDateStr = (d = new Date()) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/* ─── Ambient Particles ─── */
function AmbientParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1.5 + Math.random() * 2.5,
      duration: 3 + Math.random() * 5,
      delay: Math.random() * 4,
    })), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle, rgba(251,191,36,0.6) 0%, transparent 70%)`,
          }}
          animate={{
            opacity: [0, 0.8, 0],
            scale: [0.5, 1.2, 0.5],
            y: [0, -20, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Neon Border Glow ─── */
function NeonGlow({ spinning, isWin }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-0"
      animate={{
        boxShadow: isWin
          ? [
              "inset 0 0 60px rgba(251,191,36,0.15), 0 0 40px rgba(251,191,36,0.2)",
              "inset 0 0 80px rgba(251,191,36,0.25), 0 0 60px rgba(251,191,36,0.35)",
              "inset 0 0 60px rgba(251,191,36,0.15), 0 0 40px rgba(251,191,36,0.2)",
            ]
          : spinning
          ? [
              "inset 0 0 30px rgba(168,85,247,0.08), 0 0 20px rgba(168,85,247,0.1)",
              "inset 0 0 50px rgba(168,85,247,0.15), 0 0 35px rgba(168,85,247,0.18)",
              "inset 0 0 30px rgba(168,85,247,0.08), 0 0 20px rgba(168,85,247,0.1)",
            ]
          : "inset 0 0 30px rgba(0,0,0,0.5), 0 0 15px rgba(168,85,247,0.05)",
      }}
      transition={{ duration: isWin ? 0.6 : 2, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/* ─── Reel with 3 visible rows ─── */
function ReelWindow({ track, index, spinning, highlight, nearMissPulse }) {
  const finalIdx = track.length - 2;
  const targetY = -REEL_CELL * (finalIdx - 1);

  return (
    <div className="relative">
      {/* Chrome frame */}
      <div
        className="absolute -inset-[3px] z-10 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, #d4d4d8 0%, #71717a 15%, #3f3f46 50%, #71717a 85%, #d4d4d8 100%)",
          padding: "3px",
        }}
      >
        <div className="h-full w-full bg-black" />
      </div>

      <div
        className="relative overflow-hidden z-20"
        style={{ height: REEL_WINDOW_H }}
      >
        {/* Top fade */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-10 bg-gradient-to-b from-black via-black/80 to-transparent" />
        {/* Bottom fade */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-10 bg-gradient-to-t from-black via-black/80 to-transparent" />
        {/* Center payline */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 -translate-y-1/2">
          <div className="h-[2px] bg-gradient-to-r from-transparent via-amber-400/70 to-transparent shadow-[0_0_12px_rgba(251,191,36,0.7)]" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-3 bg-amber-400/50" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-3 bg-amber-400/50" />
        </div>

        {/* Highlight glow for near-miss matching reels */}
        <AnimatePresence>
          {highlight && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, repeat: 3 }}
              className="pointer-events-none absolute inset-0 z-25 border-2 border-emerald-400/60"
              style={{ boxShadow: "inset 0 0 30px rgba(52,211,153,0.3), 0 0 20px rgba(52,211,153,0.3)" }}
            />
          )}
        </AnimatePresence>

        {/* Near-miss pulse for the odd reel */}
        <AnimatePresence>
          {nearMissPulse && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.2, 0.6, 0.2] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, repeat: 5 }}
              className="pointer-events-none absolute inset-0 z-25 border-2 border-red-400/60"
              style={{ boxShadow: "inset 0 0 30px rgba(248,113,113,0.3), 0 0 20px rgba(248,113,113,0.3)" }}
            />
          )}
        </AnimatePresence>

        {/* Inner radial shading */}
        <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_50%_50%,transparent_30%,rgba(0,0,0,0.7)_100%)]" />

        <motion.div
          key={`reel-${index}-${track.join("")}`}
          initial={{ y: 0 }}
          animate={{ y: spinning ? targetY : 0 }}
          transition={{
            duration: REEL_DURATIONS[index],
            ease: [0.08, 0.82, 0.17, 1],
          }}
          className={`will-change-transform ${spinning ? "blur-[0.6px]" : ""}`}
        >
          {track.map((emoji, i) => (
            <div
              key={`${index}-${i}`}
              className="flex items-center justify-center leading-none"
              style={{ height: REEL_CELL }}
            >
              <span
                className="text-[3rem] drop-shadow-[0_4px_14px_rgba(0,0,0,0.9)] select-none"
                style={{ filter: spinning ? "brightness(0.85)" : "brightness(1.05)" }}
              >
                {emoji}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Side Lever ─── */
function Lever({ canSpin, leverDown, onPull }) {
  return (
    <button
      type="button"
      disabled={!canSpin}
      onClick={onPull}
      className="relative hidden w-10 transition-opacity disabled:opacity-35 sm:block focus:outline-none group"
      title="Pull the lever"
      style={{ height: REEL_WINDOW_H }}
    >
      {/* Rail track */}
      <div className="absolute left-1/2 top-6 bottom-3 w-[6px] -translate-x-1/2 rounded-full bg-gradient-to-b from-zinc-600 via-zinc-700 to-zinc-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]" />

      {/* Spring coil indicator */}
      <div className="absolute left-1/2 bottom-4 -translate-x-1/2 w-3 h-6">
        <motion.div
          animate={{ scaleY: leverDown ? 0.4 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="w-full h-full origin-bottom"
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[5px] border-x border-zinc-500/60 mx-0.5" style={{ borderBottom: "1px solid rgba(113,113,122,0.4)" }} />
          ))}
        </motion.div>
      </div>

      {/* Ball handle */}
      <motion.div
        animate={{ y: leverDown ? 140 : 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 14 }}
        className="absolute left-1/2 top-2 -translate-x-1/2 z-10"
      >
        {/* Shaft */}
        <div className="absolute left-1/2 top-6 -translate-x-1/2 w-[5px] h-20 bg-gradient-to-b from-zinc-400 via-zinc-500 to-zinc-600 shadow-[2px_0_4px_rgba(0,0,0,0.5)]" />
        {/* Chrome ball */}
        <div
          className="relative w-9 h-9 rounded-full border border-zinc-300/50 shadow-[0_0_20px_rgba(239,68,68,0.5),inset_0_-3px_6px_rgba(0,0,0,0.5)]"
          style={{
            background: "radial-gradient(circle at 35% 30%, #ef4444 0%, #b91c1c 50%, #7f1d1d 100%)",
          }}
        >
          {/* Highlight */}
          <div className="absolute top-1 left-2 w-3 h-2 rounded-full bg-white/30 blur-[1px]" />
        </div>
      </motion.div>
    </button>
  );
}

/* ─── Win Celebration: massive golden explosion ─── */
function WinCelebration({ show }) {
  const coins = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      angle: (i / 40) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
      dist: 120 + Math.random() * 180,
      size: 6 + Math.random() * 10,
      delay: Math.random() * 0.3,
      emoji: ["🪙", "💰", "⭐", "✨", "🎉"][Math.floor(Math.random() * 5)],
    })), []);

  const bursts = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      angle: (i / 24) * Math.PI * 2,
      dist: 60 + Math.random() * 100,
      delay: i * 0.02,
    })), []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
        >
          {/* Golden flash */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.35, 0.1, 0.25, 0] }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0 bg-amber-400"
          />

          {/* Radial burst rings */}
          {[0, 0.15, 0.3].map((delay, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 1.2, delay }}
              className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full border-4 border-amber-300/50"
            />
          ))}

          {/* Particle burst */}
          {bursts.map((b) => (
            <motion.div
              key={b.id}
              initial={{ x: "50%", y: "33%", scale: 0, opacity: 1 }}
              animate={{
                x: `calc(50% + ${Math.cos(b.angle) * b.dist}px)`,
                y: `calc(33% + ${Math.sin(b.angle) * b.dist}px)`,
                scale: [0, 1.5, 0],
                opacity: [1, 1, 0],
              }}
              transition={{ duration: 1, delay: b.delay }}
              className="absolute w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,1)]"
            />
          ))}

          {/* Cascading coins */}
          {coins.map((c) => (
            <motion.div
              key={c.id}
              initial={{ x: "50%", y: "33%", scale: 0, opacity: 1 }}
              animate={{
                x: `calc(50% + ${Math.cos(c.angle) * c.dist}px)`,
                y: `calc(33% + ${Math.sin(c.angle) * c.dist + 100}px)`,
                scale: [0, 1.3, 0.8],
                opacity: [1, 1, 0],
                rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
              }}
              transition={{ duration: 1.8, delay: c.delay, ease: "easeOut" }}
              className="absolute text-lg select-none"
              style={{ fontSize: c.size }}
            >
              {c.emoji}
            </motion.div>
          ))}

          {/* JACKPOT text */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 1] }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="border-2 border-amber-300 bg-black/90 px-6 py-2 text-center shadow-[0_0_40px_rgba(251,191,36,0.7),0_0_80px_rgba(251,191,36,0.3)]"
              >
                <div className="font-display text-2xl font-black uppercase tracking-[0.3em] text-amber-200 drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]">
                  Jackpot!
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Circular Progress Ring ─── */
function ProgressRing({ progress, size = 72, strokeWidth = 3 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - progress * circumference;

  return (
    <svg width={size} height={size} className="absolute -inset-1.5 z-0 rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(168,85,247,0.15)" strokeWidth={strokeWidth} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#progressGrad)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      <defs>
        <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ─── Cooldown Timer Ring ─── */
function CooldownRing({ cooldownLeft, size = 52, strokeWidth = 3 }) {
  const progress = Math.max(0, Math.min(1, cooldownLeft / SPIN_COOLDOWN_MS));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - progress * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute rotate-[-90deg]">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(100,100,120,0.2)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(168,85,247,0.6)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <Lock className="h-4 w-4 text-purple-400/70" />
    </div>
  );
}

/* ─── Typewriter Message ─── */
function TypewriterMessage({ text, type }) {
  const [displayed, setDisplayed] = useState("");
  const prevTextRef = useRef("");

  useEffect(() => {
    if (text === prevTextRef.current) return;
    prevTextRef.current = text;
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [text]);

  const colorClass = type === "win"
    ? "text-amber-200 font-black uppercase tracking-wider drop-shadow-[0_0_14px_rgba(251,191,36,0.6)]"
    : type === "near"
    ? "text-emerald-300 font-bold"
    : type === "loss"
    ? "text-red-300/80"
    : "text-slate-300";

  return (
    <p className={`mt-3 min-h-[2.5rem] text-center font-mono text-[11px] leading-relaxed ${colorClass}`}>
      {displayed}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="inline-block w-[2px] h-3 bg-current ml-0.5 align-middle"
      />
    </p>
  );
}

/* ─── Badge Card ─── */
function BadgeCard({ badge, owned, isNewWin }) {
  const tier = TIER_STYLES[badge.tier] || TIER_STYLES.Common;
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <motion.div
        layout
        className={`group relative min-h-[5rem] overflow-hidden border p-2 text-center transition-all ${
          owned
            ? `${tier.border} ${tier.bg} ${tier.text}`
            : "border-white/5 bg-black/40"
        }`}
        style={owned ? { boxShadow: `0 0 20px ${tier.glow}` } : {}}
      >
        {/* Top highlight line */}
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={owned ? {
            background: `linear-gradient(to right, transparent, ${tier.glow}, transparent)`,
          } : {}}
        />

        {/* New win golden pulse */}
        <AnimatePresence>
          {isNewWin && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.6, 0] }}
              transition={{ duration: 1.5, repeat: 3 }}
              className="absolute inset-0 bg-amber-400/20 z-0"
              style={{ boxShadow: "inset 0 0 30px rgba(251,191,36,0.4)" }}
            />
          )}
        </AnimatePresence>

        {/* Emoji */}
        <motion.span
          className={`relative z-10 block text-2xl leading-none transition-transform ${
            owned ? "" : "grayscale opacity-20"
          }`}
          whileHover={owned ? { scale: 1.15 } : {}}
        >
          {owned ? badge.emoji : "❓"}
        </motion.span>

        {/* Label */}
        <span
          className={`relative z-10 mt-1.5 block truncate text-[8px] font-black uppercase leading-tight ${
            owned ? "text-current" : "text-slate-700"
          }`}
        >
          {owned ? badge.label : "???"}
        </span>

        {/* Tier indicator */}
        <span
          className={`relative z-10 mt-0.5 flex items-center justify-center gap-0.5 text-[7px] font-bold uppercase tracking-wide ${
            owned ? "text-current/80" : "text-slate-700"
          }`}
        >
          {owned ? <Check className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
          {badge.tier}
        </span>
      </motion.div>

      {/* Hover tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            className="absolute -top-16 left-1/2 -translate-x-1/2 z-50 w-36 border border-amber-300/20 bg-black/95 p-2 text-center shadow-[0_0_20px_rgba(0,0,0,0.8)]"
          >
            <div className="text-[10px] font-bold text-amber-200">{badge.label}</div>
            <div className="mt-0.5 text-[8px] text-slate-400">
              {badge.tier} · Rarity {badge.rarity}/12
            </div>
            <div className="mt-0.5 text-[8px] text-slate-500">
              {owned ? "✓ Unlocked" : `Land three ${badge.emoji}`}
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b border-amber-300/20 bg-black/95" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
export default function SlotMachineBadgeUnlock() {
  const { user, isAuthenticated, updateProfile } = useAuth();
  const [reels, setReels] = useState(["🎰", "🎰", "🎰"]);
  const [tracks, setTracks] = useState(() => reels.map((emoji) => [emoji]));
  const [spinning, setSpinning] = useState(false);
  const [leverDown, setLeverDown] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [message, setMessage] = useState("One spin a day — line up three to win a badge!");
  const [messageType, setMessageType] = useState("idle");
  const [isWin, setIsWin] = useState(false);
  const [lastWonBadgeId, setLastWonBadgeId] = useState(null);
  const [nearMissResult, setNearMissResult] = useState(null);
  const [ownedIds, setOwnedIds] = useState(() => { try { return readIds(); } catch { return []; } });
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [totalSpins, setTotalSpins] = useState(() => Number(localStorage.getItem(SPINS_KEY) || 0));
  const [streak, setStreak] = useState(() => Number(localStorage.getItem(STREAK_KEY) || 0));
  const [screenShake, setScreenShake] = useState(false);

  const audioCtxRef = useRef(null);
  const pendingSymbolsRef = useRef(null);
  const ownedIdsRef = useRef(ownedIds);
  const timersRef = useRef([]);
  const containerRef = useRef(null);

  useEffect(() => { ownedIdsRef.current = ownedIds; }, [ownedIds]);
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

  /* ─── Audio ─── */
  const initAudio = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
  };

  const playBeep = useCallback((freq, duration, type = "sine", volume = 0.1) => {
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
  }, [soundEnabled]);

  const playVictory = useCallback(() => {
    [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      setTimeout(() => playBeep(f, 0.34, "square", 0.12), i * 95)
    );
  }, [playBeep]);

  const playBuzzer = useCallback(() => {
    playBeep(170, 0.26, "sawtooth", 0.09);
    setTimeout(() => playBeep(126, 0.36, "sawtooth", 0.08), 130);
  }, [playBeep]);

  /* ─── Badge award ─── */
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

  /* ─── Streak logic ─── */
  const updateStreak = () => {
    const today = getDateStr();
    const lastDate = localStorage.getItem(STREAK_DATE_KEY);
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
    localStorage.setItem(STREAK_KEY, String(newStreak));
    localStorage.setItem(STREAK_DATE_KEY, today);
  };

  /* ─── Finish Spin ─── */
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
      setScreenShake(true);
      setLastWonBadgeId(result.badge.id);
      setNearMissResult(null);
      playVictory();
      awardBadge(result.badge);
      setMessageType("win");
      setMessage(
        already
          ? `${result.symbol.emoji}${result.symbol.emoji}${result.symbol.emoji} Jackpot hit — you already hold the ${result.badge.label} badge.`
          : `🎉 Jackpot! ${result.symbol.emoji}${result.symbol.emoji}${result.symbol.emoji} — unlocked the ${result.badge.label} badge!`
      );
      window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "slot_win", badge: result.badge.id } }));
      setTimeout(() => setScreenShake(false), 600);
    } else if (result.type === "near") {
      playBeep(523.25, 0.18, "triangle", 0.1);
      setMessageType("near");
      setMessage(`So close — two ${result.symbol.emoji}. The machine wants you back tomorrow.`);
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
  };

  /* ─── Handle Spin ─── */
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

    // Increment total spins
    const newSpins = totalSpins + 1;
    setTotalSpins(newSpins);
    localStorage.setItem(SPINS_KEY, String(newSpins));

    // Update streak
    updateStreak();

    setIsWin(false);
    setScreenShake(false);
    setLastWonBadgeId(null);
    setNearMissResult(null);
    setLeverDown(true);
    setMessageType("idle");
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
  const totalBadges = SLOT_BADGES.length;
  const collectionProgress = totalBadges > 0 ? earnedCount / totalBadges : 0;
  const topOwnedBadge = SLOT_BADGES.filter((b) => ownedIds.includes(b.id)).sort((a, b) => b.rarity - a.rarity)[0];

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
              animate={spinning ? { rotate: [0, 10, -10, 0] } : {}}
              transition={{ duration: 0.5, repeat: spinning ? Infinity : 0 }}
              className="grid h-10 w-10 place-items-center border border-purple-400/30 bg-black/60 text-xl shadow-[0_0_20px_rgba(168,85,247,0.2)]"
            >
              🎰
            </motion.div>
            <div>
              <h3 className="font-display text-base font-black uppercase tracking-[0.1em] text-amber-100">
                Vegas Slot Machine
              </h3>
              <div className="flex items-center gap-3 text-[8px] font-mono uppercase tracking-wider text-purple-300/70">
                <span>{earnedCount}/{totalBadges} rewards</span>
                <span className="text-amber-300/60">·</span>
                <span className="text-amber-200/60">SPINS: {totalSpins}</span>
                {streak > 0 && (
                  <>
                    <span className="text-amber-300/60">·</span>
                    <span className="text-orange-300/80">
                      🔥 {streak}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {topOwnedBadge && (
              <span className="hidden items-center gap-1 border border-amber-300/20 bg-black/50 px-2 py-1 text-[8px] font-mono uppercase text-amber-200/80 sm:inline-flex">
                <Trophy className="h-3 w-3" /> {topOwnedBadge.emoji} {topOwnedBadge.tier}
              </span>
            )}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="border border-purple-400/20 bg-black/55 p-2 text-muted-foreground transition-colors hover:text-purple-300"
              title={soundEnabled ? "Mute" : "Unmute"}
            >
              {soundEnabled ? (
                <Volume2 className="h-3.5 w-3.5 text-purple-300" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

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
                  highlight={nearMissResult?.matchIndices?.includes(index) || false}
                  nearMissPulse={nearMissResult?.oddIndex === index || false}
                />
              ))}
            </div>

            <Lever canSpin={canSpin} leverDown={leverDown} onPull={handleSpin} />
          </div>

          {/* Win celebration overlay */}
          <WinCelebration show={isWin} />
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
              className={`h-12 w-full select-none rounded-none font-mono text-[11px] font-black uppercase tracking-[0.24em] transition-all ${
                canSpin
                  ? "border border-amber-200/40 bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 text-black shadow-[0_0_25px_rgba(251,191,36,0.35)] hover:shadow-[0_0_40px_rgba(251,191,36,0.6)]"
                  : "border border-purple-500/20 bg-neutral-900 text-slate-500"
              }`}
            >
              {spinning ? (
                <span className="flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4 animate-pulse" /> Reels spinning
                </span>
              ) : cooldownLeft > 0 ? (
                <span className="flex items-center justify-center gap-2">
                  <Lock className="h-4 w-4" /> Next spin in {fmtCountdown(cooldownLeft)}
                </span>
              ) : (
                "Pull the lever"
              )}
            </Button>

            {/* Progress ring indicator below button */}
            <div className="mt-2 flex items-center justify-center gap-2">
              <div className="relative inline-flex items-center justify-center">
                <ProgressRing progress={collectionProgress} size={28} strokeWidth={2} />
                <span className="text-[7px] font-mono text-purple-300/60">{earnedCount}</span>
              </div>
              <span className="text-[8px] font-mono uppercase tracking-wider text-purple-300/40">
                Collection {Math.round(collectionProgress * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* ─── Badge Grid ─── */}
        <div className="mt-5 border-t border-purple-500/15 pt-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="text-[9px] font-mono uppercase tracking-wider text-purple-200/50">
              Prize Ladder · {earnedCount}/{totalBadges}
            </p>
            <span className="inline-flex items-center gap-1 border border-purple-400/15 bg-black/40 px-2 py-0.5 text-[7px] font-mono uppercase text-purple-200/60">
              <Gem className="h-2.5 w-2.5" /> {totalBadges} rewards
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {SLOT_BADGES.map((badge) => (
              <BadgeCard
                key={badge.id}
                badge={badge}
                owned={ownedIds.includes(badge.id)}
                isNewWin={lastWonBadgeId === badge.id}
              />
            ))}
          </div>

          {!isAuthenticated && earnedCount > 0 && (
            <p className="mt-2.5 text-[8px] text-slate-500">
              Log in to show your badges next to your name in the forum.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}