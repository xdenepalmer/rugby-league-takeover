import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarRange,
  Megaphone,
  Zap,
  Clock,
  AlertTriangle,
  Search,
  Eye,
} from "lucide-react";
import PullToRefresh from "@/components/PullToRefresh";
import { emitHaptic } from "@/lib/native/haptic-events";
import { useWindowedList } from "@/hooks/use-windowed-list";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  toDateStr,
  todayStr,
  dateStrFor,
  monthBounds,
  getAdColor,
  getAdSponsorName,
  getAdStatus,
  adsActiveOnDate,
  dayCounts,
  campaignsInMonth,
  monthStats,
  legendEntries,
  stepMonth,
  monthLabel,
  formatDayTitle,
  filterCampaigns,
} from "./calendar-helpers.js";

/**
 * Native Campaign Calendar — a true native workflow (003G/003K pattern).
 * Timeline/list at /admin/ads/calendar, per-day detail at
 * /admin/ads/calendar/:date. This module is READ-ONLY, exactly like the web
 * CampaignCalendar: it derives everything from the same two localStorage
 * stores and NEVER writes. There is no entity, no edge function, no
 * rlt_admin_log event on either surface, so this workflow performs none.
 *
 * Ads live in localStorage `rlt_ad_config` and sponsors in `rlt_sponsors`
 * (the exact keys the web admin-modules wrapper reads to feed CampaignCalendar).
 * localStorage isn't reactive, so — like the sponsors workflow — each store is
 * layered behind a React Query cache whose queryFn reads localStorage:
 *   • `rlt_sponsors` reuses the SAME ["sponsors"] key the sponsors workflow
 *     already owns, so the cache stays shared across both native surfaces.
 *   • `rlt_ad_config` has no web React Query key to reuse (the web calendar
 *     reads localStorage directly), so ["adConfig"] is introduced native-side
 *     purely as a read cache over that localStorage truth.
 * PullToRefresh re-reads both by invalidating those keys.
 */

const AD_CONFIG_KEY = "rlt_ad_config";
const SPONSORS_LS_KEY = "rlt_sponsors";
const AD_CONFIG_QUERY_KEY = ["adConfig"];
const SPONSORS_QUERY_KEY = ["sponsors"];

