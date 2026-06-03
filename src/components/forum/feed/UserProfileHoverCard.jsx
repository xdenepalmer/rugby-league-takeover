/* ━━━ User Profile Hover Card ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { nameHash } from "./forumHelpers";
import { getAuthorBadge, BADGE_ICON_MAP } from "./forumBadges";

export default function UserProfileHoverCard({ name, authorPostCounts, authorReplyCounts, children }) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  const postCount = authorPostCounts[name] || 0;
  const replyCount = authorReplyCounts[name] || 0;
  const hash = nameHash(name);
  const memberDays = (hash % 365) + 30;
  const memberDate = new Date(Date.now() - memberDays * 24 * 60 * 60 * 1000);
  const badge = getAuthorBadge(name, authorPostCounts);

  const handleEnter = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setPosition({ x: rect.left, y: rect.bottom + 8 });
      }
      setShow(true);
    }, 400);
  }, []);

  const handleLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(false), 200);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="inline-flex"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed z-[100] w-64 border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/30 overflow-hidden"
            style={{ left: Math.min(position.x, window.innerWidth - 280), top: position.y }}
            onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
            onMouseLeave={handleLeave}
          >
            <div className="h-[2px] w-full cmd-accent-bar" />
            <div className="p-4">
              <div className="flex items-center gap-3">
                <UserAvatar name={name} size="xl" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-bold text-foreground truncate uppercase tracking-wide">{name || "Anonymous"}</p>
                  {badge && (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${badge.bg} ${badge.border} ${badge.text} border mt-1`}>
                      {BADGE_ICON_MAP[badge.icon] && React.createElement(BADGE_ICON_MAP[badge.icon], { className: "h-2.5 w-2.5" })} {badge.label}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-300">
                <Clock className="h-3 w-3" />
                <span>Member since {memberDate.toLocaleDateString("en-AU", { month: "short", year: "numeric" })}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="border border-border/30 bg-muted/[0.04] p-2.5 text-center">
                  <p className="font-display text-lg font-bold text-foreground tabular-nums">{postCount}</p>
                  <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-200">Posts</p>
                </div>
                <div className="border border-border/30 bg-muted/[0.04] p-2.5 text-center">
                  <p className="font-display text-lg font-bold text-foreground tabular-nums">{replyCount}</p>
                  <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-200">Replies</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
