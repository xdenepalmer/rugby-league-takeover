import React from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { SPIN_COOLDOWN_MS } from "@/lib/slot-badges";
import { fmtCountdown } from "./slotHelpers";

/* ─── Circular Progress Ring ─── */
export function ProgressRing({ progress, size = 72, strokeWidth = 3 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - progress * circumference;

  return (
    <svg width={size} height={size} className="absolute -inset-1.5 z-0 rotate-[-90deg]" role="img" aria-label={`Collection progress: ${Math.round(progress * 100)}%`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(168,85,247,0.15)" strokeWidth={strokeWidth} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#progressGrad)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      <defs>
        <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ─── Cooldown Timer Ring ─── */
export function CooldownRing({ cooldownLeft, size = 52, strokeWidth = 3 }) {
  const progress = Math.max(0, Math.min(1, cooldownLeft / SPIN_COOLDOWN_MS));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - progress * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="timer" aria-label={`Cooldown: ${fmtCountdown(cooldownLeft)}`}>
      <svg width={size} height={size} className="absolute rotate-[-90deg]">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(100,100,120,0.2)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(168,85,247,0.6)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <Lock className="h-4 w-4 text-purple-400/70" />
    </div>
  );
}
