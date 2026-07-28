import { useEffect, useRef, useState } from "react";

/* Counts up to `target` with an easeOutCubic ramp on requestAnimationFrame.
 * - round: false keeps fractional values (currency counters).
 * - fromPrevious animates from the last target instead of restarting at 0,
 *   which suits live totals that tick upward. */
export function useAnimatedCount(target, { duration = 800, round = true, fromPrevious = false } = {}) {
  const [value, setValue] = useState(0);
  const previousRef = useRef(0);

  useEffect(() => {
    const start = fromPrevious ? previousRef.current : 0;
    previousRef.current = target;

    if (target === start) {
      setValue(target);
      return undefined;
    }

    const startTime = performance.now();
    let frame = 0;
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = start + (target - start) * eased;
      setValue(round ? Math.round(next) : next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target, duration, round, fromPrevious]);

  return value;
}

export default useAnimatedCount;
