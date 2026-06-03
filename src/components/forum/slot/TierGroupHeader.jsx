import React from "react";
import { TIER_STYLES } from "./slotConstants";

/* ─── Tier Group Header ─── */
export default function TierGroupHeader({ tierName, ownedCount, totalCount }) {
  const tierStyle = TIER_STYLES[tierName] || TIER_STYLES.Common;
  const pct = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0;

  return (
    <div className="col-span-full flex items-center gap-2 mt-2 first:mt-0">
      <div className={`h-px flex-1 ${tierStyle.border.replace("border-", "bg-").replace("/30", "/20").replace("/40", "/25").replace("/45", "/30")}`} />
      <span className={`text-[8px] font-mono font-bold uppercase tracking-[0.15em] ${tierStyle.text}`}>
        {tierName}
        <span className="ml-1.5 text-[7px] opacity-60">
          {ownedCount}/{totalCount} · {pct}%
        </span>
      </span>
      <div className={`h-px flex-1 ${tierStyle.border.replace("border-", "bg-").replace("/30", "/20").replace("/40", "/25").replace("/45", "/30")}`} />
    </div>
  );
}
