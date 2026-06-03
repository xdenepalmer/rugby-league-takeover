/* ━━━ Author Meta (opt-in location / team shown next to name) ━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import React from "react";
import { Dice5, MapPin } from "lucide-react";
import TeamCrest from "@/components/public/TeamCrest";

export default function AuthorMeta({ meta, className = "" }) {
  if (!meta || (!meta.location && !meta.team && !meta.badge && !meta.casino_xp)) return null;
  return (
    <>
      {meta.badge && <span className={`inline-flex items-center gap-1 border border-pink-500/30 bg-pink-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pink-300 ${className}`} title={`Slot badge: ${meta.badge.label}`}>{meta.badge.emoji} {meta.badge.label}</span>}
      {meta.casino_xp > 0 && <span className={`inline-flex items-center gap-1 border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200 ${className}`} title={`${meta.casino_xp} XP · ${meta.casino_chips} chips · ${meta.casino_streak || 0} day streak`}><Dice5 className="h-2.5 w-2.5" /> {meta.casino_rank}</span>}
      {meta.location && <span className={`inline-flex items-center gap-1 text-[10px] text-slate-300 font-semibold ${className}`} title={meta.location}><MapPin className="h-2.5 w-2.5" /> {meta.location}</span>}
      {meta.team && <span className={`inline-flex items-center gap-1 text-[10px] text-slate-300 font-semibold ${className}`} title={`Supports ${meta.team}`}><TeamCrest name={meta.team} logo={meta.teamLogo} className="h-4 w-4 text-[7px]" /> {meta.team}</span>}
    </>
  );
}
