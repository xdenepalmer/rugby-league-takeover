import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy } from "lucide-react";
import { SLOT_BADGES } from "@/lib/slot-badges";
import { TIER_STYLES } from "./slotConstants";
import { getWinHistory } from "./slotStorage";

/* ─── Win History Log ─── */
export default function WinHistoryLog() {
  const [expanded, setExpanded] = useState(false);
  const history = useMemo(() => getWinHistory(), []);
  if (history.length === 0) return null;

  return (
    <div className="mt-3 border border-purple-500/10 bg-black/30">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between p-2 text-[8px] font-mono uppercase tracking-wider text-purple-200/50 hover:text-purple-200/70 transition-colors"
      >
        <span className="flex items-center gap-1">
          <Trophy className="h-3 w-3" /> Recent Wins ({history.length})
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
            <div className="space-y-1 px-2 pb-2">
              {history.map((entry, i) => {
                const badge = SLOT_BADGES.find((b) => b.id === entry.badge_id);
                if (!badge) return null;
                const tier = TIER_STYLES[badge.tier] || TIER_STYLES.Common;
                const ago = Date.now() - entry.timestamp;
                const agoText = ago < 3600000 ? "< 1h ago"
                  : ago < 86400000 ? `${Math.floor(ago / 3600000)}h ago`
                  : `${Math.floor(ago / 86400000)}d ago`;
                return (
                  <div key={`${entry.badge_id}-${i}`} className={`flex items-center gap-2 p-1.5 border ${tier.border} ${tier.bg}`}>
                    <span className="text-lg">{badge.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[9px] font-bold truncate ${tier.text}`}>{badge.label}</p>
                      <p className="text-[7px] text-purple-300/40">{badge.tier}</p>
                    </div>
                    <span className="text-[7px] text-purple-300/40 shrink-0">{agoText}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
