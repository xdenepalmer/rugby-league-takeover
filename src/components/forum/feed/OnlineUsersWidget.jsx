/* ━━━ Online Users Widget ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import React, { useMemo, memo } from "react";
import { motion } from "framer-motion";
import UserAvatar from "./UserAvatar";

const OnlineUsersWidget = memo(function OnlineUsersWidget({ threads }) {
  const uniqueUsers = useMemo(() => {
    const names = new Set();
    threads.forEach((t) => {
      if (t.author_name) names.add(t.author_name);
      (t.replies || []).forEach((r) => { if (r.author_name) names.add(r.author_name); });
    });
    return [...names].slice(0, 8);
  }, [threads]);

  const onlineCount = Math.min(Math.ceil(uniqueUsers.length * 0.6), uniqueUsers.length);

  return (
    <div className="border border-border/50 bg-card/20 p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-2 w-2 rounded-full bg-emerald-400 cmd-pulse" />
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          {onlineCount} fans online
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {uniqueUsers.map((name, i) => (
          <motion.div
            key={name}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            title={name}
          >
            <UserAvatar name={name} size="sm" showStatus={i < onlineCount} />
          </motion.div>
        ))}
      </div>
    </div>
  );
});

export default OnlineUsersWidget;
