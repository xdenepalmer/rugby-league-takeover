import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

/* ─── Dry-spell tracker ───
   Honest version of the old "Lucky Meter": the server rolls three independent
   reels with NO pity mechanism, so a bar that filled up and announced "Almost
   there!" promised rising odds that flatly don't exist. Keep the fun of a
   tracker, drop the false promise: this shows the actual dry spell and says
   outright that every spin is an independent roll. */
export default function LuckyMeter({ spinsSinceWin }) {
  if (spinsSinceWin < 3) return null;
  const fill = Math.min(spinsSinceWin / 12, 1);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="mt-2 border border-amber-400/15 bg-amber-950/10 p-2"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[8px] font-mono uppercase tracking-wider text-amber-300/60 flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5" /> Dry spell
        </span>
        <span className="text-[9px] font-bold text-amber-200/70">
          {spinsSinceWin} spin{spinsSinceWin === 1 ? "" : "s"} without a badge
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden bg-black/60 border border-amber-500/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fill * 100}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-200"
        />
      </div>
      <p className="mt-1 text-[9px] text-amber-300/60">
        Every spin is an independent roll — rarer symbols simply land less often. Good luck!
      </p>
    </motion.div>
  );
}
