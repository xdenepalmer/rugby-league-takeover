import React from "react";
import { motion, useScroll, useSpring } from "framer-motion";

/**
 * Desktop-only neon scroll progress bar pinned to the very top of the viewport.
 * Uses motion values (no React re-renders) + a spring for a fluid native feel,
 * and animates only `transform` so it's fully GPU-composited.
 */
export default function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 180, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX, transformOrigin: "0% 50%" }}
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] hidden h-[3px] bg-gradient-to-r from-primary via-accent to-primary shadow-[0_0_12px_rgba(249,115,22,0.6)] lg:block"
    />
  );
}