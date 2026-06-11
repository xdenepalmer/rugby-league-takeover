/* ━━━ FanRankCard ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Premium casino-rank progress card. Surfaces the XP / chips /
 * streak economy that forum actions feed (mirrors CASINO_RANKS
 * in functions/forumAction).
 */
import React from "react";
import { motion } from "framer-motion";
import { Crown, Coins, Flame, ChevronRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

const RANKS = [
  { min: 0, name: "Rookie Punter", emoji: "🎲" },
  { min: 60, name: "Lucky Local", emoji: "🍀" },
  { min: 180, name: "Table Regular", emoji: "🃏" },
  { min: 450, name: "Pit Boss", emoji: "🎩" },
  { min: 900, name: "High Roller", emoji: "💎" },
  { min: 1500, name: "Whale", emoji: "🐋" },
  { min: 2500, name: "Vegas Royalty", emoji: "👑" },
];

export default function FanRankCard() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="relative overflow-hidden border border-amber-400/20 bg-gradient-to-br from-amber-950/30 via-card/40 to-black/60">
        <div className="h-[2px] w-full bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />
        <div className="p-4 text-center">
          <p className="text-2xl">🎰</p>
          <p className="mt-1 font-display text-base uppercase tracking-wide text-amber-100">Earn Chips & Rank Up</p>
          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
            Post, reply and react to earn XP, chips and casino ranks — from Rookie Punter to Vegas Royalty.
          </p>
          <Link
            to="/login"
            className="mt-3 inline-flex min-h-9 items-center gap-1.5 border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300 transition-colors hover:bg-amber-400/20"
          >
            <Sparkles className="h-3 w-3" /> Log in to play
          </Link>
        </div>
      </div>
    );
  }

  const xp = Number(user?.casino_xp || 0);
  const chips = Number(user?.casino_chips || 0);
  const streak = Number(user?.casino_streak || 0);
  const currentIdx = [...RANKS].reverse().findIndex((r) => xp >= r.min);
  const current = RANKS[RANKS.length - 1 - Math.max(currentIdx, 0)] || RANKS[0];
  const next = RANKS[RANKS.indexOf(current) + 1] || null;
  const progress = next ? Math.min(1, (xp - current.min) / (next.min - current.min)) : 1;

  return (
    <div className="relative overflow-hidden border border-amber-400/20 bg-gradient-to-br from-amber-950/30 via-card/40 to-black/60">
      <div className="h-[2px] w-full bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, -4, 4, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="grid h-11 w-11 shrink-0 place-items-center border border-amber-300/30 bg-black/50 text-xl shadow-[0_0_20px_rgba(251,191,36,0.15)]"
          >
            {current.emoji}
          </motion.div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-amber-300/70">Your Casino Rank</p>
            <p className="truncate font-display text-lg uppercase leading-tight tracking-wide text-amber-100">
              {user?.casino_rank || current.name}
            </p>
          </div>
          <Crown className="h-4 w-4 shrink-0 text-amber-400/50" />
        </div>

        {/* XP progress to next rank */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-amber-200/60">
            <span>{xp} XP</span>
            {next ? (
              <span className="flex items-center gap-0.5">
                {next.emoji} {next.name} at {next.min} <ChevronRight className="h-2.5 w-2.5" />
              </span>
            ) : (
              <span>👑 Max rank achieved</span>
            )}
          </div>
          <div className="mt-1 h-2 overflow-hidden border border-amber-400/15 bg-black/50">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.4)]"
            />
          </div>
        </div>

        {/* Chips + streak */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 border border-border/30 bg-black/30 px-2.5 py-2">
            <Coins className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <p className="font-display text-base leading-none tabular-nums text-foreground">{chips}</p>
              <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Chips</p>
            </div>
          </div>
          <div className="flex items-center gap-2 border border-border/30 bg-black/30 px-2.5 py-2">
            <Flame className={`h-3.5 w-3.5 shrink-0 ${streak > 0 ? "text-orange-400" : "text-muted-foreground/40"}`} />
            <div className="min-w-0">
              <p className="font-display text-base leading-none tabular-nums text-foreground">{streak}</p>
              <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Day streak</p>
            </div>
          </div>
        </div>

        <p className="mt-2.5 text-[9px] leading-4 text-muted-foreground/60">
          Earn XP & chips by posting (+10), replying (+5) and reacting (+2). Daily activity adds streak bonuses.
        </p>
      </div>
    </div>
  );
}