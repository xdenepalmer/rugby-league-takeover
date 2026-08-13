import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { getVisitorKey, isUncountedPath } from "@/lib/visitor-key";

/**
 * Records a page view on every navigation.
 *
 * Recording is write-only by design: record_site_visit() returns nothing, so the
 * path anonymous visitors can call never hands the counts back. The totals are a
 * private business metric and are readable only by an admin (see useVisitorStats).
 *
 * The server does the unique dedup against the visitor key, so this hook does not
 * try to be clever about what counts — the browser is not a trustworthy place to
 * decide whether someone is new.
 */
export function useRecordVisit() {
  const { pathname } = useLocation();
  const lastRecorded = useRef(null);

  useEffect(() => {
    if (isUncountedPath(pathname)) return;
    // React 18 StrictMode double-invokes effects in development, and a
    // replaced-in-place route can re-fire with an identical path. Neither is a
    // second view.
    if (lastRecorded.current === pathname) return;
    lastRecorded.current = pathname;

    const visitorKey = getVisitorKey();
    if (!visitorKey) return; // storage blocked — see getVisitorKey

    supabase.rpc("record_site_visit", { p_visitor_key: visitorKey }).then(
      () => {},
      () => {
        /* a missed view is not worth surfacing to anyone */
      },
    );
  }, [pathname]);
}

/**
 * Admin-only read of the two site counters.
 *
 *   totalViews     — every page view, all time.
 *   uniqueVisitors — distinct devices, deduped server-side.
 *   uniqueSince    — when unique tracking began. The site ran a single combined
 *                    counter before that, which cannot be split retrospectively,
 *                    so the UI dates the figure instead of implying it is
 *                    all-time.
 *
 * Returns null until real numbers are known (and stays null if the backend is
 * unreachable or the migration has not been applied), so the UI can hide rather
 * than show a zero it cannot stand behind.
 */
export function useVisitorStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("site_visit_stats")
      .select("total_views, unique_visitors, unique_tracking_started_at")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setStats({
          totalViews: Number(data.total_views),
          uniqueVisitors: Number(data.unique_visitors),
          uniqueSince: data.unique_tracking_started_at || null,
        });
      }, () => {
        /* leave null → the tiles stay hidden */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return stats;
}
