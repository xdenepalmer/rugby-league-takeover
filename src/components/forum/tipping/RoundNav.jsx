import React, { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Radio } from "lucide-react";
import { shortRoundLabel } from "./tipHelpers";

// ── Round selector ──────────────────────────────────────────────────
// Horizontal round pager, the backbone of every tipping platform: one round
// on screen, chips to hop between them, tip-count on each chip.
export default function RoundNav({ rounds, index, onSelect, tips }) {
  const scrollerRef = useRef(null);
  const activeRef = useRef(null);

  // Keep the active chip in view when paging with the arrows.
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);

  if (!rounds?.length) return null;

  const stateDot = (round) => {
    if (round.state === "live") return <Radio className="h-2 w-2 text-red-400 animate-pulse" />;
    if (round.state === "done") return <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />;
    if (round.state === "locked") return <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />;
    return <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />;
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect(Math.max(0, index - 1))}
        disabled={index <= 0}
        aria-label="Previous round"
        className="flex h-9 w-8 shrink-0 items-center justify-center border border-border/30 bg-black/30 text-slate-400 transition-colors hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div ref={scrollerRef} className="flex flex-1 gap-1 overflow-x-auto cmd-scrollbar" role="tablist" aria-label="Rounds">
        {rounds.map((round, i) => {
          const active = i === index;
          const tipped = round.games.filter((g) => tips?.[g.id]).length;
          return (
            <button
              key={round.label}
              ref={active ? activeRef : undefined}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(i)}
              className={`flex min-h-9 shrink-0 flex-col items-center justify-center gap-0.5 border px-2.5 transition-colors ${
                active
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-border/25 bg-black/25 text-slate-400 hover:border-border/50 hover:text-slate-200"
              }`}
            >
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                {stateDot(round)}
                {shortRoundLabel(round.label)}
              </span>
              <span className={`text-[8px] font-mono tabular-nums ${
                tipped === round.games.length ? "text-emerald-400" : active ? "text-primary/80" : "text-slate-500"
              }`}>
                {round.state === "done" ? "Final" : `${tipped}/${round.games.length} tipped`}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onSelect(Math.min(rounds.length - 1, index + 1))}
        disabled={index >= rounds.length - 1}
        aria-label="Next round"
        className="flex h-9 w-8 shrink-0 items-center justify-center border border-border/30 bg-black/30 text-slate-400 transition-colors hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
