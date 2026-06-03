/* ━━━ Live Activity Ticker ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, X } from "lucide-react";
import { getCategoryMeta, timeAgo } from "./forumHelpers";

export default function LiveActivityTicker({ threads }) {
  const [dismissed, setDismissed] = useState(false);

  const activities = useMemo(() => {
    const items = [];
    threads.slice(0, 15).forEach((t) => {
      const catMeta = getCategoryMeta(t.category);
      items.push({
        id: `post-${t.id}`,
        text: `🏉 ${t.author_name || "Someone"} posted in ${catMeta.label}`,
        time: timeAgo(t.created_date),
      });
      (t.replies || []).slice(0, 2).forEach((r) => {
        items.push({
          id: `reply-${r.id}`,
          text: `💬 ${r.author_name || "Someone"} replied to ${(t.title || "a thread").slice(0, 30)}${(t.title || "").length > 30 ? "…" : ""}`,
          time: timeAgo(r.created_date),
        });
      });
    });
    return items.slice(0, 20);
  }, [threads]);

  if (dismissed || activities.length === 0) return null;

  const tickerContent = activities.map(a => a.text).join("    •    ");
  const doubled = `${tickerContent}    •    ${tickerContent}`;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="relative border border-border/30 bg-card/20 overflow-hidden mb-4"
    >
      <div className="flex items-center w-full min-w-0">
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-r border-border/30 bg-primary/5">
          <Activity className="h-3 w-3 text-primary cmd-pulse" />
          <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-primary">Live</span>
        </div>
        <div className="min-w-0 flex-1 overflow-hidden py-2">
          <motion.div
            className="whitespace-nowrap text-[10px] text-slate-300 font-mono font-bold"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: activities.length * 4, repeat: Infinity, ease: "linear" }}
          >
            {doubled}
          </motion.div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 p-2 text-slate-400 hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </motion.div>
  );
}
