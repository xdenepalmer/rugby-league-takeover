/* ━━━ Author Badge Logic ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import { Trophy, Star, Flame, Hand } from "lucide-react";

export const BADGE_LEVELS = [
  { min: 10, icon: "Trophy", label: "Legend",  bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-400" },
  { min: 5,  icon: "Star",   label: "Regular", bg: "bg-slate-400/15", border: "border-slate-400/30", text: "text-slate-300" },
  { min: 3,  icon: "Flame",  label: "Active",  bg: "bg-orange-500/15", border: "border-orange-500/30", text: "text-orange-400" },
  { min: 1,  icon: "Hand",   label: "New",     bg: "bg-blue-500/15", border: "border-blue-500/30", text: "text-blue-400" },
];

export function getAuthorBadge(name, authorPostCounts) {
  const count = authorPostCounts[name] || 0;
  for (const badge of BADGE_LEVELS) {
    if (count >= badge.min) return badge;
  }
  return null;
}

/* Badge icon map — replaces emojis with Lucide SVGs */
export const BADGE_ICON_MAP = { Trophy, Star, Flame, Hand };
