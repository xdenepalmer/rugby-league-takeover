import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Award, Target } from "lucide-react";
import { checkTipResult, shortRoundLabel } from "./tipHelpers";

// ── Round recap ─────────────────────────────────────────────────────
// When every game in the round has a result and the fan had tips on, show
// their round score — the "how did I go?" moment every tipping app leads with.
export default function RoundRecap({ round, tips }) {
  const recap = useMemo(() => {
    if (!round || round.state !== "done") return null;
    let tipped = 0, correct = 0, points = 0, perfect = 0;
    round.games.forEach((g) => {
      const result = checkTipResult(g, tips?.[g.id]);
      if (!result) return;
      tipped += 1;
      if (result.correct) correct += 1;
      if (result.perfectMargin && result.correct) perfect += 1;
      points += result.points;
    });
    if (tipped === 0) return null;
    return { tipped, correct, points, perfect, total: round.games.length };
  }, [round, tips]);

  if (!recap) return null;

  const cleanSweep = recap.correct === recap.total && recap.total > 1;
  const headline = cleanSweep
    ? "Perfect round — every tip landed!"
    : recap.correct > recap.tipped / 2
      ? "Strong round, tipster."
      : recap.correct === 0
        ? "Rough round — they can't all land."
        : "Round wrapped.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border p-3 ${
        cleanSweep
          ? "border-amber-400/40 bg-gradient-to-b from-amber-500/10 to-black/30"
          : "border-border/30 bg-black/30"
      }`}
    >
      <div className="flex items-center gap-2">
        {cleanSweep ? <Award className="h-4 w-4 text-amber-400" /> : <Target className="h-4 w-4 text-primary" />}
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-300">
          {shortRoundLabel(round.label)} recap
        </p>
      </div>
      <p className={`mt-2 text-xs font-bold ${cleanSweep ? "text-amber-200" : "text-foreground"}`}>{headline}</p>
      <div className="mt-2 grid grid-cols-3 gap-px border border-border/30 bg-border/20 text-center">
        {[
          { label: "Correct", value: `${recap.correct}/${recap.tipped}` },
          { label: "Points", value: `+${recap.points}` },
          { label: "Exact margins", value: recap.perfect },
        ].map((stat) => (
          <div key={stat.label} className="bg-black/40 p-2">
            <p className="text-sm font-bold tabular-nums text-foreground">{stat.value}</p>
            <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
