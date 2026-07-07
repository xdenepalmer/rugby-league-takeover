import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

/* ─── Lucky Meter (pity system display) ─── */
export default function LuckyMeter({ spinsSinceWin }) {
  if (spinsSinceWin < 3) return null;
  const fill = Math.min(spinsSinceWin / 12, 1); // fills up over ~12 spins
  const label = fill >= 0.8 ? "Almost there!" : fill >= 0.5 ? "Getting lucky..." : "Building luck...";

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="mt-2 border border-amber-400/15 bg-amber-950/10 p-2"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[8px] font-mono uppercase tracking-wider text-amber-300/60 flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5" /> Lucky Meter
        </span>
        <span className="text-[9px] font-bold text-amber-200/70">{label}</span>
      </div>
      <div className="h-2 w-full overflow-hidden bg-black/60 border border-amber-500/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fill * 100}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-200"
          style={{ boxShadow: fill > 0.6 ? "0 0 12px rgba(251,191,36,0.5)" : "none" }}
        />
      </div>
      <p className="mt-1 text-[9px] text-amber-300/60">{spinsSinceWin} spins since last badge win</p>
    </motion.div>
  );
}
