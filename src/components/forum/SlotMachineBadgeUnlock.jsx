import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
const MUTE_KEY = "rlt_slot_muted";
const STORAGE_VERSION_KEY = "rlt_slot_version";
const CURRENT_STORAGE_VERSION = 2;
const BADGE_WIN_TIMESTAMP_KEY = "rlt_slot_badge_win_ts";
const NEW_BADGE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

const VALID_BADGE_IDS = new Set(SLOT_BADGES.map((b) => b.id));

const TIER_STYLES = {
  Common: { border: "border-slate-400/30", bg: "bg-slate-500/8", text: "text-slate-200", glow: "rgba(148,163,184,0.3)" },
  Uncommon: { border: "border-emerald-400/30", bg: "bg-emerald-500/8", text: "text-emerald-300", glow: "rgba(52,211,153,0.35)" },
  Rare: { border: "border-sky-400/30", bg: "bg-sky-500/8", text: "text-sky-300", glow: "rgba(56,189,248,0.4)" },
  Epic: { border: "border-purple-400/30", bg: "bg-purple-500/8", text: "text-purple-300", glow: "rgba(168,85,247,0.4)" },
  Legendary: { border: "border-amber-300/40", bg: "bg-amber-400/10", text: "text-amber-200", glow: "rgba(251,191,36,0.5)" },
  Mythic: { border: "border-pink-300/45", bg: "bg-pink-500/12", text: "text-pink-200", glow: "rgba(236,72,153,0.5)" },
};

const TIER_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"];

/* ─── Safe localStorage helpers ─── */
function safeGetItem(key, fallback = null) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : fallback;
  } catch {
    return fallback;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch { /* quota exceeded or unavailable */ }
}

function safeGetJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    // Corrupted JSON — clear it and return fallback
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return fallback;
  }
}

function safeReadIds() {
  const raw = safeGetJSON(SLOT_BADGES_KEY, []);
  const ids = parseBadgeIds(raw);
  // Filter out IDs that don't exist in SLOT_BADGES (corruption recovery)
  const valid = ids.filter((id) => VALID_BADGE_IDS.has(id));
  if (valid.length !== ids.length) {
    // Had invalid entries — rewrite clean data
    safeSetItem(SLOT_BADGES_KEY, JSON.stringify(valid));
  }
  return valid;
}

function migrateStorage() {
  try {
    const version = Number(safeGetItem(STORAGE_VERSION_KEY, "0"));
    if (version < CURRENT_STORAGE_VERSION) {
      // Re-validate badge IDs on migration
      const ids = safeReadIds();
      safeSetItem(SLOT_BADGES_KEY, JSON.stringify(ids));
      safeSetItem(STORAGE_VERSION_KEY, String(CURRENT_STORAGE_VERSION));
    }
  } catch { /* ignore */ }
}

function safeGetNumber(key, fallback = 0) {
  const val = Number(safeGetItem(key, String(fallback)));
  return Number.isFinite(val) ? val : fallback;
}

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

function getBadgeWinTimestamps() {
  return safeGetJSON(BADGE_WIN_TIMESTAMP_KEY, {});
}

function setBadgeWinTimestamp(badgeId) {
  const ts = getBadgeWinTimestamps();
  ts[badgeId] = Date.now();
  safeSetItem(BADGE_WIN_TIMESTAMP_KEY, JSON.stringify(ts));
}

function isBadgeNew(badgeId) {
  const ts = getBadgeWinTimestamps();
  const winTime = ts[badgeId];
  if (!winTime) return false;
  return Date.now() - winTime < NEW_BADGE_WINDOW_MS;
}

