import React from "react";
import { useAnimatedCounter } from "./hooks";

const RANKS = [
  { at: 0, label: "👀 Scout" },
  { at: 1, label: "🆕 Rookie" },
  { at: 5, label: "📊 Analyst" },
  { at: 15, label: "🎯 Sharpshooter" },
  { at: 30, label: "🏆 Immortal" },
];

export function rankFor(points, tipped) {
  const score = points > 0 ? points : tipped > 0 ? 1 : 0;
  let current = RANKS[0];
  let next = null;
  for (const rank of RANKS) {
    if (score >= rank.at) current = rank;
    else { next = rank; break; }
  }
  return { current, next, score };
}

// Season stat strip: real points, real accuracy, a real streak (computed from
// settled results — the old streak read a key nothing ever wrote), and rank
// with progress toward the next title.
export default function HeroStats({ totalPoints, correct, checked, streak, tipped, total }) {
  const accuracy = checked > 0 ? Math.round((correct / checked) * 100) : null;
  const { current, next, score } = rankFor(totalPoints, tipped);
  const progress = next ? Math.min(100, Math.round((score / next.at) * 100)) : 100;

  const animPts = useAnimatedCounter(totalPoints);
  const animAcc = useAnimatedCounter(accuracy || 0);

  return (
    <div>
      <div className="grid grid-cols-4 gap-px overflow-hidden border border-border/40 bg-border/20">
        {[
          { label: "Points", value: `${animPts}`, sub: current.label },
          { label: "Accuracy", value: accuracy != null ? `${animAcc}%` : "—", sub: checked > 0 ? `${correct}/${checked}` : "no results yet" },
          { label: "Streak", value: streak?.current > 0 ? `🔥 ${streak.current}` : "—", sub: streak?.best > 0 ? `best ${streak.best}` : "in a row" },
          { label: "Tipped", value: `${tipped}`, sub: `of ${total}` },
        ].map((stat) => (
          <div key={stat.label} className="bg-black/40 p-2 text-center">
            <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-foreground">{stat.value}</p>
            <p className="truncate text-[7px] text-slate-500">{stat.sub}</p>
          </div>
        ))}
      </div>
      {next && (
        <div className="mt-1 flex items-center gap-1.5">
          <div className="h-1 flex-1 overflow-hidden border border-border/10 bg-black/40">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="shrink-0 text-[8px] text-slate-500">
            {next.at - score} pts to {next.label}
          </span>
        </div>
      )}
    </div>
  );
}
