import React from "react";
import { motion } from "framer-motion";
import { REEL_WINDOW_H } from "./slotConstants";

/* ─── Side Lever ─── */
export default function Lever({ canSpin, leverDown, onPull }) {
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