function readLS(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

const useAdConfig = () =>
  useQuery({
    queryKey: AD_CONFIG_QUERY_KEY,
    // Source of truth is localStorage "rlt_ad_config", read fresh each fetch.
    queryFn: () => readLS(AD_CONFIG_KEY, []),
    staleTime: 0,
  });

const useSponsors = () =>
  useQuery({
    queryKey: SPONSORS_QUERY_KEY,
    // Source of truth is localStorage "rlt_sponsors" (shared with the sponsors workflow).
    queryFn: () => readLS(SPONSORS_LS_KEY, []),
    staleTime: 0,
  });

const CALENDAR_REFRESH_KEYS = [AD_CONFIG_QUERY_KEY, SPONSORS_QUERY_KEY];

/** Status badge — same labels/tones the web CampaignCalendar renders. */
function StatusBadge({ status }) {
  return (
    <span className={`shrink-0 border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${status.cls}`}>
      {status.label}
    </span>
  );
}

/** A single campaign/ad row shared by the month list and the day detail. */
function CampaignRow({ ad, color, sponsorName, today, onClick }) {
  const status = getAdStatus(ad, today);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ios-pressable flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left ${
        ad.is_active === false ? "opacity-60" : ""
      }`}
    >
      <div className="h-10 w-1 shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
      <div className="flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden border border-border/40 bg-card/50">
        {ad.image_url ? (
          <img src={ad.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Megaphone className="h-4 w-4 text-muted-foreground/40" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold">{ad.title || "Untitled"}</p>
          <StatusBadge status={status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1 text-[10px] font-mono text-muted-foreground">
          {sponsorName && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
              {sponsorName}
            </span>
          )}
          {ad.position && <span>{ad.position}</span>}
          {ad.start_date && <span>from {ad.start_date}</span>}
          {ad.end_date && <span>to {ad.end_date}</span>}
        </div>
      </div>
      {ad.is_active && <Eye className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-label="Active" />}
    </button>
  );
}

/** ── MONTH TIMELINE (default export) — /admin/ads/calendar ────────────────── */
export default function NativeCalendarWorkflow() {
  const navigate = useNavigate();
  const { data: ads = [], isLoading: adsLoading } = useAdConfig();
  const { data: sponsors = [], isLoading: sponsorsLoading } = useSponsors();
  const isLoading = adsLoading || sponsorsLoading;

  const now = useMemo(() => new Date(), []);
  const today = toDateStr(now);
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [query, setQuery] = useState("");

  const stats = useMemo(() => monthStats(ads, view.year, view.month, today), [ads, view, today]);
  const counts = useMemo(() => dayCounts(ads, view.year, view.month), [ads, view]);
  const legend = useMemo(() => legendEntries(ads, sponsors), [ads, sponsors]);
  const rows = useMemo(() => campaignsInMonth(ads, sponsors, view.year, view.month), [ads, sponsors, view]);
  const visible = useMemo(() => filterCampaigns(rows, query), [rows, query]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, {
    initial: 20,
    step: 20,
    restoreKey: "admin-calendar",
  });

  const { daysInMonth } = monthBounds(view.year, view.month);
  const maxCount = Math.max(0, ...Object.values(counts));

  const goMonth = (dir) => {
    emitHaptic("action.primary");
    setView((v) => stepMonth(v, dir));
  };
  const goToday = () => {
    emitHaptic("action.primary");
    setView({ year: now.getFullYear(), month: now.getMonth() });
  };
  const openDay = (dateStr) => {
    emitHaptic("tab.select");
    navigate(`/admin/ads/calendar/${encodeURIComponent(dateStr)}`);
  };

  const STAT_TILES = [
    { key: "active", label: "Active This Month", value: stats.active, icon: Zap, tone: "text-emerald-400" },
    { key: "scheduled", label: "Scheduled", value: stats.scheduled, icon: Clock, tone: "text-amber-400" },
    { key: "expired", label: "Expired", value: stats.expired, icon: AlertTriangle, tone: "text-red-400" },
  ];

  return (
    <div className="pb-8">
      <NativeTopBar
        title="Campaign Calendar"
        fallback="/admin/ads"
        right={
          <button
            type="button"
            onClick={goToday}
            className="ios-pressable flex h-11 items-center justify-center px-2 text-[10px] font-black uppercase tracking-widest text-primary"
          >
            Today
          </button>
        }
      />
      <PullToRefresh queryKeys={CALENDAR_REFRESH_KEYS}>
        {/* Month navigation */}
        <div className="flex items-center justify-between px-4 pt-3">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            aria-label="Previous month"
            className="ios-pressable flex h-11 min-w-11 items-center justify-center border border-border text-muted-foreground"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold uppercase tracking-widest">{monthLabel(view.year, view.month)}</h2>
          </div>
          <button
            type="button"
            onClick={() => goMonth(1)}
            aria-label="Next month"
            className="ios-pressable flex h-11 min-w-11 items-center justify-center border border-border text-muted-foreground"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 px-4 pt-3">
          {STAT_TILES.map(({ key, label, value, icon: Icon, tone }) => (
            <div key={key} className="border border-border/60 bg-card/50 px-2 py-2.5 text-center">
              <Icon className={`mx-auto h-4 w-4 ${tone}`} aria-hidden="true" />
              <p className={`pt-1 font-display text-xl tabular-nums ${tone}`}>{value}</p>
              <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Day strip — tap a day to see its active campaigns */}
        <div className="ios-scroll flex gap-1.5 overflow-x-auto px-4 py-3">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateStr = dateStrFor(view.year, view.month, day);
            const count = counts[day] || 0;
            const isToday = dateStr === today;
            return (
              <button
                key={day}
                type="button"
                onClick={() => openDay(dateStr)}
                aria-label={`${formatDayTitle(dateStr)}, ${count} campaign${count === 1 ? "" : "s"}`}
                className={`ios-pressable flex min-h-14 w-11 shrink-0 flex-col items-center justify-center gap-1 border ${
                  isToday ? "border-primary bg-primary/10" : "border-border/60 bg-card/40"
                }`}
              >
                <span className={`font-mono text-xs font-bold tabular-nums ${isToday ? "text-primary" : "text-foreground/70"}`}>
                  {day}
                </span>
                <span
                  className={`flex h-4 min-w-4 items-center justify-center px-1 text-[9px] font-black tabular-nums ${
                    count > 0 ? "text-emerald-300" : "text-transparent"
                  }`}
                  style={
                    count > 0 && maxCount > 0
                      ? { backgroundColor: `rgba(16,185,129,${0.12 + (count / maxCount) * 0.28})` }
                      : undefined
                  }
                >
                  {count > 0 ? count : "0"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Native-only search over this month's campaigns */}
        <div className="px-4">
          <div className="flex items-center gap-2 border border-border bg-card/50 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search campaign, sponsor, slot"
              aria-label="Search campaigns"
              className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Campaign timeline list */}
        {isLoading && ads.length === 0 ? (
          <div className="space-y-2 px-4 pt-3">
            <NativeSkeleton className="h-16 w-full" />
            <NativeSkeleton className="h-16 w-full" />
            <NativeSkeleton className="h-16 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState
              icon={Megaphone}
              title="No campaigns scheduled"
              description={
                rows.length === 0
                  ? "No dated campaigns overlap this month. Use the arrows to browse other months."
                  : "Nothing matches this search right now."
              }
            />
          </div>
        ) : (
          <div className="pt-1">
            {windowed.map(({ ad, color, sponsorName, barStart }) => (
              <CampaignRow
                key={ad.id}
                ad={ad}
                color={color}
                sponsorName={sponsorName}
                today={today}
                onClick={() => openDay(dateStrFor(view.year, view.month, barStart))}
              />
            ))}
            {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
          </div>
        )}

        {/* Sponsor legend */}
        {legend.length > 0 && (
          <div className="mt-3 border-t border-border/60 px-4 py-3">
            <p className="pb-2 text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60">Sponsor Legend</p>
            <div className="flex flex-wrap items-center gap-3">
              {legend.map(({ color, name }) => (
                <div key={`${color}-${name}`} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                  <span className="max-w-[140px] truncate text-[10px] font-mono text-muted-foreground">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}

/** ── DAY DETAIL (named export) — /admin/ads/calendar/:date ─────────────────── */
export function NativeCalendarDay() {
  const { date } = useParams();
  const navigate = useNavigate();
  const { data: ads = [], isLoading: adsLoading } = useAdConfig();
  const { data: sponsors = [], isLoading: sponsorsLoading } = useSponsors();
  const isLoading = adsLoading || sponsorsLoading;
  const today = todayStr();

  const dayAds = useMemo(() => adsActiveOnDate(ads, date), [ads, date]);

  return (
    <div className="pb-10">
      <NativeTopBar title={formatDayTitle(date)} fallback="/admin/ads/calendar" />
      <PullToRefresh queryKeys={CALENDAR_REFRESH_KEYS}>
        <div className="flex items-center gap-2 px-4 pt-3">
          <Calendar className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            {dayAds.length} active campaign{dayAds.length === 1 ? "" : "s"}
          </p>
        </div>

        {isLoading && ads.length === 0 ? (
          <div className="space-y-2 px-4 pt-3">
            <NativeSkeleton className="h-16 w-full" />
            <NativeSkeleton className="h-16 w-full" />
          </div>
        ) : dayAds.length === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState icon={Calendar} title="No campaigns on this day" description="Nothing was scheduled or active on this date." />
          </div>
        ) : (
          <div className="pt-2">
            {dayAds.map((ad) => (
              <CampaignRow
                key={ad.id}
                ad={ad}
                color={getAdColor(ad, sponsors)}
                sponsorName={getAdSponsorName(ad, sponsors)}
                today={today}
                onClick={() => {
                  emitHaptic("tab.select");
                  navigate("/admin/ads/calendar", { replace: true });
                }}
              />
            ))}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
