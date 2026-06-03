import React, { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Calendar, Megaphone,
  Zap, Clock, AlertTriangle, X, Eye,
} from "lucide-react";

/* ── Constants ── */
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const PRIMARY_FALLBACK = "hsl(15, 95%, 55%)";

/* ── Date Helpers ── */
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Monday = 0, Sunday = 6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const cells = [];
  // Leading blanks
  for (let i = 0; i < startDow; i++) cells.push(null);
  // Actual days
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Trailing blanks to fill last row
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

function isDateInRange(dateStr, startDate, endDate) {
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}

/* ── Resolve sponsor color for an ad ── */
function getAdColor(ad, sponsors) {
  if (ad.sponsor_id && sponsors?.length) {
    const sponsor = sponsors.find((s) => s.id === ad.sponsor_id);
    if (sponsor?.brand_color) return sponsor.brand_color;
  }
  return ad.brand_color || PRIMARY_FALLBACK;
}

/* ── Resolve sponsor name for an ad ── */
function getAdSponsorName(ad, sponsors) {
  if (ad.sponsor_id && sponsors?.length) {
    const sponsor = sponsors.find((s) => s.id === ad.sponsor_id);
    if (sponsor?.name) return sponsor.name;
  }
  return null;
}

/* ── Status helper ── */
function getAdStatus(ad) {
  if (!ad.is_active) return { label: "Paused", cls: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
  const today = toDateStr(new Date());
  if (ad.start_date && today < ad.start_date) return { label: "Scheduled", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
  if (ad.end_date && today > ad.end_date) return { label: "Expired", cls: "text-red-400 bg-red-500/10 border-red-500/20" };
  return { label: "Live", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CampaignCalendar — Monthly Gantt-style calendar for ad campaigns
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function CampaignCalendar({ ads, sponsors }) {
  const safeAds = ads || [];
  const safeSponsors = sponsors || [];
  const today = new Date();
  const todayStr = toDateStr(today);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [direction, setDirection] = useState(0); // -1 prev, 1 next

  /* ── Navigation ── */
  const navigate = useCallback((dir) => {
    setDirection(dir);
    setSelectedDay(null);
    if (dir === -1) {
      if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
      else setViewMonth((m) => m - 1);
    } else {
      if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
      else setViewMonth((m) => m + 1);
    }
  }, [viewMonth]);

  const goToToday = useCallback(() => {
    setDirection(0);
    setSelectedDay(null);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }, []);

  /* ── Grid ── */
  const cells = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  /* ── Ads active per day (precompute) ── */
  const adsByDay = useMemo(() => {
    const map = {};
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      map[d] = safeAds.filter((ad) => {
        if (!ad.start_date && !ad.end_date) return ad.is_active;
        return isDateInRange(dateStr, ad.start_date, ad.end_date);
      });
    }
    return map;
  }, [safeAds, viewYear, viewMonth]);

  /* ── Max ads on any day (for heat map) ── */
  const maxAdsOnDay = useMemo(() => {
    let max = 0;
    Object.values(adsByDay).forEach((list) => { if (list.length > max) max = list.length; });
    return max;
  }, [adsByDay]);

  /* ── Summary stats ── */
  const stats = useMemo(() => {
    const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
    const monthEnd = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(new Date(viewYear, viewMonth + 1, 0).getDate()).padStart(2, "0")}`;
    let active = 0, scheduled = 0, expired = 0;

    safeAds.forEach((ad) => {
      const status = getAdStatus(ad);
      // Check if this ad overlaps the current month at all
      const adStart = ad.start_date || "0000-00-00";
      const adEnd = ad.end_date || "9999-99-99";
      const overlaps = adStart <= monthEnd && adEnd >= monthStart;

      if (status.label === "Expired") expired++;
      else if (status.label === "Scheduled") scheduled++;
      else if (status.label === "Live" && overlaps) active++;
    });
    return { active, scheduled, expired };
  }, [safeAds, viewYear, viewMonth]);

  /* ── Campaign bars data (Gantt rows) ── */
  const campaignBars = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
    const monthEnd = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    return safeAds
      .filter((ad) => {
        if (!ad.start_date && !ad.end_date) return false;
        const adStart = ad.start_date || "0000-00-00";
        const adEnd = ad.end_date || "9999-99-99";
        return adStart <= monthEnd && adEnd >= monthStart;
      })
      .map((ad) => {
        const barStart = ad.start_date && ad.start_date > monthStart
          ? parseInt(ad.start_date.split("-")[2], 10)
          : 1;
        const barEnd = ad.end_date && ad.end_date < monthEnd
          ? parseInt(ad.end_date.split("-")[2], 10)
          : daysInMonth;
        return { ad, barStart, barEnd, color: getAdColor(ad, safeSponsors) };
      });
  }, [safeAds, safeSponsors, viewYear, viewMonth]);

  /* ── Detail panel ads ── */
  const selectedDateStr = selectedDay
    ? `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : null;
  const selectedAds = selectedDay ? (adsByDay[selectedDay] || []) : [];

  /* ── Sponsor legend entries ── */
  const legendEntries = useMemo(() => {
    const seen = new Map();
    safeAds.forEach((ad) => {
      const color = getAdColor(ad, safeSponsors);
      const name = getAdSponsorName(ad, safeSponsors) || ad.title || "Unassigned";
      if (!seen.has(color)) seen.set(color, name);
    });
    return Array.from(seen.entries()).map(([color, name]) => ({ color, name }));
  }, [safeAds, safeSponsors]);

  /* ── Heat map intensity ── */
  function heatOpacity(dayNum) {
    if (!dayNum || maxAdsOnDay === 0) return 0;
    const count = (adsByDay[dayNum] || []).length;
    if (count === 0) return 0;
    return 0.05 + (count / maxAdsOnDay) * 0.2;
  }

  /* ── Month transition variants ── */
  const monthVariants = {
    enter: (dir) => ({ x: dir * 40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir * -40, opacity: 0 }),
  };

  /* ═════════════════════ Render ═════════════════════ */
  return (
    <section className="grid gap-5">
      {/* ── Container ── */}
      <div className="border border-border bg-card/60 cmd-glass overflow-hidden">
        <div className="cmd-accent-bar h-[2px] w-full" />

        {/* ── Header: month title + nav ── */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground font-mono">
                Campaign Calendar
              </p>
            </div>
            <h2 className="font-display text-2xl md:text-3xl uppercase tracking-wide">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] font-mono border border-border hover:border-primary/30 hover:text-primary transition-colors bg-card/40"
            >
              Today
            </button>
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center border border-border hover:border-primary/30 hover:text-primary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate(1)}
              className="flex h-9 w-9 items-center justify-center border border-border hover:border-primary/30 hover:text-primary transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Summary stats row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-border sm:divide-x divide-y sm:divide-y-0 divide-border">
          {[
            { label: "Active This Month", value: stats.active, icon: Zap, color: "text-emerald-400" },
            { label: "Scheduled", value: stats.scheduled, icon: Clock, color: "text-amber-400" },
            { label: "Expired", value: stats.expired, icon: AlertTriangle, color: "text-red-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-center gap-3 px-5 py-3">
              <Icon className={`h-3.5 w-3.5 ${color} shrink-0`} />
              <div>
                <p className={`font-display text-xl tabular-nums ${color}`}>{value}</p>
                <p className="text-[10px] sm:text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground font-mono">
                  {label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Calendar Grid ── */}
        <div className="p-5">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1 text-[9px] sm:text-xs">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60 font-mono py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar body with month transition */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`${viewYear}-${viewMonth}`}
              custom={direction}
              variants={monthVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="grid grid-cols-7"
            >
              {cells.map((dayNum, idx) => {
                if (dayNum === null) {
                  return <div key={`blank-${idx}`} className="h-20 border border-border/20 bg-muted/5" />;
                }

                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const isToday = dateStr === todayStr;
                const isSelected = dayNum === selectedDay;
                const dayAds = adsByDay[dayNum] || [];
                const heat = heatOpacity(dayNum);

                return (
                  <button
                    key={dayNum}
                    onClick={() => setSelectedDay(isSelected ? null : dayNum)}
                    className={`
                      relative h-20 text-left p-1.5 border transition-all duration-150 group/cell
                      ${isToday
                        ? "border-primary bg-primary/5 hover:bg-primary/10"
                        : isSelected
                          ? "border-primary/60 bg-primary/5"
                          : "border-border bg-card/30 hover:bg-muted/10"
                      }
                    `}
                    style={heat > 0 && !isToday ? { backgroundColor: `rgba(var(--primary-rgb, 234,88,12), ${heat})` } : undefined}
                  >
                    {/* Day number */}
                    <span className={`
                      text-xs font-mono font-bold tabular-nums
                      ${isToday ? "text-primary" : "text-foreground/70"}
                    `}>
                      {dayNum}
                    </span>

                    {/* Today dot */}
                    {isToday && (
                      <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                    )}

                    {/* Campaign dot markers */}
                    {dayAds.length > 0 && (
                      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex flex-wrap gap-[3px]">
                        {dayAds.slice(0, 6).map((ad) => (
                          <span
                            key={ad.id}
                            className="h-[5px] w-[5px] shrink-0"
                            style={{ backgroundColor: getAdColor(ad, safeSponsors) }}
                          />
                        ))}
                        {dayAds.length > 6 && (
                          <span className="text-[9px] font-mono text-muted-foreground leading-none">
                            +{dayAds.length - 6}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Campaign bars (Gantt-style) */}
                    {campaignBars
                      .filter((b) => dayNum >= b.barStart && dayNum <= b.barEnd)
                      .slice(0, 3)
                      .map((b, bIdx) => (
                        <div
                          key={b.ad.id}
                          className="absolute left-0 right-0 h-[3px] opacity-80 group-hover/cell:opacity-100 transition-opacity"
                          style={{
                            backgroundColor: b.color,
                            top: `${28 + bIdx * 6}px`,
                            borderRadius: dayNum === b.barStart ? "0 0 0 0" : "0",
                          }}
                        />
                      ))}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>

          {/* Empty state */}
          {safeAds.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground/40 mt-4">
              <Megaphone className="h-8 w-8" />
              <p className="text-xs font-mono uppercase tracking-wider">No campaigns scheduled</p>
            </div>
          )}
        </div>

        {/* ── Detail Panel (slides open below calendar) ── */}
        <AnimatePresence>
          {selectedDay && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden border-t border-border"
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground font-mono">
                      Active Campaigns
                    </p>
                    <h3 className="font-display text-lg uppercase tracking-wide">
                      {selectedDay} {MONTH_NAMES[viewMonth]} {viewYear}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="flex h-10 w-10 items-center justify-center border border-border hover:border-primary/30 hover:text-primary transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {selectedAds.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground/40">
                    <Calendar className="h-6 w-6" />
                    <p className="text-[10px] font-mono uppercase tracking-wider">No campaigns on this day</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {selectedAds.map((ad) => {
                      const status = getAdStatus(ad);
                      const color = getAdColor(ad, safeSponsors);
                      const sponsorName = getAdSponsorName(ad, safeSponsors);

                      return (
                        <motion.div
                          key={ad.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-4 py-3 group/row"
                        >
                          {/* Color swatch */}
                          <div
                            className="h-8 w-1 shrink-0"
                            style={{ backgroundColor: color }}
                          />

                          {/* Thumbnail */}
                          <div className="h-10 w-14 border border-border/40 bg-muted/10 shrink-0 overflow-hidden flex items-center justify-center">
                            {ad.image_url ? (
                              <img src={ad.image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Megaphone className="h-3 w-3 text-muted-foreground/30" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-foreground truncate">
                                {ad.title || "Untitled"}
                              </p>
                              <span className={`text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 border shrink-0 ${status.cls}`}>
                                {status.label}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                              {sponsorName && (
                                <>
                                  <span className="flex items-center gap-1">
                                    <span className="h-2 w-2 shrink-0" style={{ backgroundColor: color }} />
                                    {sponsorName}
                                  </span>
                                  <span>·</span>
                                </>
                              )}
                              {ad.position && <span>{ad.position}</span>}
                              {ad.start_date && <span>· from {ad.start_date}</span>}
                              {ad.end_date && <span>to {ad.end_date}</span>}
                            </div>
                          </div>

                          {/* Active indicator */}
                          {ad.is_active && (
                            <Eye className="h-3.5 w-3.5 text-emerald-400 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Legend ── */}
        {legendEntries.length > 0 && (
          <div className="border-t border-border px-5 py-3">
            <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50 font-mono mb-2">
              Sponsor Legend
            </p>
            <div className="flex flex-wrap items-center gap-4">
              {legendEntries.map(({ color, name }) => (
                <div key={`${color}-${name}`} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[140px]">
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
