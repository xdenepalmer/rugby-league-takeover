import React, { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Coins, Gift, Loader2, Target } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { appParams } from "@/lib/app-params";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

// Daily missions: post, react ×3, spin the slot → claim +100 chips / +40 XP.
// Status and the claim are both verified server-side (claimDailyBonus), so
// this card is purely a window onto real state.
export default function DailyMissions() {
  const { isAuthenticated, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["dailyMissions"],
    queryFn: async () => {
      const response = await base44.functions.invoke("claimDailyBonus", { claim: false });
      return response?.data || null;
    },
    enabled: isAuthenticated && appParams.hasBase44Config,
    staleTime: 30_000,
    retry: false,
    meta: { silent: true },
  });

  // Posting, reacting and spinning all fire events elsewhere — refresh the
  // checklist when they happen so ticks appear without a reload.
  useEffect(() => {
    const refetch = () => queryClient.invalidateQueries({ queryKey: ["dailyMissions"] });
    window.addEventListener("rlt_badge_event", refetch);
    window.addEventListener("rlt_admin_log", refetch);
    return () => {
      window.removeEventListener("rlt_badge_event", refetch);
      window.removeEventListener("rlt_admin_log", refetch);
    };
  }, [queryClient]);

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke("claimDailyBonus", { claim: true });
      return response?.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["dailyMissions"] });
      toast({
        title: "Daily bonus claimed! 🎉",
        description: `+${result?.bonus?.chips ?? 100} chips · +${result?.bonus?.xp ?? 40} XP banked to your account.`,
      });
      try { Promise.resolve(refreshUser()).catch(() => {}); } catch { /* ignore */ }
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ["dailyMissions"] });
      toast({ title: "Not yet!", description: error.message, variant: "destructive" });
    },
  });

  if (!isAuthenticated) return null;

  const missions = data?.missions;
  const rows = [
    { key: "post", label: "Post a thread or reply", done: !!missions?.post },
    {
      key: "react",
      label: "Give 3 reactions",
      done: !!missions?.react?.done,
      progress: missions?.react ? `${missions.react.progress}/${missions.react.needed}` : "0/3",
    },
    { key: "spin", label: "Spin the daily slot", done: !!missions?.spin },
  ];
  const doneCount = rows.filter((r) => r.done).length;
  const claimed = !!data?.claimed;
  const claimable = !!data?.allComplete && !claimed;

  return (
    <section className="relative overflow-hidden border border-border/50 bg-card/35 cmd-glass" aria-label="Daily missions">
      <div className="h-[2px] w-full bg-gradient-to-r from-emerald-500 via-primary to-amber-400" />
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-200">Daily Missions</h3>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-300">
            <Coins className="h-3 w-3" /> +100 · +40 XP
          </span>
        </div>

        <div className="mt-3 space-y-1.5">
          {rows.map((row, i) => (
            <motion.div
              key={row.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-2.5 border px-3 py-2 ${
                row.done ? "border-emerald-500/25 bg-emerald-500/[0.05]" : "border-border/30 bg-background/25"
              }`}
            >
              {row.done
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                : <Circle className="h-4 w-4 shrink-0 text-slate-500" />}
              <span className={`flex-1 text-xs font-semibold ${row.done ? "text-emerald-300 line-through decoration-emerald-500/40" : "text-slate-300"}`}>
                {row.label}
              </span>
              {row.progress && !row.done && (
                <span className="text-[10px] font-mono text-slate-400">{row.progress}</span>
              )}
            </motion.div>
          ))}
        </div>

        {claimed ? (
          <p className="mt-3 flex items-center justify-center gap-1.5 border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Bonus claimed — back tomorrow!
          </p>
        ) : (
          <Button
            type="button"
            disabled={!claimable || claimMutation.isPending || isLoading}
            onClick={() => claimMutation.mutate()}
            className={`mt-3 h-10 w-full rounded-none text-[10px] font-bold uppercase tracking-[0.2em] ${
              claimable
                ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-[0_0_18px_rgba(16,185,129,0.25)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
                : "bg-muted text-slate-400"
            }`}
          >
            {claimMutation.isPending ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Claiming…</>
            ) : claimable ? (
              <><Gift className="mr-1.5 h-3.5 w-3.5" /> Claim daily bonus</>
            ) : (
              `${doneCount}/3 missions done`
            )}
          </Button>
        )}
      </div>
    </section>
  );
}
