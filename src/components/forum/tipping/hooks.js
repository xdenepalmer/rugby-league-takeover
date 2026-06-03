import { useEffect, useState, useRef } from "react";

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
export function useAnimatedCounter(target, duration = 800) {
  const [value, setValue] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    if (target === prevRef.current) return;
    const start = prevRef.current;
    const diff = target - start;
    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setValue(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    prevRef.current = target;
  }, [target, duration]);
  return value;
}
