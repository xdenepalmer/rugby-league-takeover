/* ━━━ AdminPullToRefresh ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Native-feel pull-to-refresh for the admin PWA (touch only).
 * Pulling down from the top of the page invalidates all cached
 * queries so every panel reloads fresh data.
 */
import React, { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { queryClientInstance } from "@/lib/query-client";

export default function AdminPullToRefresh({ children }) {
  const startY = useRef(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (e) => {
    if (window.scrollY > 4 || refreshing) return;
    startY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e) => {
    if (startY.current == null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0 && window.scrollY <= 4) {
      setPull(Math.min(delta * 0.4, 80));
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
    await queryClientInstance.invalidateQueries();
    await new Promise((r) => setTimeout(r, 450));
    setRefreshing(false);
    setPull(0);
  };

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
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
          <span className="text-[9px] font-bold uppercase tracking-[0.25em]">
            {refreshing ? "Refreshing…" : pull > 56 ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}