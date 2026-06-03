import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, Coins, Flame, MessageSquare, Reply, ThumbsUp, Heart, Sparkles, TrendingUp, Award } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";

/* Rank ladder — mirrors CASINO_RANKS in base44/functions/submitForumPost (keep in sync).
   Ordered high→low so the first match is the current rank. */
const RANKS = [
  { min: 2500, name: "Vegas Royalty" },
  { min: 1500, name: "Whale" },
  { min: 900, name: "High Roller" },
  { min: 450, name: "Pit Boss" },
  { min: 180, name: "Table Regular" },
  { min: 60, name: "Lucky Local" },
  { min: 0, name: "Rookie Punter" },
];

const REWARD_ICON = {
  thread: MessageSquare,
  reply: Reply,
  reaction_given: ThumbsUp,
  reaction_received: Heart,
  slot: Sparkles,
  tip: TrendingUp,
};

const num = (v) => Number(v || 0);
const fmt = (n) => num(n).toLocaleString("en-AU");
const shortDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
};

function StatTile({ icon: Icon, label, value, tone = "text-primary" }) {
  return (
    <div className="flex items-center gap-3 border border-border/40 bg-card/30 cmd-glass px-4 py-3">
      <div className="shrink-0 border border-border/30 bg-muted/20 p-1.5">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
      </div>
      <div className="min-w-0">
        <p className="font-display text-lg font-bold leading-none text-foreground tabular-nums">{value}</p>
        <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">{label}</p>
      </div>
    </div>
  );
}

export default function FanHubTab() {
  const { user } = useAuth();

  const { data: rewards = [] } = useQuery({
    queryKey: ["fanRewardEvents", user?.id],
    queryFn: () => base44.entities.ForumRewardEvent.filter({ user_id: user.id }, "-created_date", 25),
    enabled: appParams.hasBase44Config && !!user?.id,
    retry: false,
    meta: { silent: true },
  });

  const xp = num(user?.casino_xp);
  const chips = num(user?.casino_chips);
  const streak = num(user?.casino_streak);

  const { rankName, nextAt, prevAt, toNext, progress } = useMemo(() => {
    const idx = RANKS.findIndex((r) => xp >= r.min);
    const current = RANKS[idx] || RANKS[RANKS.length - 1];
    const next = idx > 0 ? RANKS[idx - 1] : null; // higher rank is earlier in the array
    const prev = current.min;
    const ceil = next ? next.min : null;
    return {
      rankName: user?.casino_rank || current.name,
      nextAt: ceil,
      prevAt: prev,
      toNext: ceil ? Math.max(0, ceil - xp) : 0,
      progress: ceil ? Math.min(100, Math.round(((xp - prev) / (ceil - prev)) * 100)) : 100,
    };
  }, [xp, user?.casino_rank]);

  const hasProgress = xp > 0 || chips > 0 || rewards.length > 0;

  return (
    <div className="space-y-6">
      {/* Level / rank header */}
      <div className="border border-border/40 bg-card/30 cmd-glass p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 border border-primary/30 bg-primary/10 p-2">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50">Fan Rank</p>
              <p className="truncate font-display text-xl font-bold uppercase tracking-wide text-foreground">{rankName}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-2xl font-black tabular-nums text-foreground">{fmt(xp)}</p>
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Total XP</p>
          </div>
        </div>

        {/* Progress to next rank */}
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-border/60">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            />
          </div>
          <p className="mt-1.5 text-[9px] font-medium text-muted-foreground/60">
            {nextAt
              ? `${fmt(toNext)} XP to next rank`
              : "Top rank reached — you're Vegas Royalty 👑"}
          </p>
        </div>
      </div>

      {/* Balance + activity tiles (server-durable, synced across devices) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatTile icon={Coins} label="Chips" value={fmt(chips)} tone="text-amber-400" />
        <StatTile icon={Flame} label="Day Streak" value={fmt(streak)} tone="text-orange-400" />
        <StatTile icon={MessageSquare} label="Threads" value={fmt(user?.casino_total_posts)} tone="text-primary" />
        <StatTile icon={Reply} label="Replies" value={fmt(user?.casino_total_replies)} tone="text-accent" />
        <StatTile icon={ThumbsUp} label="Reactions Given" value={fmt(user?.casino_total_reactions_given)} tone="text-sky-400" />
        <StatTile icon={Heart} label="Reactions Got" value={fmt(user?.casino_total_reactions_received)} tone="text-red-400" />
      </div>

      {/* Recent rewards */}
      <div className="border border-border/40 bg-card/20 cmd-glass">
        <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
          <Award className="h-3.5 w-3.5 text-primary/70" />
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60">Recent Rewards</p>
        </div>
        {rewards.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground/15" />
            <p className="text-sm text-muted-foreground/40">
              {hasProgress ? "No recent reward activity." : "Start earning — post in the forum, react, lock a tip, or spin the daily slot."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/20">
            {rewards.map((r) => {
              const Icon = REWARD_ICON[r.kind] || Sparkles;
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="shrink-0 border border-border/30 bg-muted/15 p-1.5">
                    <Icon className="h-3 w-3 text-primary/70" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{r.note || r.kind}</p>
                    <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40">{shortDate(r.created_date)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {num(r.xp) > 0 && <span className="text-[10px] font-bold tabular-nums text-primary">+{fmt(r.xp)} XP</span>}
                    {num(r.chips) > 0 && <span className="ml-2 text-[10px] font-bold tabular-nums text-amber-400">+{fmt(r.chips)} 🪙</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-center text-[9px] text-muted-foreground/40">
        XP, chips, rank &amp; streak are saved to your account and follow you across devices. Earn more in the Forum — daily slot, tips, and reactions.
      </p>
    </div>
  );
}
