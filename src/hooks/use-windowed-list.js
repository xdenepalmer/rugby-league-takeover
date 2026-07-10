/**
 * Progressive list rendering for long feeds: render the first window, grow
 * as a sentinel element approaches the viewport. Avoids mounting hundreds
 * of rows (forum threads, admin lists can be 100–200 items) without a
 * virtualization dependency; window growth is monotonic so scroll
 * restoration keeps working.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function nextWindowLimit(current, step, total) {
  if (!Number.isFinite(current) || !Number.isFinite(step) || !Number.isFinite(total)) return 0;
  return Math.min(Math.max(current, 0) + Math.max(step, 1), Math.max(total, 0));
}

export function useWindowedList(items, { initial = 20, step = 20 } = {}) {
  const total = items.length;
  const [limit, setLimit] = useState(Math.min(initial, total));
  const observerRef = useRef(null);

  // A shrunk source list (filter change) clamps the window back down.
  useEffect(() => {
    setLimit((current) => Math.min(Math.max(current, Math.min(initial, total)), total));
  }, [total, initial]);

  const sentinelRef = useCallback(
    (node) => {
      observerRef.current?.disconnect();
      if (!node || typeof IntersectionObserver === "undefined") return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setLimit((current) => nextWindowLimit(current, step, total));
          }
        },
        { rootMargin: "600px 0px" }
      );
      observerRef.current.observe(node);
    },
    [step, total]
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { visible: items.slice(0, limit), sentinelRef, done: limit >= total };
}
