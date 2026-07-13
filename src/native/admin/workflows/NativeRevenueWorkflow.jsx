import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  DollarSign,
  TrendingUp,
  BarChart3,
  MousePointerClick,
  Layers,
  Trophy,
  Users,
  ChevronUp,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import PullToRefresh from "@/components/PullToRefresh";
import { emitHaptic } from "@/lib/native/haptic-events";
import { useWindowedList } from "@/hooks/use-windowed-list";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  REVENUE_LS,
  SPONSOR_COLUMNS,
  DEFAULT_SPONSOR_SORT,
  fmtCurrency,
  positionLabel,
  computeRevenueSummary,
  revenueBySponsor,
  revenueByPosition,
  sponsorPerformance,
  sortSponsors,
  nextSortState,
  filterSponsorPerformance,
  ctrTone,
  abTestAds,
  abTestSummary,
  sponsorAdBreakdown,
} from "./revenue-helpers.js";

/**
 * Native Ad Revenue workflow — a true native report (003G/003K pattern). Main
 * screen at /admin/ads/revenue, per-sponsor detail at /admin/ads/revenue/:sponsorId.
 *
 * Revenue is READ-ONLY. The web AdRevenueTracker is fed entirely from
 * localStorage by its admin wrapper (RevenueModule): ads from "rlt_ad_config",
 * sponsors from "rlt_sponsors", stats from "rlt_ad_stats". It writes NO
 * entities, calls NO edge functions, and dispatches NO admin audit-log events —
 * so neither does this workflow. There are no mutations to reach payload parity
 * on; parity here means reading the SAME three localStorage keys and computing
 * the SAME numbers (see revenue-helpers.js).
 *
 * localStorage isn't reactive, so — exactly like the native Sponsors workflow —
 * we layer native-only React Query caches whose queryFns read localStorage, and
 * PullToRefresh re-reads them. The sponsor slice reuses the ["sponsors"] key the
 * Sponsors workflow already introduced, so both surfaces share one cache over
 * "rlt_sponsors"; the ad-config and stats slices get their own native keys (no
 * pre-existing query key exists to reuse — the web never wired these through
 * React Query).
 *
 * NOT carried over (honest gap): the web report's "Generate Report" button
 * builds a CSV Blob and triggers a browser file download. A WKWebView has no
 * disk-download affordance and the shell's share helpers move URLs/text, not
 * files, so faithfully reproducing that flow isn't possible without inventing a
 * new mechanism. The per-sponsor figures the CSV would contain are surfaced on
 * the sponsor detail screen instead.
 */

const AD_CONFIG_KEY = ["adConfig"];
const AD_STATS_KEY = ["adStats"];
const SPONSORS_KEY = ["sponsors"];
const REVENUE_QUERY_KEYS = [AD_CONFIG_KEY, SPONSORS_KEY, AD_STATS_KEY];

function readLS(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

const useAdConfig = () =>
  useQuery({ queryKey: AD_CONFIG_KEY, queryFn: () => readLS(REVENUE_LS.ads, []), staleTime: 0 });
const useSponsors = () =>
  useQuery({ queryKey: SPONSORS_KEY, queryFn: () => readLS(REVENUE_LS.sponsors, []), staleTime: 0 });
const useAdStats = () =>
  useQuery({ queryKey: AD_STATS_KEY, queryFn: () => readLS(REVENUE_LS.stats, {}), staleTime: 0 });

/** Reads all three revenue sources at once (each its own cache). */
function useRevenueData() {
  const adsQ = useAdConfig();
  const sponsorsQ = useSponsors();
  const statsQ = useAdStats();
  return {
    ads: adsQ.data || [],
    sponsors: sponsorsQ.data || [],
    stats: statsQ.data || {},
    isLoading: adsQ.isLoading || sponsorsQ.isLoading || statsQ.isLoading,
  };
}

/* ── UI atoms ─────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="border border-border/60 bg-card/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      </div>
      <p className="pt-1.5 font-display text-2xl tabular-nums leading-none text-foreground">{value}</p>
    </div>
  );
}

/** Horizontal proportion bar — the native stand-in for the web revenue charts. */
function BarRow({ label, value, max, tone = "bg-primary/70" }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="grid gap-1 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold">{label}</span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-accent">{fmtCurrency(value)}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden border border-border/30 bg-muted/20">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} aria-hidden="true" />
      </div>
    </div>
  );
}

function CtrBadge({ ctr }) {
  const Icon = ctr >= 2 ? ArrowUpRight : ctr >= 0.5 ? Minus : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-bold font-mono tabular-nums ${ctrTone(ctr)}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {ctr.toFixed(2)}%
    </span>
  );
}

/* ── Main report screen — /admin/ads/revenue ───────────────────────────── */

