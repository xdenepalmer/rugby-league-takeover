import { useEffect, useState, useRef } from "react";

const HOUR_MS = 3600000;
const DAY_MS = 86400000;

// ── Countdown Hook ──────────────────────────────────────────────────
// Ticks only inside the last 24 hours before kickoff, and re-arms itself when
// a card mounted further out crosses into that window (the old version
// decided once, at mount, so a card opened >24h early never counted down —
// and one opened inside the window kept a 1 Hz interval running forever after
// kickoff passed).
export function useCountdown(kickoff) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!kickoff) return undefined;
    const target = new Date(kickoff).getTime();
    if (!Number.isFinite(target)) return undefined;

    let tick;
    let arm;
    const start = () => {
      clearInterval(tick);
      tick = setInterval(() => {
        const remaining = target - Date.now();
        setNow(Date.now());
        if (remaining <= 0) clearInterval(tick); // stop at zero, don't run all night
      }, 1000);
    };

    const remaining = target - Date.now();
    if (remaining <= 0) return undefined;
    if (remaining <= DAY_MS) start();
    // Further out: wake up once when the window opens instead of ticking now.
    else arm = setTimeout(start, remaining - DAY_MS);

    return () => { clearInterval(tick); clearTimeout(arm); };
  }, [kickoff]);

  if (!kickoff) return null;
  const target = new Date(kickoff).getTime();
  if (!Number.isFinite(target)) return null;
  const diff = target - now;
  if (diff <= 0 || diff > DAY_MS) return null;
  const h = Math.floor(diff / HOUR_MS);
  const m = Math.floor((diff % HOUR_MS) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

// ── Coarse clock ────────────────────────────────────────────────────
// Round states (open / locked / live) and the "next lockout" deadline are
// derived from `now`. Without a tick they froze at first render, so a round
// stayed "open" and advertised a kickoff that had already passed until some
// unrelated refetch happened to re-render.
export function useSlowClock(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => { if (!document.hidden) setNow(Date.now()); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [intervalMs]);
  return now;
}

// ── Animated counter hook ───────────────────────────────────────────
export function useAnimatedCounter(target, duration = 800) {
  const [value, setValue] = useState(0);
  const prevRef = useRef(0);
  const frameRef = useRef(0);
  useEffect(() => {
    if (target === prevRef.current) return undefined;
    const start = prevRef.current;
    const diff = target - start;
    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setValue(Math.round(start + diff * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    prevRef.current = target;
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);
  return value;
}
