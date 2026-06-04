import { SLOT_SYMBOLS, SLOT_BADGES } from "@/lib/slot-badges";

/* ─── constants ─── */
export const ALL_EMOJIS = SLOT_SYMBOLS.map((s) => s.emoji);
export const REEL_CELL = 78;
export const VISIBLE_ROWS = 3;
export const REEL_WINDOW_H = REEL_CELL * VISIBLE_ROWS;
export const REEL_DURATIONS = [1.8, 2.4, 3.0];
export const SPINS_KEY = "rlt_slot_spins";
export const STREAK_KEY = "rlt_slot_streak";
export const STREAK_DATE_KEY = "rlt_slot_streak_date";
export const MUTE_KEY = "rlt_slot_muted";
export const STORAGE_VERSION_KEY = "rlt_slot_version";
export const CURRENT_STORAGE_VERSION = 2;
export const BADGE_WIN_TIMESTAMP_KEY = "rlt_slot_badge_win_ts";
export const NEW_BADGE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
export const WIN_HISTORY_KEY = "rlt_slot_win_history";
export const LAST_WIN_SPIN_KEY = "rlt_slot_last_win_spin";
export const MAX_HISTORY = 8;

export const VALID_BADGE_IDS = new Set(SLOT_BADGES.map((b) => b.id));

export const TIER_STYLES = {
  Common: { border: "border-slate-400/30", bg: "bg-slate-500/8", text: "text-slate-200", glow: "rgba(148,163,184,0.3)" },
  Uncommon: { border: "border-emerald-400/30", bg: "bg-emerald-500/8", text: "text-emerald-300", glow: "rgba(52,211,153,0.35)" },
  Rare: { border: "border-sky-400/30", bg: "bg-sky-500/8", text: "text-sky-300", glow: "rgba(56,189,248,0.4)" },
  Epic: { border: "border-purple-400/30", bg: "bg-purple-500/8", text: "text-purple-300", glow: "rgba(168,85,247,0.4)" },
  Legendary: { border: "border-amber-300/40", bg: "bg-amber-400/10", text: "text-amber-200", glow: "rgba(251,191,36,0.5)" },
  Mythic: { border: "border-pink-300/45", bg: "bg-pink-500/12", text: "text-pink-200", glow: "rgba(236,72,153,0.5)" },
};

export const TIER_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"];