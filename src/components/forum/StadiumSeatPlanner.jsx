import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Users, Volume2, Zap, Trophy, Plus, Search } from "lucide-react";

const sections = [
  {
    id: "aussie-bay",
    name: "Aussie Fan Zone (Sec 120-128)",
    description: "The primary supporter bay for Aussie travelers. Bring your team flags, green & gold jerseys, and loudest chanting voices!",
    vibe: "Explosive ⚡",
    capacity: "94%",
    db: "108 dB",
    query: "Section 120",
    color: "from-amber-500 to-yellow-400",
    accentColor: "#fbbf24",
    x: 120, y: 215, w: 160, h: 35,
    label: "AUSSIE ZONE (120-128)"
  },
  {
    id: "vip-club",
    name: "VIP Corporate Suites (Sec 101-110)",
    description: "Premium suites with private lounge access, high-end buffet dining, and comfortable padded seats with prime views.",
    vibe: "Exclusive 💎",
    capacity: "82%",
    db: "84 dB",
    query: "Section 101",
    color: "from-purple-500 to-indigo-500",
    accentColor: "#a855f7",
    x: 120, y: 50, w: 160, h: 35,
    label: "VIP CLUB (101-110)"
  },
  {
    id: "endzone-party",
    name: "Endzone Party Deck (Sec 140-144)",
    description: "Lively deck located behind the goal posts, close to the stadium bars and the famous supporter takeover meetup zones.",
    vibe: "Festive 🔥",
    capacity: "68%",
    db: "96 dB",
    query: "Section 140",
    color: "from-red-500 to-orange-500",
    accentColor: "#f97316",
    x: 50, y: 95, w: 60, h: 110,
    label: "ENDZONE (140-144)"
  },
  {
    id: "vegas-neon",
    name: "Vegas Neon Club (Sec 114-118)",
    description: "High-energy club zone with top-shelf bottle service, standing social spaces, and DJ beats during game intervals.",
    vibe: "Lively 🎲",
    capacity: "75%",
    db: "92 dB",
    query: "Section 114",
    color: "from-pink-500 to-cyan-500",
    accentColor: "#ec4899",
    x: 290, y: 95, w: 60, h: 110,
    label: "NEON CLUB (114-118)"
  }
];

