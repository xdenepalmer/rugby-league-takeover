import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { SLOT_BADGES } from "@/lib/slot-badges";

/* ─── First-Time Empty State ─── */
export default function EmptyStateGuide() {
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
