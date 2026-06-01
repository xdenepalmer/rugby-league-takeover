import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Users, Share2, TrendingUp, Calendar } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const defaultMatchup = {
  id: "showcase-vegas",
  home_team: "Aussie All-Stars",
  away_team: "US Patriots",
  label: "NRL Vegas Opening Showdown",
  venue: "Allegiant Stadium",
  home_logo: "",
  away_logo: ""
};

export default function ScorePredictor({ onSharePrediction }) {
  const [homeScore, setHomeScore] = useState(24);
  const [awayScore, setAwayScore] = useState(16);
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedMatchupId, setSelectedMatchupId] = useState("showcase-vegas");
  const [pollStats, setPollStats] = useState({ homePercent: 72, awayPercent: 28, totalVotes: 148 });

  // Query matches from DB
  const queriesEnabled = appParams.hasBase44Config;
  const { data: matchups = [] } = useQuery({
    queryKey: ["matchups"],
    queryFn: () => base44.entities.Matchup.list("sort_order", 100),
    enabled: queriesEnabled,
    retry: false,
    meta: { silent: true }
  });

  const activeMatchups = matchups.filter(m => m.is_published !== false);
  const displayMatchups = activeMatchups.length > 0 ? activeMatchups : [defaultMatchup];

  // Resolve currently active matchup
  const currentMatchup = displayMatchups.find(m => m.id === selectedMatchupId) || displayMatchups[0] || defaultMatchup;

  // Auto-select first database matchup once loaded
  useEffect(() => {
    if (activeMatchups.length > 0 && selectedMatchupId === "showcase-vegas") {
      setSelectedMatchupId(activeMatchups[0].id);
    }
  }, [activeMatchups, selectedMatchupId]);

  // Load vote state and mock stats when matchup selection changes
  useEffect(() => {
    if (!currentMatchup) return;
    try {
      const saved = localStorage.getItem(`rlt_match_voted_${currentMatchup.id}`);
      setHasVoted(!!saved);
    } catch {
      setHasVoted(false);
    }

    // Generate unique, stable seed-based stats for each match
    const seed = String(currentMatchup.id).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const homePercent = 50 + (seed % 31) - 15; // 35% to 81%
    const totalVotes = 45 + (seed % 120);
    setPollStats({
      homePercent,
      awayPercent: 100 - homePercent,
      totalVotes
    });

    // Reset slider default scores
    setHomeScore(24);
    setAwayScore(16);
  }, [currentMatchup.id]);

  const handleVote = () => {
    setPollStats((prev) => {
      const isHomeWin = homeScore > awayScore;
      const nextHome = isHomeWin ? Math.ceil(prev.totalVotes * (prev.homePercent / 100)) + 1 : Math.floor(prev.totalVotes * (prev.homePercent / 100));
      const nextTotal = prev.totalVotes + 1;
      const nextHomePercent = Math.round((nextHome / nextTotal) * 100);

      return {
        homePercent: nextHomePercent,
        awayPercent: 100 - nextHomePercent,
        totalVotes: nextTotal,
      };
    });

    setHasVoted(true);
    // Update local achievement state
    try {
      localStorage.setItem(`rlt_match_voted_${currentMatchup.id}`, "true");
      // Fire local event to notify achievements panel
      window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "vote" } }));
    } catch {
      // ignore
    }
  };

  const handleShare = () => {
    if (onSharePrediction) {
      onSharePrediction(currentMatchup, homeScore, awayScore);
      // Fire local event to notify achievements panel
      try {
        window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "share" } }));
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="border border-border/65 bg-card/30 cmd-glass overflow-hidden">
      <div className="h-[2px] w-full cmd-accent-bar" />
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 border border-primary/20">
              <Trophy className="h-3.5 w-3.5 text-primary animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Match Predictor</h3>
              <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/45">NRL Takeover Fan Tipping</p>
            </div>
          </div>

          {/* Match selector dropdown */}
          {displayMatchups.length > 1 && (
            <Select value={selectedMatchupId} onValueChange={setSelectedMatchupId}>
              <SelectTrigger className="h-8 max-w-[130px] rounded-none border-border bg-black/40 text-[9px] uppercase font-bold tracking-wider font-mono">
                <SelectValue placeholder="Select match" />
              </SelectTrigger>
              <SelectContent className="bg-neutral-950 border-border rounded-none cmd-glass">
                {displayMatchups.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-[9px] uppercase font-bold tracking-wider font-mono text-muted-foreground hover:text-foreground">
                    {m.home_team.substring(0, 3)} vs {m.away_team.substring(0, 3)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Selected match detail tag */}
        <div className="flex items-center gap-1 text-[8px] font-mono text-primary/80 uppercase tracking-widest bg-primary/5 border border-primary/10 px-2 py-1 mb-3">
          <Calendar className="h-2.5 w-2.5" />
          <span>{currentMatchup.label || "Showdown Match"}</span>
          {currentMatchup.venue && <span className="text-muted-foreground/60 ml-auto">@{currentMatchup.venue}</span>}
        </div>

        <p className="text-xs text-muted-foreground/60 leading-relaxed mb-4">
          Set predictions, submit your vote for community stats, and share directly to match day discussions!
        </p>

        {/* ── Twin Score Sliders ── */}
        <div className="space-y-4 border border-border/40 bg-black/40 p-4">
          {/* Home Team */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                {currentMatchup.home_logo ? (
                  <img src={currentMatchup.home_logo} alt="" className="h-4 w-4 object-contain inline-block" />
                ) : (
                  <span>🏉</span>
                )}
                {currentMatchup.home_team}
              </span>
              <span className="font-mono font-bold text-sm tracking-widest text-amber-300 tabular-nums">
                {homeScore}
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                type="range"
                min="0"
                max="60"
                value={homeScore}
                onChange={(e) => setHomeScore(Number(e.target.value))}
                className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          </div>

          {/* Away Team */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-red-400 flex items-center gap-1.5">
                {currentMatchup.away_logo ? (
                  <img src={currentMatchup.away_logo} alt="" className="h-4 w-4 object-contain inline-block" />
                ) : (
                  <span>🇺🇸</span>
                )}
                {currentMatchup.away_team}
              </span>
              <span className="font-mono font-bold text-sm tracking-widest text-red-300 tabular-nums">
                {awayScore}
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                type="range"
                min="0"
                max="60"
                value={awayScore}
                onChange={(e) => setAwayScore(Number(e.target.value))}
                className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>
          </div>
        </div>

        {/* ── Poll / Sentiment HUD ── */}
        <div className="mt-4 border border-border/30 bg-muted/[0.02] p-3 flex flex-col justify-between">
          <AnimatePresence mode="wait">
            {hasVoted ? (
              <motion.div
                key="voted-hud"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      Win Probability HUD
                    </p>
                    <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/40 tabular-nums">
                      {pollStats.totalVotes} Votes
                    </span>
                  </div>

                  {/* Dynamic split percentages */}
                  <div className="mt-2.5 space-y-2">
                    <div className="relative h-6 w-full bg-neutral-900 border border-border/30 overflow-hidden flex">
                      <motion.div
                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 flex items-center pl-3"
                        initial={{ width: 0 }}
                        animate={{ width: `${pollStats.homePercent}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      >
                        <span className="text-[9px] font-bold text-neutral-950 uppercase tracking-wider truncate">
                          {currentMatchup.home_team.substring(0, 3)} {pollStats.homePercent}%
                        </span>
                      </motion.div>
                      <motion.div
                        className="h-full bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-end pr-3"
                        initial={{ width: 0 }}
                        animate={{ width: `${pollStats.awayPercent}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        style={{ marginLeft: "auto" }}
                      >
                        <span className="text-[9px] font-bold text-white uppercase tracking-wider truncate">
                          {pollStats.awayPercent}% {currentMatchup.away_team.substring(0, 3)}
                        </span>
                      </motion.div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex-1 flex min-h-[36px] items-center justify-center gap-1.5 bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 shadow-[0_0_10px_rgba(249,115,22,0.2)] transition-all"
                  >
                    <Share2 className="h-3 w-3" /> Share Prediction
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="vote-prompt"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="flex flex-col justify-center items-center text-center py-2">
                  <Users className="h-6 w-6 text-muted-foreground/30 mb-1.5" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/45">
                    Cast Your Vote
                  </p>
                  <p className="text-[9px] text-muted-foreground/25 mt-0.5 max-w-[240px]">
                    Submit your score prediction to unlock community statistics.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleVote}
                    className="w-full flex min-h-[36px] items-center justify-center gap-1.5 border border-border/50 bg-neutral-900/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground hover:bg-neutral-900 hover:border-primary/30 transition-all"
                  >
                    Submit Vote
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="w-full flex min-h-[36px] items-center justify-center gap-1.5 bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 shadow-[0_0_10px_rgba(249,115,22,0.2)] transition-all"
                  >
                    <Share2 className="h-3 w-3" /> Share
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
