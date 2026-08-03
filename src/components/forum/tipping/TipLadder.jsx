import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { PTS_CORRECT, PTS_MARGIN_BONUS } from "./constants";
import { shortRoundLabel } from "./tipHelpers";
import { buildLadderRows } from "./ladder";

const LADDER_SIZE = 8;

// ── Tipster ladder ──────────────────────────────────────────────────
// Season/round scopes, medals for the podium, and YOUR row pinned below the
// top 8 when you're outside it — you should never have to hunt for yourself.
export default function TipLadder({ entries, roundLabel, myUserId, myName, localTipCount, localPoints }) {
  const [scope, setScope] = useState("season");

  const rows = useMemo(
    () => buildLadderRows(entries, {
      myUserId,
      myName,
      roundLabel: scope === "round" ? roundLabel : null,
    }),
    [entries, myUserId, myName, scope, roundLabel],
  );

  const myRow = rows.find((r) => r.me);
  const top = rows.slice(0, LADDER_SIZE);
  const mePinned = myRow && myRow.rank > LADDER_SIZE ? myRow : null;
  // A guest (or a fan whose tips haven't settled) still sees their own line,
  // fed from local data, so the ladder never looks like they don't exist.
  const showLocalMe = !myRow && (localTipCount || 0) > 0 && scope === "season";

  const medals = ["🥇", "🥈", "🥉"];
  const maxPoints = Math.max(1, ...rows.map((r) => r.points));
  const anyPoints = rows.some((r) => r.points > 0);

  const renderRow = (row, i) => {
    const metric = anyPoints ? row.points : row.tips;
    const barWidth = Math.max(6, (metric / (anyPoints ? maxPoints : Math.max(1, ...rows.map((r) => r.tips)))) * 100);
    const accuracy = row.settled > 0 ? Math.round((row.wins / row.settled) * 100) : null;
    return (
      <motion.div
        key={row.key}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: Math.min(i * 0.04, 0.4) }}
        className={`relative flex items-center gap-2 overflow-hidden border p-2 ${
          row.me
            ? "border-primary/40 bg-gradient-to-r from-primary/10 to-transparent"
            : row.rank === 1
              ? "border-amber-400/20 bg-gradient-to-r from-amber-500/[0.06] to-transparent"
              : "border-border/15 bg-black/20"
        }`}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className={`absolute inset-y-0 left-0 ${
            row.me ? "bg-primary/[0.08]" : row.rank === 1 ? "bg-amber-400/[0.06]" : "bg-white/[0.02]"
          }`}
        />
        <span className="relative w-6 shrink-0 text-center text-xs tabular-nums">
          {medals[row.rank - 1] || row.rank}
        </span>
        <div className="relative min-w-0 flex-1">
          <p className={`truncate text-xs font-bold ${
            row.me ? "text-primary" : row.rank === 1 ? "text-amber-200" : "text-foreground"
          }`}>
            {row.name}{row.me ? " (you)" : ""}
          </p>
          <p className="text-[9px] text-slate-500">
            {row.tips} tip{row.tips !== 1 ? "s" : ""}
            {row.wins > 0 ? ` · ${row.wins} won` : ""}
            {accuracy != null ? ` · ${accuracy}%` : ""}
          </p>
        </div>
        <div className="relative flex items-baseline gap-1">
          <span className={`text-[11px] font-bold tabular-nums ${
            row.me ? "text-primary" : row.rank === 1 ? "text-amber-300" : "text-foreground/80"
          }`}>
            {metric}
          </span>
          <span className="text-2xs text-slate-500">{anyPoints ? "pts" : "tips"}</span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="border border-border/30 bg-black/30 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Crown className="h-3.5 w-3.5 text-amber-400" />
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300">Tipster Ladder</p>
        </div>
        <div className="flex border border-border/30 bg-black/30 p-0.5">
          {[
            { id: "season", label: "Season" },
            { id: "round", label: roundLabel ? shortRoundLabel(roundLabel) : "Round" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScope(tab.id)}
              disabled={tab.id === "round" && !roundLabel}
              className={`min-h-7 px-2 text-[9px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40 ${
                scope === tab.id ? "bg-primary text-primary-foreground" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        {top.length ? top.map(renderRow) : (
          <p className="text-xs text-slate-500">
            {scope === "round" ? "No tips on this round yet." : "Be first to lock a tip."}
          </p>
        )}
        {mePinned && (
          <>
            <p className="py-0.5 text-center text-[9px] tracking-[0.3em] text-slate-600">···</p>
            {renderRow(mePinned, top.length)}
          </>
        )}
        {showLocalMe && (
          <div className="relative flex items-center gap-2 border border-primary/30 bg-primary/5 p-2">
            <span className="w-6 shrink-0 text-center text-xs">—</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-primary">You</p>
              <p className="text-[9px] text-slate-500">
                {localTipCount} tip{localTipCount !== 1 ? "s" : ""} locked on this device
              </p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[11px] font-bold tabular-nums text-primary">{localPoints || 0}</span>
              <span className="text-2xs text-slate-500">pts</span>
            </div>
          </div>
        )}
      </div>
      <p className="mt-2 text-right text-[9px] text-slate-500">
        {PTS_CORRECT}pt correct · +{PTS_MARGIN_BONUS} exact margin
      </p>
    </div>
  );
}