export default function StadiumSeatPlanner({ onFilterSearch, onClaimSeat, currentSearch }) {
  const [selectedId, setSelectedId] = useState(null);
  
  const activeSection = sections.find((s) => s.id === selectedId);

  const handleSelect = (sec) => {
    if (selectedId === sec.id) {
      setSelectedId(null);
    } else {
      setSelectedId(sec.id);
    }
  };

  return (
    <div className="border border-border/60 bg-card/30 cmd-glass overflow-hidden">
      <div className="h-[2px] w-full cmd-accent-bar" />
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-1.5 bg-primary/10 border border-primary/20">
            <Trophy className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Stadium Fan Seating Planner</h3>
            <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/40">Allegiant Stadium Supporter Bays</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground/60 leading-relaxed mt-2 mb-4">
          Click on a section of the stadium to explore supporter vibes, filter match-day threads, or claim your seat section to write a post.
        </p>

        {/* ── Interactive SVG Map ── */}
        <div className="relative border border-border/40 bg-black/60 p-4 flex justify-center items-center overflow-hidden">
          {/* Neon scanline sweeps the stadium */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
            <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent cmd-scan-line" />
          </div>

          <svg viewBox="0 0 400 300" className="w-full max-w-[340px] h-auto select-none">
            {/* Stadium Grid Lines */}
            <circle cx="200" cy="150" r="140" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="200" cy="150" r="100" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" strokeDasharray="3 3" />

            {/* Rugby Field */}
            <rect x="120" y="95" width="160" height="110" fill="#022c22" stroke="#059669" strokeWidth="1.5" opacity="0.8" />
            {/* Field Lines */}
            <line x1="200" y1="95" x2="200" y2="205" stroke="#10b981" strokeWidth="1" opacity="0.5" />
            <line x1="160" y1="95" x2="160" y2="205" stroke="#10b981" strokeWidth="0.75" opacity="0.3" />
            <line x1="240" y1="95" x2="240" y2="205" stroke="#10b981" strokeWidth="0.75" opacity="0.3" />
            {/* Left Goal Post */}
            <path d="M 120 135 L 114 135 M 114 120 L 114 180 M 120 165 L 114 165" stroke="#fbbf24" strokeWidth="1" fill="none" opacity="0.8" />
            {/* Right Goal Post */}
            <path d="M 280 135 L 286 135 M 286 120 L 286 180 M 280 165 L 286 165" stroke="#fbbf24" strokeWidth="1" fill="none" opacity="0.8" />
            {/* Field Text */}
            <text x="200" y="153" textAnchor="middle" fill="#047857" fontSize="8" fontWeight="bold" letterSpacing="2" opacity="0.8">RL TAKEOVER</text>

            {/* Stadium Seating Sections */}
            {sections.map((sec) => {
              const isSelected = selectedId === sec.id;
              return (
                <g key={sec.id} className="cursor-pointer" onClick={() => handleSelect(sec)}>
                  <motion.rect
                    x={sec.x}
                    y={sec.y}
                    width={sec.w}
                    height={sec.h}
                    rx="3"
                    ry="3"
                    fill={isSelected ? `url(#${sec.id}-grad)` : "rgba(30, 41, 59, 0.45)"}
                    stroke={isSelected ? sec.accentColor : "rgba(148, 163, 184, 0.15)"}
                    strokeWidth={isSelected ? 1.5 : 1}
                    animate={{
                      stroke: isSelected ? sec.accentColor : "rgba(148, 163, 184, 0.15)",
                      fillOpacity: isSelected ? 1 : 0.85
                    }}
                    whileHover={{ scale: 1.015, fillOpacity: 0.95 }}
                    style={{ originX: "200px", originY: "150px" }}
                  />

                  {/* Section Label Text */}
                  <text
                    x={sec.x + sec.w / 2}
                    y={sec.y + sec.h / 2 + 3}
                    textAnchor="middle"
                    fill={isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.3)"}
                    fontSize={sec.h > 50 ? "7" : "8"}
                    fontWeight="bold"
                    letterSpacing="1"
                    transform={sec.h > 50 ? `rotate(-90 ${sec.x + sec.w / 2} ${sec.y + sec.h / 2})` : ""}
                    className="pointer-events-none font-mono"
                  >
                    {sec.h > 50 ? sec.label.split(" ")[0] : sec.label.replace("ZONE", "").replace("CLUB", "")}
                  </text>

                  {/* Section Glow Gradients */}
                  <defs>
                    <linearGradient id={`${sec.id}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={sec.accentColor} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={sec.accentColor} stopOpacity={0.15} />
                    </linearGradient>
                  </defs>
                </g>
              );
            })}
          </svg>
        </div>

        {/* ── HUD Section details ── */}
        <div className="mt-4 min-h-[110px] relative border border-border/30 bg-muted/[0.02] p-3 flex flex-col justify-between">
          <AnimatePresence mode="wait">
            {activeSection ? (
              <motion.div
                key={activeSection.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" style={{ color: activeSection.accentColor }} />
                      {activeSection.name}
                    </p>
                    <span className="text-[8px] font-mono uppercase font-bold px-1.5 py-0.5 rounded-sm bg-primary/10 border border-primary/20 text-primary">
                      Active HUD
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/75 leading-relaxed mt-1">
                    {activeSection.description}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-border/25 pt-2">
                  <div className="text-center">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/40 flex items-center justify-center gap-1">
                      <Zap className="h-2.5 w-2.5" /> Vibe
                    </p>
                    <p className="text-xs font-bold text-foreground mt-0.5">{activeSection.vibe}</p>
                  </div>
                  <div className="text-center border-x border-border/20">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/40 flex items-center justify-center gap-1">
                      <Users className="h-2.5 w-2.5" /> Capacity
                    </p>
                    <p className="text-xs font-bold text-foreground mt-0.5">{activeSection.capacity}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/40 flex items-center justify-center gap-1">
                      <Volume2 className="h-2.5 w-2.5" /> Sound
                    </p>
                    <p className="text-xs font-bold text-foreground mt-0.5">{activeSection.db}</p>
                  </div>
                </div>

                {/* Direct Action buttons inside HUD */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onFilterSearch(activeSection.query)}
                    className="flex-1 flex min-h-[36px] items-center justify-center gap-1.5 border border-border/50 bg-neutral-900/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground hover:bg-neutral-900 hover:border-primary/30 transition-all"
                  >
                    <Search className="h-3 w-3" /> Filter Posts
                  </button>
                  <button
                    type="button"
                    onClick={() => onClaimSeat(activeSection.query)}
                    className="flex-1 flex min-h-[36px] items-center justify-center gap-1.5 bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 shadow-[0_0_10px_rgba(249,115,22,0.2)] transition-all"
                  >
                    <Plus className="h-3 w-3" /> Claim Seat
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty-hud"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col justify-center items-center text-center p-4"
              >
                <MapPin className="h-6 w-6 text-muted-foreground/30 mb-2 cmd-pulse" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30">
                  NO SECTOR SELECTED
                </p>
                <p className="text-[9px] text-muted-foreground/25 mt-0.5">
                  Select any section on the vector map to activate stadium controls.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
