import React from "react";
import { motion } from "framer-motion";

// ── orchestration ────────────────────────────────────────────────
const VIEWPORT = { once: true, amount: 0.3 };

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15, delayChildren: 0.05 } },
};

const slideInLeft = {
  hidden: { opacity: 0, x: -40 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const lineGrow = {
  hidden: { scaleX: 0 },
  show: {
    scaleX: 1,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

const clipRevealUp = {
  hidden: { y: "110%" },
  show: {
    y: "0%",
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
  },
};

const fadeIn = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: "easeOut" },
  },
};

const numberReveal = {
  hidden: { opacity: 0, scale: 0.6 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

// ── component ────────────────────────────────────────────────────
export default function SectionHeader({ eyebrow, title, children, number }) {
  return (
    <motion.div
      className="mb-12 max-w-3xl"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
    >
      {/* ── eyebrow row ─────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-4">
        {/* animated line – grows from left */}
        <motion.span
          className="block h-px w-14 origin-left bg-primary"
          variants={lineGrow}
        />

        {/* eyebrow text – slides in */}
        <motion.p
          className="text-xs font-bold uppercase tracking-[0.34em] text-primary"
          variants={slideInLeft}
        >
          {eyebrow}
        </motion.p>

        {/* optional section number badge */}
        {number != null && (
          <motion.span
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-none border border-primary/25 font-display text-[11px] font-bold tabular-nums text-primary/60"
            variants={numberReveal}
          >
            {String(number).padStart(2, "0")}
          </motion.span>
        )}
      </div>

      {/* ── full-width divider line ─────────────────────────── */}
      <motion.div
        className="mb-6 h-px origin-left bg-gradient-to-r from-primary/50 via-primary/20 to-transparent"
        variants={lineGrow}
      />

      {/* ── title  (clip-reveal upward) ─────────────────────── */}
      <div className="overflow-hidden">
        <motion.h2
          className="font-display text-5xl uppercase leading-[0.88] tracking-tight text-foreground transition-colors duration-300 hover:bg-gradient-to-r hover:from-[#F97316] hover:to-[#D97706] hover:bg-clip-text hover:text-transparent md:text-7xl"
          variants={clipRevealUp}
        >
          {title}
        </motion.h2>
      </div>

      {/* ── description / children ──────────────────────────── */}
      {children && (
        <motion.p
          className="mt-6 text-lg leading-8 text-muted-foreground"
          variants={fadeIn}
        >
          {children}
        </motion.p>
      )}
    </motion.div>
  );
}