export default function NativeRevenueList() {
  const navigate = useNavigate();
  const { ads, sponsors, stats, isLoading } = useRevenueData();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(DEFAULT_SPONSOR_SORT);

  const summary = useMemo(() => computeRevenueSummary(ads, stats), [ads, stats]);
  const bySponsor = useMemo(() => revenueBySponsor(ads, sponsors), [ads, sponsors]);
  const byPosition = useMemo(() => revenueByPosition(ads), [ads]);
  const perf = useMemo(() => sponsorPerformance(ads, sponsors, stats), [ads, sponsors, stats]);
  const abAds = useMemo(() => abTestAds(ads), [ads]);

  const filtered = useMemo(() => filterSponsorPerformance(perf, query), [perf, query]);
  const sorted = useMemo(() => sortSponsors(filtered, sort), [filtered, sort]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(sorted, {
    initial: 20,
    step: 20,
    restoreKey: "admin-revenue",
  });

  const sponsorMax = bySponsor.length ? bySponsor[0].revenue : 0;
  const positionMax = byPosition.reduce((m, p) => Math.max(m, p.revenue), 0);
  const hasData = ads.length > 0;

  const toggleSort = (col) => {
    emitHaptic("tab.select");
    setSort((prev) => nextSortState(prev, col));
  };

  const openSponsor = (id) => {
    emitHaptic("tab.select");
    navigate(`/admin/ads/revenue/${encodeURIComponent(id)}`);
  };

  return (
    <div className="pb-10">
      <NativeTopBar title="Ad Revenue" fallback="/admin/ads" />
      <PullToRefresh queryKeys={REVENUE_QUERY_KEYS}>
        {isLoading && !hasData ? (
          <div className="grid grid-cols-2 gap-2 px-4 pt-3">
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
          </div>
        ) : !hasData ? (
          <div className="px-4 pt-4">
            <NativeEmptyState
              icon={DollarSign}
              title="No revenue data"
              description="Ad slots and sponsors will appear here once ads are configured."
            />
          </div>
        ) : (
          <div className="px-4 pt-3">
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={DollarSign} label="Total Monthly" value={fmtCurrency(summary.totalMonthlyRevenue)} />
              <StatCard icon={TrendingUp} label="Projected Annual" value={fmtCurrency(summary.projectedAnnual)} />
              <StatCard icon={BarChart3} label="Avg / Slot" value={fmtCurrency(summary.avgRevenuePerSlot)} />
              <StatCard icon={MousePointerClick} label="CPM (est.)" value={fmtCurrency(summary.cpmRevenue)} />
            </div>
            <div className="pt-2">
              <StatCard icon={Layers} label="Active Ad Slots" value={summary.activeSlots.toLocaleString()} />
            </div>

            {/* Revenue by sponsor */}
            {bySponsor.length > 0 && (
              <section className="pt-5">
                <h2 className="pb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Revenue by Sponsor</h2>
                <div className="border border-border/60 bg-card/50 px-3 py-1.5">
                  {bySponsor.map((row) => (
                    <BarRow key={row.id} label={row.name} value={row.revenue} max={sponsorMax} tone="bg-accent/70" />
                  ))}
                </div>
              </section>
            )}

            {/* Revenue by position */}
            <section className="pt-5">
              <h2 className="pb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Revenue by Position</h2>
              <div className="border border-border/60 bg-card/50 px-3 py-1.5">
                {byPosition.map((row) => (
                  <BarRow key={row.key} label={row.position} value={row.revenue} max={positionMax} tone="bg-primary/70" />
                ))}
              </div>
            </section>

            {/* Sponsor performance list */}
            <section className="pt-5">
              <div className="flex items-center justify-between pb-1">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Sponsor Performance</h2>
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                  {sorted.length} sponsor{sorted.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="flex items-center gap-2 border border-border bg-card/50 px-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search sponsor, tier"
                  aria-label="Search sponsors"
                  className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </div>

              {/* Sort chips (mirror the web's sortable columns) */}
              <div className="ios-scroll flex gap-2 overflow-x-auto py-2">
                {SPONSOR_COLUMNS.map((c) => {
                  const active = sort.col === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleSort(c.key)}
                      className={`ios-pressable inline-flex min-h-9 shrink-0 items-center gap-1 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                        active ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
                      }`}
                    >
                      {c.label}
                      {active && (sort.dir === "asc" ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />)}
                    </button>
                  );
                })}
              </div>

              {sorted.length === 0 ? (
                <NativeEmptyState icon={Users} title="No sponsors" description="Nothing matches this search." />
              ) : (
                <div className="border-t border-border/40">
                  {windowed.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => openSponsor(row.id)}
                      className="ios-pressable flex w-full items-center gap-3 border-b border-border/40 px-1 py-3 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold">{row.name}</span>
                          {row.tier !== "default" && (
                            <span className="shrink-0 border border-border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                              {row.tier}
                            </span>
                          )}
                        </span>
                        <span className="flex flex-wrap items-center gap-2 pt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                          <span>{row.adCount} ad{row.adCount === 1 ? "" : "s"}</span>
                          <span>· {row.impressions.toLocaleString()} imp</span>
                          <span>· {row.clicks.toLocaleString()} clk</span>
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-mono text-sm font-bold tabular-nums text-accent">{fmtCurrency(row.revenue)}</span>
                        <CtrBadge ctr={row.ctr} />
                      </span>
                    </button>
                  ))}
                  {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
                </div>
              )}
            </section>

            {/* A/B test results */}
            <section className="pt-5">
              <h2 className="pb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">A/B Test Results</h2>
              {abAds.length === 0 ? (
                <NativeEmptyState
                  icon={BarChart3}
                  title="No A/B tests running"
                  description="Ads with two or more ab_variants appear here."
                />
              ) : (
                <div className="grid gap-3">
                  {abAds.map((ad) => {
                    const t = abTestSummary(ad);
                    return (
                      <div key={ad.id} className="border border-border/60 bg-card/50">
                        <div className="flex items-center justify-between gap-2 border-b border-border/30 px-3 py-2">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold">{ad.title || "Untitled"}</span>
                            <span className="block text-[9px] uppercase tracking-widest text-muted-foreground">{positionLabel(ad.position)}</span>
                          </span>
                          {t.winner && (
                            <span className="inline-flex shrink-0 items-center gap-1 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-300">
                              <Trophy className="h-3 w-3" aria-hidden="true" /> {t.winner} wins
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-px bg-border/30">
                          {[
                            { key: "A", ctr: t.aCtr, imps: t.aImps, clicks: t.aClicks },
                            { key: "B", ctr: t.bCtr, imps: t.bImps, clicks: t.bClicks },
                          ].map((v) => (
                            <div key={v.key} className="bg-card/50 p-3">
                              <p className={`text-[9px] font-black uppercase tracking-widest ${t.winner === v.key ? "text-amber-300" : "text-muted-foreground"}`}>
                                Variant {v.key}
                              </p>
                              <p className="pt-1 font-display text-lg tabular-nums">{v.ctr.toFixed(2)}%</p>
                              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                                {v.imps.toLocaleString()} imp · {v.clicks.toLocaleString()} clk
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}

/* ── Per-sponsor detail — /admin/ads/revenue/:sponsorId ─────────────────── */

export function NativeRevenueSponsorDetail() {
  const { sponsorId } = useParams();
  const { ads, sponsors, stats, isLoading } = useRevenueData();

  const perfRow = useMemo(
    () => sponsorPerformance(ads, sponsors, stats).find((r) => String(r.id) === String(sponsorId)) || null,
    [ads, sponsors, stats, sponsorId]
  );
  const breakdown = useMemo(() => sponsorAdBreakdown(ads, stats, sponsorId), [ads, stats, sponsorId]);

  if (isLoading && !perfRow) {
    return (
      <div>
        <NativeTopBar title="Sponsor" fallback="/admin/ads/revenue" />
        <div className="space-y-2 px-4 pt-4">
          <NativeSkeleton className="h-24 w-full" />
          <NativeSkeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!perfRow) {
    return (
      <div>
        <NativeTopBar title="Sponsor" fallback="/admin/ads/revenue" />
        <div className="px-4 pt-6">
          <NativeEmptyState icon={Users} title="Sponsor not found" description="This sponsor has no ads in the current report." />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <NativeTopBar title={perfRow.name} fallback="/admin/ads/revenue" />
      <div className="space-y-4 px-4 pt-3">
        <div className="border border-border/60 bg-card/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg font-bold uppercase tracking-wide">{perfRow.name}</h1>
              {perfRow.tier !== "default" && (
                <span className="border border-border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-muted-foreground">{perfRow.tier}</span>
              )}
            </div>
            <CtrBadge ctr={perfRow.ctr} />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-3">
            <StatCard icon={DollarSign} label="Monthly Revenue" value={fmtCurrency(perfRow.revenue)} />
            <StatCard icon={Layers} label="Ad Slots" value={perfRow.adCount.toLocaleString()} />
            <StatCard icon={BarChart3} label="Impressions" value={perfRow.impressions.toLocaleString()} />
            <StatCard icon={MousePointerClick} label="Clicks" value={perfRow.clicks.toLocaleString()} />
          </div>
        </div>

        <section>
          <h2 className="pb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Ad breakdown</h2>
          {breakdown.length === 0 ? (
            <NativeEmptyState icon={BarChart3} title="No ads" description="This sponsor has no ad slots." />
          ) : (
            <div className="border border-border/60 bg-card/50">
              {breakdown.map((ad) => (
                <div key={ad.id} className={`border-b border-border/30 px-3 py-3 last:border-0 ${ad.isActive ? "" : "opacity-60"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{ad.title}</span>
                      <span className="block text-[9px] uppercase tracking-widest text-muted-foreground">
                        {ad.position} · {ad.deviceTarget}{ad.isActive ? "" : " · paused"}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-accent">{fmtCurrency(ad.monthlyRevenue)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    <span>{ad.impressions.toLocaleString()} imp</span>
                    <span>· {ad.clicks.toLocaleString()} clk</span>
                    <CtrBadge ctr={ad.ctr} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