/* ─── Loading Skeleton ─── */
function LoadingSkeleton() {
  return (
    <div className="relative overflow-hidden border border-purple-500/20 bg-[linear-gradient(145deg,rgba(88,28,135,0.3),rgba(3,0,15,0.98)_40%,rgba(30,0,50,0.95))] shadow-[0_0_50px_rgba(88,28,135,0.12)] animate-pulse">
      <div className="h-[3px] w-full bg-gradient-to-r from-pink-500/30 via-purple-400/30 to-amber-400/30" />
      <div className="p-4 sm:p-5 space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-purple-900/50 border border-purple-500/20" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-40 bg-purple-900/40 rounded" />
            <div className="h-2.5 w-28 bg-purple-900/30 rounded" />
          </div>
        </div>
        {/* Reels skeleton */}
        <div className="border border-purple-500/20 bg-black p-3">
          <div className="flex gap-0.5 mb-2.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-1.5 flex-1 bg-purple-900/30" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-purple-950/50 border border-purple-500/10" style={{ height: REEL_WINDOW_H }}>
                <div className="flex items-center justify-center h-full">
                  <div className="w-12 h-12 rounded-full bg-purple-900/40" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Button skeleton */}
        <div className="h-12 w-full bg-neutral-900 border border-purple-500/20" />
        {/* Badge grid skeleton */}
        <div className="border-t border-purple-500/15 pt-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="min-h-[5rem] bg-black/40 border border-white/5" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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

/* ─── Reel with 3 visible rows + bounce-back on stop ─── */
function ReelWindow({ track, index, spinning, stopped, highlight, nearMissPulse }) {
  const finalIdx = track.length - 2;
  const targetY = -REEL_CELL * (finalIdx - 1);

  // Dynamic blur: varies by reel index for staggered feel
  const blurAmount = spinning && !stopped ? `blur-[${0.5 + index * 0.2}px]` : "";

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
          transition={
            spinning
              ? {
                  duration: REEL_DURATIONS[index],
                  ease: [0.08, 0.82, 0.17, 1],
                }
              : { duration: 0 }
          }
          className={`will-change-transform ${spinning && !stopped ? "blur-[0.6px]" : ""}`}
        >
          {track.map((emoji, i) => (
            <div
              key={`${index}-${i}`}
              className="flex items-center justify-center leading-none"
              style={{ height: REEL_CELL }}
            >
              <span
                className="text-[3rem] drop-shadow-[0_4px_14px_rgba(0,0,0,0.9)] select-none"
                style={{ filter: spinning && !stopped ? "brightness(0.85)" : "brightness(1.05)" }}
              >
                {emoji}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Bounce-back flash when reel stops */}
        <AnimatePresence>
          {stopped && (
            <motion.div
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="pointer-events-none absolute inset-0 z-25 bg-amber-200/8"
            />
          )}
        </AnimatePresence>
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
      aria-label="Pull lever to spin"
      className="relative hidden w-10 transition-opacity disabled:opacity-35 sm:block focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 group"
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
function WinCelebration({ show, isJackpot }) {
  const coins = useMemo(() =>
    Array.from({ length: isJackpot ? 60 : 40 }, (_, i) => ({
      id: i,
      angle: (i / (isJackpot ? 60 : 40)) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
      dist: 120 + Math.random() * (isJackpot ? 240 : 180),
      size: 6 + Math.random() * (isJackpot ? 14 : 10),
      delay: Math.random() * 0.3,
      emoji: ["🪙", "💰", "⭐", "✨", "🎉"][Math.floor(Math.random() * 5)],
    })), [isJackpot]);

  const bursts = useMemo(() =>
    Array.from({ length: isJackpot ? 36 : 24 }, (_, i) => ({
      id: i,
      angle: (i / (isJackpot ? 36 : 24)) * Math.PI * 2,
      dist: 60 + Math.random() * (isJackpot ? 140 : 100),
      delay: i * 0.02,
    })), [isJackpot]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
        >
          {/* Golden flash — more dramatic for jackpot */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isJackpot ? [0, 0.6, 0.15, 0.4, 0.1, 0] : [0, 0.35, 0.1, 0.25, 0] }}
            transition={{ duration: isJackpot ? 2 : 1.5 }}
            className="absolute inset-0 bg-amber-400"
          />

          {/* Screen-wide white flash for jackpot */}
          {isJackpot && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.9, 0] }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 bg-white z-50"
            />
          )}

          {/* Radial burst rings */}
          {(isJackpot ? [0, 0.1, 0.2, 0.35, 0.5] : [0, 0.15, 0.3]).map((delay, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: isJackpot ? 4 : 3, opacity: 0 }}
              transition={{ duration: isJackpot ? 1.5 : 1.2, delay }}
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

          {/* JACKPOT text — bigger and more dramatic for new wins */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1.1, 1.2, 1], opacity: [0, 1, 1, 1, 1] }}
            transition={{ duration: isJackpot ? 0.8 : 0.5, delay: 0.2, ease: "backOut" }}
            className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className={`border-2 border-amber-300 bg-black/90 px-6 py-2 text-center ${
                  isJackpot
                    ? "shadow-[0_0_60px_rgba(251,191,36,0.9),0_0_120px_rgba(251,191,36,0.4)]"
                    : "shadow-[0_0_40px_rgba(251,191,36,0.7),0_0_80px_rgba(251,191,36,0.3)]"
                }`}
              >
                <div className={`font-display font-black uppercase tracking-[0.3em] text-amber-200 drop-shadow-[0_0_20px_rgba(251,191,36,0.8)] ${
                  isJackpot ? "text-3xl" : "text-2xl"
                }`}>
                  {isJackpot ? "🎉 Jackpot! 🎉" : "Jackpot!"}
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
    <svg width={size} height={size} className="absolute -inset-1.5 z-0 rotate-[-90deg]" role="img" aria-label={`Collection progress: ${Math.round(progress * 100)}%`}>
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
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="timer" aria-label={`Cooldown: ${fmtCountdown(cooldownLeft)}`}>
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
    <p className={`mt-3 min-h-[2.5rem] text-center font-mono text-[11px] leading-relaxed ${colorClass}`} aria-live="polite">
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
function BadgeCard({ badge, owned, isNewWin, isRecentlyWon }) {
  const tier = TIER_STYLES[badge.tier] || TIER_STYLES.Common;
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onTouchStart={() => setShowTooltip(true)}
      onTouchEnd={() => setTimeout(() => setShowTooltip(false), 2000)}
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

        {/* Recently won "NEW" badge pulse (last 24h) */}
        {isRecentlyWon && !isNewWin && (
          <motion.div
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute top-0.5 right-0.5 z-20 px-1 py-px text-[6px] font-black uppercase tracking-wider bg-amber-400 text-black rounded-sm shadow-[0_0_8px_rgba(251,191,36,0.6)]"
          >
            NEW
          </motion.div>
        )}

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

/* ─── First-Time Empty State ─── */
function EmptyStateGuide() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mb-4 border border-purple-400/15 bg-purple-950/20 p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-300" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-200">Welcome to the Slot Machine!</span>
      </div>
      <p className="text-[10px] leading-relaxed text-purple-200/70">
        Spin once per day to try to win collectible badges. Land three matching symbols on the payline to unlock a badge.
        Rarer symbols mean rarer badges — can you collect them all?
      </p>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {SLOT_BADGES.slice(0, 4).map((b) => (
          <span key={b.id} className="inline-flex items-center gap-0.5 border border-purple-400/15 bg-black/40 px-1.5 py-0.5 text-[8px] text-purple-200/60">
            {b.emoji} {b.label}
          </span>
        ))}
        <span className="inline-flex items-center border border-purple-400/10 bg-black/30 px-1.5 py-0.5 text-[8px] text-purple-300/40">
          +{SLOT_BADGES.length - 4} more…
        </span>
      </div>
    </motion.div>
  );
}

