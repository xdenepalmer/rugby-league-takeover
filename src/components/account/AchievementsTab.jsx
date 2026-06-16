import React, { useEffect, useMemo, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, Lock, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, evaluateAchievements, normalizeStats } from "@/lib/achievements";

const TIER_STYLES = {
  Common: "border-slate-400/30 text-slate-300",
  Uncommon: "border-emerald-400/40 text-emerald-300",
  Rare: "border-sky-400/40 text-sky-300",
  Epic: "border-violet-400/40 text-violet-300",
  Legendary: "border-amber-400/50 text-amber-300",
};

function AchievementCard({ item }) {
  const { unlocked, pct, value, threshold } = item;
  const tierClass = TIER_STYLES[item.tier] || TIER_STYLES.Common;
  return (
    <div
      className={`relative overflow-hidden border bg-card/30 cmd-glass p-4 transition-colors ${
        unlocked ? "border-primary/40" : "border-border/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 grid h-11 w-11 place-items-center border text-2xl ${
            unlocked ? "border-primary/40 bg-primary/10" : "border-border/30 bg-muted/10 grayscale opacity-50"
          }`}
          aria-hidden="true"
        >
          {unlocked ? item.emoji : <Lock className="h-4 w-4 text-muted-foreground/40" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-foreground">{item.title}</p>
            <span className={`shrink-0 border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${tierClass}`}>
              {item.tier}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/60">{item.description}</p>

          {unlocked ? (
            <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
              <CheckCircle2 className="h-3 w-3" /> Unlocked
              {item.reward_chips > 0 && <span className="text-amber-400">· +{item.reward_chips} 🪙</span>}
            </p>
          ) : (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-primary/70 to-accent/70"
                />
              </div>
              <p className="mt-1 text-[9px] font-mono text-muted-foreground/50 tabular-nums">
                {value.toLocaleString("en-AU")} / {threshold.toLocaleString("en-AU")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AchievementsTab() {
  const { user, refreshUser } = useAuth();
  const synced = useRef(false);

  const { items, unlockedCount, total } = useMemo(
    () => evaluateAchievements(normalizeStats(user)),
    [user],
  );

  // Durably record any newly-met achievements server-side (and grant one-time
  // chip rewards) once per mount. The client view above already reflects them.
  const sync = useMutation({
    mutationFn: () => base44.functions.invoke("evaluateAchievements", {}),
    onSuccess: async (res) => {
      const newly = res?.data?.newlyUnlocked || [];
      const awarded = res?.data?.awardedChips || 0;
      if (newly.length) {
        const titles = newly
          .map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.title)
          .filter(Boolean)
          .slice(0, 3)
          .join(", ");
        toast({
          title: `🏆 ${newly.length} achievement${newly.length > 1 ? "s" : ""} unlocked!`,
          description: awarded > 0 ? `${titles} · +${awarded} chips` : titles,
        });
        await refreshUser();
      }
    },
  });

  useEffect(() => {
    if (synced.current || !appParams.hasBase44Config || !user?.id) return;
    synced.current = true;
    sync.mutate();
  }, [user?.id, sync]);

  const byCategory = useMemo(() => {
    const map = {};
    for (const it of items) (map[it.category] ||= []).push(it);
    return map;
  }, [items]);

  const overallPct = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Cabinet header */}
      <div className="border border-border/40 bg-card/30 cmd-glass p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 border border-primary/30 bg-primary/10 p-2">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50">Trophy Cabinet</p>
              <p className="truncate font-display text-xl font-bold uppercase tracking-wide text-foreground">Achievements</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-2xl font-black tabular-nums text-foreground">
              {unlockedCount}<span className="text-muted-foreground/40">/{total}</span>
            </p>
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Unlocked</p>
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-border/60">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${overallPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          />
        </div>
      </div>

      {/* Categories */}
      {ACHIEVEMENT_CATEGORIES.map((cat) => {
        const list = byCategory[cat.key] || [];
        if (!list.length) return null;
        return (
          <div key={cat.key}>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60">{cat.label}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((item) => (
                <AchievementCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        );
      })}

      <p className="text-center text-[9px] text-muted-foreground/40">
        Achievements unlock automatically as you post, react, keep streaks, climb ranks and collect slot badges — and they follow you across devices.
      </p>
    </div>
  );
}
