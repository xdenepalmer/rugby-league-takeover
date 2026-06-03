/* ━━━ Author Badge Component ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import React from "react";
import { getAuthorBadge, BADGE_ICON_MAP } from "./forumBadges";

export default function AuthorBadge({ name, authorPostCounts }) {
  const badge = getAuthorBadge(name, authorPostCounts);
  if (!badge) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${badge.bg} ${badge.border} ${badge.text} border`}>
      {BADGE_ICON_MAP[badge.icon] && React.createElement(BADGE_ICON_MAP[badge.icon], { className: "h-2.5 w-2.5" })} {badge.label}
    </span>
  );
}
