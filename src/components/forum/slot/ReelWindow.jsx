import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { REEL_CELL, REEL_WINDOW_H, REEL_DURATIONS } from "./slotConstants";

/* ─── Reel with 3 visible rows + bounce-back on stop ─── */
export default function ReelWindow({ track, index, spinning, stopped, highlight, nearMissPulse }) {
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
          animate={{ y: spinning ? [0, targetY - 14, targetY] : 0 }}
          transition={
            spinning
              ? {
                  // Mechanical overshoot: run 14px past the payline, then snap
                  // back — reads as the reel physically catching its stop.
                  duration: REEL_DURATIONS[index],
                  times: [0, 0.94, 1],
                  ease: [[0.08, 0.82, 0.17, 1], "easeOut"],
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
                className="select-none text-[2.35rem] leading-none drop-shadow-[0_4px_14px_rgba(0,0,0,0.9)] sm:text-[2.8rem]"
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