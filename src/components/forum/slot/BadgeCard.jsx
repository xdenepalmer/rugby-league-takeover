import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Lock } from "lucide-react";
import { TIER_STYLES } from "./slotConstants";

/* ─── Badge Card ─── */
export default function BadgeCard({ badge, owned, isNewWin, isRecentlyWon }) {
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
          className={`relative z-10 mt-1.5 block truncate text-[10px] font-black uppercase leading-tight ${
            owned ? "text-current" : "text-slate-700"
          }`}
        >
          {owned ? badge.label : "???"}
        </span>

        {/* Tier indicator */}
        <span
          className={`relative z-10 mt-0.5 flex items-center justify-center gap-0.5 text-[9px] font-bold uppercase tracking-wide ${
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
            <div className="mt-0.5 text-[10px] text-slate-400">
              {badge.tier} · Rarity {badge.rarity}/12
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500">
              {owned ? "✓ Unlocked" : `Land three ${badge.emoji}`}
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b border-amber-300/20 bg-black/95" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
