import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gem } from "lucide-react";
import { MAX_HISTORY } from "./slotConstants";
import { getWinHistory } from "./slotStorage";

/* ─── Statistics Panel ─── */
export default function StatsPanel({ totalSpins, ownedCount, totalBadges, streak, topBadge }) {
  const [expanded, setExpanded] = useState(false);
  const winHistory = useMemo(() => getWinHistory(), []);
  const winRate = totalSpins > 0 ? Math.round((winHistory.length / Math.min(totalSpins, MAX_HISTORY)) * 100) : 0;
  const collPct = totalBadges > 0 ? Math.round((ownedCount / totalBadges) * 100) : 0;

  return (
    <div className="mt-3 border border-purple-500/10 bg-black/30">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between p-2 text-[8px] font-mono uppercase tracking-wider text-purple-200/50 hover:text-purple-200/70 transition-colors"
      >
        <span className="flex items-center gap-1">
          <Gem className="h-3 w-3" /> Statistics
        </span>
        <motion.span animate={{ rotate: expanded ? 180 : 0 }}>▼</motion.span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-px bg-purple-500/10 mx-2 mb-2">
              {[
                { label: "Total Spins", value: totalSpins },
                { label: "Badges Won", value: `${ownedCount}/${totalBadges}` },
                { label: "Collection", value: `${collPct}%` },
                { label: "Win Rate", value: `~${winRate}%` },
                { label: "Streak", value: streak > 0 ? `🔥 ${streak} days` : "—" },
                { label: "Rarest Badge", value: topBadge ? `${topBadge.emoji} ${topBadge.tier}` : "—" },
              ].map((s) => (
                <div key={s.label} className="bg-black/60 p-2 text-center">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-purple-300/60">{s.label}</p>
                  <p className="text-[10px] font-bold text-purple-100/80 mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
