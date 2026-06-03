/* ━━━ User Achievements Badge Component ━━━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import React, { useState, useEffect } from "react";

export default function UserAchievements({ isMe }) {
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    const handleBadgeEvent = () => {
      setTrigger((t) => t + 1);
    };
    window.addEventListener("rlt_badge_event", handleBadgeEvent);
    return () => window.removeEventListener("rlt_badge_event", handleBadgeEvent);
  }, []);

  if (!isMe) return null;

  let voted = false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("rlt_match_voted_")) {
        voted = true;
        break;
      }
    }
  } catch (err) {}

  const claimed = !!localStorage.getItem("rlt_seat_claimed");
  const posted = !!localStorage.getItem("rlt_forum_posted");
  const slotSpins = !!localStorage.getItem("rlt_slot_spins");
  const slotJackpot = !!localStorage.getItem("rlt_slot_jackpot");

  if (!voted && !claimed && !posted && !slotSpins && !slotJackpot) return null;

  return (
    <div className="inline-flex items-center gap-1 ml-1" title="Vegas Supporter Achievements">
      {voted && (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[8px]" title="Expert Tipster (Unlocked)">
          🏆
        </span>
      )}
      {claimed && (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[8px]" title="Stadium Resident (Unlocked)">
          📍
        </span>
      )}
      {posted && (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center bg-pink-500/10 border border-pink-500/30 text-pink-400 text-[8px]" title="Hype Master (Unlocked)">
          ⚡
        </span>
      )}
      {slotSpins && (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[8px]" title="Vegas High Roller (Unlocked)">
          🎰
        </span>
      )}
      {slotJackpot && (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center bg-red-500/10 border border-red-500/30 text-red-400 text-[8px] animate-bounce" style={{ animationDuration: "1s" }} title="Vegas Jackpot Winner (Unlocked)">
          🔥
        </span>
      )}
    </div>
  );
}
