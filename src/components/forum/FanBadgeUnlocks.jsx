import React, { useState, useEffect } from "react";
import { Trophy, MapPin, Zap, CheckCircle2, Award } from "lucide-react";

export default function FanBadgeUnlocks() {
  const [achievements, setAchievements] = useState({
    voted: false,
    claimed: false,
    posted: false
  });

  const checkAchievements = () => {
    try {
      // 1. Check if voted or shared score prediction
      let voted = false;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("rlt_match_voted_")) {
          voted = true;
          break;
        }
      }

      // 2. Check if claimed seat
      const claimed = !!localStorage.getItem("rlt_seat_claimed");

      // 3. Check if posted in MatchDay category (or any local post submitted)
      const posted = !!localStorage.getItem("rlt_forum_posted");

      setAchievements({ voted, claimed, posted });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    checkAchievements();

    // Listen for custom events to trigger instant updates
    const handleBadgeEvent = () => {
      checkAchievements();
    };

    window.addEventListener("rlt_badge_event", handleBadgeEvent);
    return () => window.removeEventListener("rlt_badge_event", handleBadgeEvent);
  }, []);

  const badgeList = [
    {
      id: "voted",
      label: "Expert Tipster",
      description: "Submitted a score prediction",
      icon: Trophy,
      color: "text-amber-400 border-amber-500/30 bg-amber-500/5 shadow-amber-500/10",
      glowColor: "rgba(251, 191, 36, 0.4)",
      unlocked: achievements.voted
    },
    {
      id: "claimed",
      label: "Stadium Resident",
      description: "Claimed a seat in Allegiant Stadium",
      icon: MapPin,
      color: "text-purple-400 border-purple-500/30 bg-purple-500/5 shadow-purple-500/10",
      glowColor: "rgba(168, 85, 247, 0.4)",
      unlocked: achievements.claimed
    },
    {
      id: "posted",
      label: "Hype Master",
      description: "Submitted a MatchDay discussion post",
      icon: Zap,
      color: "text-pink-400 border-pink-500/30 bg-pink-500/5 shadow-pink-500/10",
      glowColor: "rgba(236, 72, 153, 0.4)",
      unlocked: achievements.posted
    }
  ];

  const unlockedCount = badgeList.filter(b => b.unlocked).length;

  return (
    <div className="border border-border/65 bg-card/30 cmd-glass overflow-hidden">
      <div className="h-[2px] w-full cmd-accent-bar" />
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 border border-primary/20">
              <Award className="h-3.5 w-3.5 text-primary animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Vegas Fan Badges</h3>
              <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/45">Interactive Achievements</p>
            </div>
          </div>
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-neutral-900 border border-border/40 text-primary">
            {unlockedCount}/3 Unlocked
          </span>
        </div>

        <p className="text-xs text-muted-foreground/60 leading-relaxed mb-4">
          Unlock exclusive supporter badges by interacting with game-day features. Unlocked badges will display on your profile and posts!
        </p>

        {/* Badges Grid */}
        <div className="space-y-2.5">
          {badgeList.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.id}
                className={`flex items-center gap-3 border p-2.5 transition-all duration-300 ${
                  badge.unlocked
                    ? `${badge.color} border-opacity-70 shadow-[0_0_15px_rgba(0,0,0,0.5)]`
                    : "border-border/30 bg-black/20 opacity-40 grayscale"
                }`}
              >
                <div
                  className={`p-2 rounded-sm border ${
                    badge.unlocked
                      ? "border-current"
                      : "border-border/20 text-muted-foreground"
                  }`}
                  style={{
                    boxShadow: badge.unlocked ? `0 0 10px ${badge.glowColor}` : "none"
                  }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground truncate">
                    {badge.label}
                  </p>
                  <p className="text-[9px] text-muted-foreground/70 truncate mt-0.5">
                    {badge.description}
                  </p>
                </div>
                <div>
                  {badge.unlocked ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.3)]" />
                  ) : (
                    <div className="h-4.5 w-4.5 rounded-full border border-border/30 bg-neutral-900" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
