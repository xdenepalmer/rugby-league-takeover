import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, Users, Flame } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import { LEADERBOARD_SCOPES, medalFor, scoreFor } from "@/lib/leaderboard";

const fmt = (n) => Number(n || 0).toLocaleString("en-AU");

function Avatar({ name, src }) {
  if (src) {
    return <img src={src} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }
  const initial = String(name || "F").charAt(0).toUpperCase();
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border/40 bg-muted/20 text-xs font-bold text-muted-foreground">
      {initial}
    </div>
  );
}

function Row({ entry, scope, isMe }) {
  const medal = medalFor(entry.rank);
  return (
    <div
      className={`flex items-center gap-3 border px-3 py-2.5 transition-colors ${
        isMe ? "border-primary/50 bg-primary/[0.06]" : "border-border/40 bg-card/30"
      }`}
    >
      <div className="w-7 shrink-0 text-center font-display text-sm font-bold tabular-nums text-muted-foreground">
        {medal || entry.rank}
      </div>
      <Avatar name={entry.name} src={entry.avatar} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">
          {entry.name}
          {isMe && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-primary">You</span>}
        </p>
        <p className="truncate text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">{entry.fan_rank}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-display text-sm font-bold tabular-nums text-foreground">{fmt(scoreFor(entry, scope))}</p>
        <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">
          {scope === "weekly" ? "Wk XP" : "XP"}
        </p>
      </div>
    </div>
  );
}

export default function LeaderboardTab() {
  const { user } = useAuth();
  const [scope, setScope] = useState("weekly");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["leaderboard", scope],
    queryFn: () => base44.functions.invoke("leaderboard", { scope, limit: 25 }),
    enabled: appParams.hasBase44Config && !!user?.id,
    retry: false,
    meta: { silent: true },
  });

  const payload = data?.data || {};
  const entries = payload.entries || [];
  const mine = payload.me || null;
  const meInList = mine && entries.some((e) => e.user_id === mine.user_id);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="shrink-0 border border-primary/30 bg-primary/10 p-2">
          <Trophy className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50">Compete</p>
          <p className="font-display text-xl font-bold uppercase tracking-wide text-foreground">Fan Leaderboard</p>
        </div>
      </div>

      {/* Scope toggle */}
      <div className="flex gap-2">
        {LEADERBOARD_SCOPES.map((s) => {
          const Icon = s.key === "weekly" ? Flame : s.key === "team" ? Users : Trophy;
          const active = scope === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setScope(s.key)}
              className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
                active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/40 bg-card/20 text-muted-foreground/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse border border-border/40 bg-muted/10" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-8 text-center text-sm text-muted-foreground/50">Couldn't load the leaderboard right now.</p>
      ) : scope === "team" && !payload.hasTeam ? (
        <div className="border border-border/40 bg-card/20 px-4 py-10 text-center">
          <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground/50">Set your favourite team in Profile to see your team leaderboard.</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="border border-border/40 bg-card/20 px-4 py-10 text-center">
          <Trophy className="mx-auto mb-2 h-6 w-6 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground/50">
            No ranked fans yet{scope === "weekly" ? " this week" : ""}. Post, react and spin to climb the board.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {entries.map((entry) => (
              <motion.div
                key={entry.user_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Row entry={entry} scope={scope} isMe={mine?.user_id === entry.user_id} />
              </motion.div>
            ))}
          </div>

          {/* Your position, if outside the visible top N */}
          {mine && !meInList && (
            <div>
              <p className="mb-1.5 mt-3 text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50">Your position</p>
              <Row entry={mine} scope={scope} isMe />
            </div>
          )}
        </>
      )}

      <p className="text-center text-[9px] text-muted-foreground/40">
        Rankings use your account XP — earn more in the Forum with posts, reactions, tips and the daily slot.
      </p>
    </div>
  );
}