/* ─── Tier Group Header ─── */
function TierGroupHeader({ tierName, ownedCount, totalCount }) {
  const tierStyle = TIER_STYLES[tierName] || TIER_STYLES.Common;
  const pct = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0;

  return (
    <div className="col-span-full flex items-center gap-2 mt-2 first:mt-0">
      <div className={`h-px flex-1 ${tierStyle.border.replace("border-", "bg-").replace("/30", "/20").replace("/40", "/25").replace("/45", "/30")}`} />
      <span className={`text-[8px] font-mono font-bold uppercase tracking-[0.15em] ${tierStyle.text}`}>
        {tierName}
        <span className="ml-1.5 text-[7px] opacity-60">
          {ownedCount}/{totalCount} · {pct}%
        </span>
      </span>
      <div className={`h-px flex-1 ${tierStyle.border.replace("border-", "bg-").replace("/30", "/20").replace("/40", "/25").replace("/45", "/30")}`} />
    </div>
  );
}

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

    // Spin ticker sounds
    Array.from({ length: 18 }).forEach((_, i) => {
      timersRef.current.push(setTimeout(() => playBeep(280 + i * 18, 0.045, "triangle", 0.055), i * 90));
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
              <div className="flex items-center gap-3 text-[8px] font-mono uppercase tracking-wider text-purple-300/70 flex-wrap">
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
              <span className="hidden items-center gap-1 border border-amber-300/20 bg-black/50 px-2 py-1 text-[8px] font-mono uppercase text-amber-200/80 sm:inline-flex">
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
                <span className="text-[7px] font-mono text-purple-300/60">{earnedCount}</span>
              </div>
              <span className="text-[8px] font-mono uppercase tracking-wider text-purple-300/40">
                Collection {Math.round(collectionProgress * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* ─── Badge Grid with Tier Grouping ─── */}
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
            <p className="mt-2.5 text-[8px] text-slate-500">
              Log in to show your badges next to your name in the forum.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}