import { useEffect, useState } from "react";
import { useAnimatedCount } from "@/hooks/use-animated-count";

// ── Countdown Hook ──────────────────────────────────────────────────
export function useCountdown(kickoff) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!kickoff) return;
    const diff = new Date(kickoff).getTime() - Date.now();
    if (diff <= 0 || diff > 86400000) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [kickoff]);
  if (!kickoff) return null;
  const diff = new Date(kickoff).getTime() - now;
  if (diff <= 0 || diff > 86400000) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

// ── Animated counter hook ───────────────────────────────────────────
// Tip totals tick upward, so the count resumes from the previous total.
export function useAnimatedCounter(target, duration = 800) {
  return useAnimatedCount(target, { duration, fromPrevious: true });
}
