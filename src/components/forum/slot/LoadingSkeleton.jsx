import React from "react";
import { REEL_WINDOW_H } from "./slotConstants";

/* ─── Loading Skeleton ─── */
export default function LoadingSkeleton() {
  return (
    <div className="relative overflow-hidden border border-purple-500/20 bg-[linear-gradient(145deg,rgba(88,28,135,0.3),rgba(3,0,15,0.98)_40%,rgba(30,0,50,0.95))] shadow-[0_0_50px_rgba(88,28,135,0.12)] animate-pulse">
      <div className="h-[3px] w-full bg-gradient-to-r from-pink-500/30 via-purple-400/30 to-amber-400/30" />
      <div className="p-4 sm:p-5 space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-purple-900/50 border border-purple-500/20" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-40 bg-purple-900/40 rounded" />
            <div className="h-2.5 w-28 bg-purple-900/30 rounded" />
          </div>
        </div>
        {/* Reels skeleton */}
        <div className="border border-purple-500/20 bg-black p-3">
          <div className="flex gap-0.5 mb-2.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-1.5 flex-1 bg-purple-900/30" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-purple-950/50 border border-purple-500/10" style={{ height: REEL_WINDOW_H }}>
                <div className="flex items-center justify-center h-full">
                  <div className="w-12 h-12 rounded-full bg-purple-900/40" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Button skeleton */}
        <div className="h-12 w-full bg-neutral-900 border border-purple-500/20" />
        {/* Badge grid skeleton */}
        <div className="border-t border-purple-500/15 pt-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="min-h-[5rem] bg-black/40 border border-white/5" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
