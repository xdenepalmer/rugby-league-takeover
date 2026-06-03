/* ━━━ Top Contributors Leaderboard ━━━━━━━━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import React, { useMemo, memo } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import UserAvatar from "./UserAvatar";

const TopContributors = memo(function TopContributors({ allThreads }) {
  const topUsers = useMemo(() => {
    const totalCounts = {};
    allThreads.forEach(t => {
      const name = t.author_name;
      if (name) totalCounts[name] = (totalCounts[name] || 0) + 1;
      (t.replies || []).forEach(r => {
        if (r.author_name) totalCounts[r.author_name] = (totalCounts[r.author_name] || 0) + 1;
      });
    });
    return Object.entries(totalCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [allThreads]);

  if (topUsers.length === 0) return null;

  const rankIcons = ["🥇", "🥈", "🥉"];

  return (
    <div className="border border-border/50 bg-card/20 p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-3.5 w-3.5 text-amber-400" />
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Top Contributors</p>
      </div>
      <div className="space-y-2">
        {topUsers.map((u, i) => (
          <motion.div
            key={u.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-2.5 py-1"
          >
            <span className="w-5 text-center text-sm shrink-0">
              {i < 3 ? rankIcons[i] : <span className="text-[10px] font-mono font-bold text-slate-300">{i + 1}</span>}
            </span>
            <UserAvatar name={u.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground truncate">{u.name}</p>
              <p className="text-[8px] text-slate-300 font-medium">{u.count} contributions</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
});

export default TopContributors;
