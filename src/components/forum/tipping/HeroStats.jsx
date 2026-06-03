import { useMemo } from "react";
import { TIP_STREAK_KEY, PTS_CORRECT } from "./constants";
import { readJson } from "./storage";
import { checkTipResult } from "./tipHelpers";
import { useAnimatedCounter } from "./hooks";

export default function HeroStats({ tips, fixtures, totalPoints }) {
  const tipped = fixtures.filter((g) => tips[g.id]).length;
  const total = fixtures.length || 1;

  const { correct, checked } = useMemo(() => {
    let correct = 0, checked = 0;
    fixtures.forEach((g) => {
      const result = checkTipResult(g, tips[g.id]);
      if (result) { checked++; if (result.correct) correct++; }
    });
    return { correct, checked };
  }, [fixtures, tips]);

  const accuracy = checked > 0 ? Math.round((correct / checked) * 100) : null;
  const rank = totalPoints >= 30 ? "🏆 Immortal" : totalPoints >= 15 ? "🎯 Sharpshooter" : totalPoints >= 5 ? "📊 Analyst" : tipped > 0 ? "🆕 Rookie" : "👀 Scout";
  const tipStreak = readJson(TIP_STREAK_KEY, 0);

  // Animated counters
  const animPts = useAnimatedCounter(totalPoints);
  const animAcc = useAnimatedCounter(accuracy || 0);

  return (
    <div className="grid grid-cols-4 gap-px overflow-hidden border border-border/40 bg-border/20">
      {[
        { label: "Rank", value: rank, sub: `${animPts} pts` },
        { label: "Accuracy", value: accuracy != null ? `${animAcc}%` : "—", sub: `${correct}/${checked}` },
        { label: "Tipped", value: `${tipped}`, sub: `of ${total}` },
        { label: "Streak", value: tipStreak > 0 ? `🔥 ${tipStreak}` : "—", sub: tipStreak > 2 ? "On fire!" : `${PTS_CORRECT}pt/win` },
      ].map((stat) => (
        <div key={stat.label} className="bg-black/40 p-2 text-center">
          <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
          <p className="mt-0.5 truncate text-[11px] font-bold text-foreground">{stat.value}</p>
          <p className="text-[7px] text-slate-500">{stat.sub}</p>
        </div>
      ))}
    </div>
  );
}
