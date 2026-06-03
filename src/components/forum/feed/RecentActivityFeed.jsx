/* ━━━ Recent Activity Mini-Feed ━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import React, { useMemo } from "react";
import { Activity } from "lucide-react";
import { parseForumDate, timeAgo } from "./forumHelpers";

export default function RecentActivityFeed({ allThreads }) {
  const activities = useMemo(() => {
    const items = [];
    allThreads.forEach(t => {
      items.push({ type: "post", name: t.author_name, title: t.title, date: t.created_date, id: t.id });
      (t.replies || []).forEach(r => {
        items.push({ type: "reply", name: r.author_name, title: t.title, date: r.created_date, id: r.id });
      });
    });
    items.sort((a, b) => {
      const da = parseForumDate(a.date);
      const db = parseForumDate(b.date);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    });
    return items.slice(0, 3);
  }, [allThreads]);

  if (activities.length === 0) return null;

  return (
    <div className="border border-border/50 bg-card/20 p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300">Recent Activity</p>
      </div>
      <div className="space-y-2.5">
        {activities.map((a, i) => (
          <div key={`${a.id}-${i}`} className="flex items-start gap-2">
            <div className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${a.type === "post" ? "bg-primary" : "bg-accent"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                <span className="font-bold text-foreground">{a.name || "Someone"}</span>
                {" "}{a.type === "post" ? "posted" : "replied to"}{" "}
                <span className="text-primary font-bold">"{(a.title || "a thread").slice(0, 32)}{(a.title || "").length > 32 ? "…" : ""}"</span>
              </p>
              <p className="text-[9px] font-mono text-slate-300 font-bold tabular-nums mt-0.5">{timeAgo(a.date)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
