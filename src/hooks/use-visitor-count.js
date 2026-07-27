import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";

const DEDUP_KEY = "rlt_visit_counted_on";

// UTC calendar day, so a device is counted at most once per day.
const todayKey = () => {
  try {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  } catch {
    return "";
  }
};

/**
 * Site-wide visitor count. Reads the running total from Supabase and bumps it at
 * most once per device per calendar day (localStorage dedup), so the number
 * approximates unique daily visitors rather than raw page hits.
 *
 * Returns null until a real count is known — and stays null if the backend is
 * unreachable or the 0010_site_visit_counter migration hasn't been applied yet —
 * so the footer can hide the counter gracefully instead of showing a zero it
 * can't stand behind.
 */
export function useVisitorCount() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const readTotal = async () => {
      const { data, error } = await supabase
        .from("site_visit_stats")
        .select("total_visits")
        .eq("id", 1)
        .maybeSingle();
      if (error || !data) return null;
      return Number(data.total_visits);
    };

    const run = async () => {
      let countedToday = false;
      try {
        countedToday = localStorage.getItem(DEDUP_KEY) === todayKey();
      } catch {
        /* private mode / storage blocked — treat as not counted */
      }

      try {
        if (countedToday) {
          const total = await readTotal();
          if (!cancelled && total !== null) setCount(total);
          return;
        }

        const { data, error } = await supabase.rpc("increment_site_visits");
        if (!cancelled && !error && data != null) {
          setCount(Number(data));
          try {
            localStorage.setItem(DEDUP_KEY, todayKey());
          } catch {
            /* best-effort — a missed dedup just double-counts one device once */
          }
        } else if (!cancelled) {
          // Increment unavailable (offline / not yet migrated) — try a read.
          const total = await readTotal();
          if (total !== null) setCount(total);
        }
      } catch {
        /* leave count null → the counter UI stays hidden */
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}
