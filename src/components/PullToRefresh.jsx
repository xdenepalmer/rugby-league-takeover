/* ━━━ PullToRefresh ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Native-feel pull-to-refresh for public feeds (touch only). Pull down from the
 * top to invalidate the given query keys (or all queries if none given), with
 * an iOS "tick" haptic at the release threshold and a success haptic on
 * completion. No-op affordance on desktop (hidden ≥ lg).
 */
import React, { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { queryClientInstance } from "@/lib/query-client";
import { lightImpact, successImpact } from "@/lib/native/haptics";

export default function PullToRefresh({ children, queryKeys = null, className = "" }) {
  const startY = useRef(null);
  const armed = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (e) => {
    if (window.scrollY > 4 || refreshing) return;
    startY.current = e.touches[0].clientY;
    armed.current = false;
  };

  const onTouchMove = (e) => {
    if (startY.current == null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0 && window.scrollY <= 4) {
      const next = Math.min(delta * 0.4, 80);
      // Fire the "tick" once, as the pull crosses the release threshold.
      if (next > 56 && !armed.current) {
        armed.current = true;
        lightImpact();
      } else if (next <= 56) {
        armed.current = false;
      }
      setPull(next);
    }
  };

  const onTouchEnd = async () => {
    const shouldRefresh = pull > 56;
    startY.current = null;
    if (!shouldRefresh) {
      setPull(0);
      return;
    }
    setRefreshing(true);
    setPull(48);
    if (Array.isArray(queryKeys) && queryKeys.length) {
      await Promise.all(
        queryKeys.map((key) => queryClientInstance.invalidateQueries({ queryKey: key }))
      );
    } else {
      await queryClientInstance.invalidateQueries();
    }
    await new Promise((r) => setTimeout(r, 450));
    successImpact();
    setRefreshing(false);
    setPull(0);
  };

  return (
    <div className={className} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        aria-hidden="true"
        className="flex items-end justify-center overflow-hidden lg:hidden"
        style={{ height: refreshing ? 48 : pull, transition: startY.current == null ? "height 0.25s ease" : "none" }}
      >
        <div className="mb-2.5 flex items-center gap-2 text-primary">
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
          />
          <span className="text-2xs font-bold uppercase tracking-[0.25em]">
            {refreshing ? "Refreshing…" : pull > 56 ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
