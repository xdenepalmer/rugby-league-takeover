/* ━━━ User Avatar (Enhanced) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import React, { memo } from "react";

const UserAvatar = memo(function UserAvatar({ name, size = "md", showStatus = false, src = "" }) {
  const initial = (name || "?")[0].toUpperCase();
  const second = (name || "??").length > 1 ? name.split(/\s+/)?.[1]?.[0]?.toUpperCase() || "" : "";
  const seed = [...(name || "")].reduce((t, c) => t + c.charCodeAt(0), 0);
  const hues = [15, 45, 160, 220, 280, 330, 190, 30, 120, 350];
  const hue = hues[seed % hues.length];
  const sizes = { sm: "h-7 w-7 text-[9px]", md: "h-9 w-9 text-xs", lg: "h-11 w-11 text-sm", xl: "h-14 w-14 text-lg" };

  return (
    <div className="relative shrink-0">
      {src ? (
        <img
          src={src}
          alt={name || "Member"}
          className={`${sizes[size]} rounded-full object-cover`}
          style={{ border: `1.5px solid hsl(${hue}, 70%, 55%, 0.4)`, boxShadow: `0 0 12px hsl(${hue}, 70%, 50%, 0.15)` }}
        />
      ) : (
        <div
          className={`${sizes[size]} flex items-center justify-center font-bold uppercase tracking-wider rounded-full`}
          style={{
            background: `linear-gradient(135deg, hsl(${hue}, 75%, 45%) 0%, hsl(${(hue + 30) % 360}, 65%, 35%) 100%)`,
            border: `1.5px solid hsl(${hue}, 70%, 55%, 0.4)`,
            boxShadow: `0 0 12px hsl(${hue}, 70%, 50%, 0.15)`,
          }}
        >
          {initial}{second}
        </div>
      )}
      {showStatus && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-background cmd-pulse" />
      )}
    </div>
  );
});

export default UserAvatar;
