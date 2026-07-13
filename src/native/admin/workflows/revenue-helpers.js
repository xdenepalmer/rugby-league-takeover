/**
 * Pure logic for the native Ad Revenue workflow. Mirrors the web
 * AdRevenueTracker (src/components/admin/AdRevenueTracker.jsx) exactly — the
 * ad-slot positions, the currency formatter, the durable-vs-cached stat
 * resolution, the CTR math, and every revenue/performance aggregation — so the
 * native report shows the SAME numbers the web report shows from the SAME
 * source data.
 *
 * Revenue is a READ-ONLY module. The web AdRevenueTracker is fed entirely from
 * localStorage by its admin wrapper (RevenueModule in admin-modules.jsx):
 *   • ads     ← localStorage "rlt_ad_config"
 *   • sponsors← localStorage "rlt_sponsors"
 *   • stats   ← localStorage "rlt_ad_stats"
 * It performs NO entity writes, NO edge-function calls, and dispatches NO
 * rlt_admin_log events — it only reads and renders (plus a client-side CSV
 * download; see the native workflow header for why that isn't carried over).
 * These helpers therefore contain no payload builders: there is nothing to
 * write. The field access below is intentionally byte-identical to the web
 * (e.g. sponsor display name reads `company || name || id`, matching the web's
 * quirk that the rlt_sponsors store actually keys company under company_name)
 * so the native and web reports never disagree.
 */

/** localStorage keys the web RevenueModule wrapper reads (source of truth). */
export const REVENUE_LS = {
  ads: "rlt_ad_config",
  sponsors: "rlt_sponsors",
  stats: "rlt_ad_stats",
};

/**
 * Ad-slot positions — identical keys/labels and ORDER to AdRevenueTracker.POSITIONS.
 * Order matters: the web renders position revenue in exactly this sequence.
 */
export const POSITIONS = [
  { key: "banner-top", label: "Banner Top" },
  { key: "banner-bottom", label: "Banner Bottom" },
  { key: "sidebar", label: "Sidebar" },
  { key: "in-feed", label: "In-Feed" },
  { key: "footer", label: "Footer" },
];

/** Human label for a position slug (falls back to the raw slug, web parity). */
export function positionLabel(position) {
  return POSITIONS.find((p) => p.key === position)?.label || position;
}

/** Currency format — byte-identical to AdRevenueTracker.fmtCurrency. */
export function fmtCurrency(n) {
  return "$" + Number(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Resolve an ad's impressions/clicks exactly as AdRevenueTracker.getAdStats:
 * prefer the durable server-aggregated counts (impression_count / click_count),
 * fall back to the per-browser localStorage cache keyed `${position}__${id}`.
 */
export function getAdStats(stats, ad) {
  const key = `${ad.position}__${ad.id}`;
  const cached = stats?.[key] || {};
  return {
    impressions: Number(ad?.impression_count ?? cached.impressions ?? 0),
    clicks: Number(ad?.click_count ?? cached.clicks ?? 0),
  };
}

/** Click-through rate as a percentage — identical to AdRevenueTracker.calcCtr. */
export function calcCtr(impressions, clicks) {
  return impressions > 0 ? ((clicks / impressions) * 100) : 0;
}

/** Active ads — web parity: an ad counts as active unless is_active === false. */
export function activeAds(ads = []) {
  return (ads || []).filter((a) => a.is_active !== false);
}

/**
 * KPI summary — the five headline numbers the web dashboard shows, computed the
 * same way: total monthly revenue (active ads), projected annual (×12), average
 * revenue per active slot, estimated CPM revenue over ALL ads with a cpm_rate,
 * and the active slot count.
 */
export function computeRevenueSummary(ads = [], stats = {}) {
  const active = activeAds(ads);
  const totalMonthlyRevenue = active.reduce((sum, ad) => sum + Number(ad.price_per_month || 0), 0);
  const cpmRevenue = (ads || []).reduce((sum, ad) => {
    if (!ad.cpm_rate) return sum;
    const st = getAdStats(stats, ad);
    return sum + ((st.impressions / 1000) * Number(ad.cpm_rate));
  }, 0);
  return {
    totalMonthlyRevenue,
    projectedAnnual: totalMonthlyRevenue * 12,
    avgRevenuePerSlot: active.length > 0 ? totalMonthlyRevenue / active.length : 0,
    cpmRevenue,
    activeSlots: active.length,
  };
}

/**
 * Revenue grouped by sponsor (ALL ads, active or not — web parity), sorted
 * high→low. Unassigned ads roll up under a single "Unassigned" bucket. Sponsor
 * display name reads `company || name || id`, identical to the web.
 */
export function revenueBySponsor(ads = [], sponsors = []) {
  const map = {};
  for (const ad of ads || []) {
    const sid = ad.sponsor_id || "unassigned";
    if (!map[sid]) map[sid] = { revenue: 0, name: "Unassigned" };
    map[sid].revenue += Number(ad.price_per_month || 0);
  }
  for (const sp of sponsors || []) {
    if (map[sp.id]) map[sp.id].name = sp.company || sp.name || sp.id;
  }
  return Object.entries(map)
    .map(([id, data]) => ({ id, name: data.name, revenue: Math.round(data.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue);
}

/**
 * Revenue per placement position (ACTIVE ads only — web parity), in the fixed
 * POSITIONS order. Rounded to cents like the web chart data.
 */
export function revenueByPosition(ads = []) {
  const active = activeAds(ads);
  const map = {};
  POSITIONS.forEach((p) => { map[p.key] = 0; });
  for (const ad of active) {
    if (map[ad.position] !== undefined) map[ad.position] += Number(ad.price_per_month || 0);
  }
  return POSITIONS.map((p) => ({
    key: p.key,
    position: p.label,
    revenue: Math.round(map[p.key] * 100) / 100,
  }));
}

/**
 * Per-sponsor performance rows (ALL ads) with summed impressions/clicks/revenue,
 * ad count, and derived CTR — mirrors AdRevenueTracker.sponsorPerformance. Tier
 * defaults to "default" and name to "Unassigned", exactly like the web.
 */
export function sponsorPerformance(ads = [], sponsors = [], stats = {}) {
  const map = {};
  for (const ad of ads || []) {
    const sid = ad.sponsor_id || "unassigned";
    if (!map[sid]) {
      const sp = (sponsors || []).find((s) => s.id === sid);
      map[sid] = {
        id: sid,
        name: sp?.company || sp?.name || "Unassigned",
        tier: sp?.tier || "default",
        impressions: 0,
        clicks: 0,
        revenue: 0,
        adCount: 0,
      };
    }
    const st = getAdStats(stats, ad);
    map[sid].impressions += st.impressions || 0;
    map[sid].clicks += st.clicks || 0;
    map[sid].revenue += Number(ad.price_per_month || 0);
    map[sid].adCount += 1;
  }
  return Object.values(map).map((row) => ({ ...row, ctr: calcCtr(row.impressions, row.clicks) }));
}

/** Sortable columns for the sponsor performance list (same set the web renders). */
export const SPONSOR_COLUMNS = [
  { key: "name", label: "Sponsor" },
  { key: "adCount", label: "Ads" },
  { key: "impressions", label: "Impressions" },
  { key: "clicks", label: "Clicks" },
  { key: "ctr", label: "CTR" },
  { key: "revenue", label: "Revenue" },
];

/** Default sort — matches the web initial state (revenue, descending). */
export const DEFAULT_SPONSOR_SORT = { col: "revenue", dir: "desc" };

/**
 * Next sort state on a header tap — identical to AdRevenueTracker.handleSort:
 * tapping the active column flips direction; a new column resets to descending.
 */
export function nextSortState({ col: curCol, dir } = DEFAULT_SPONSOR_SORT, col) {
  if (curCol === col) return { col, dir: dir === "asc" ? "desc" : "asc" };
  return { col, dir: "desc" };
}

/**
 * Sort sponsor rows — byte-identical comparator to the web (numeric subtraction
 * on the chosen column, missing values as 0). Non-immutable input is preserved
 * (works on a copy).
 */
export function sortSponsors(rows, { col = "revenue", dir = "desc" } = DEFAULT_SPONSOR_SORT) {
  const copy = [...(rows || [])];
  copy.sort((a, b) => {
    const aVal = a[col] ?? 0;
    const bVal = b[col] ?? 0;
    return dir === "asc" ? aVal - bVal : bVal - aVal;
  });
  return copy;
}

/**
 * Native-only read-only search over the sponsor performance rows. The web
 * report has no search box (it sorts), so this is a pure client-side filter
 * with NO write impact — it never changes which records exist or what is
 * written, only what is displayed. Matches sponsor name and tier.
 */
export function filterSponsorPerformance(rows, query = "") {
  const q = query.trim().toLowerCase();
  if (!q) return rows || [];
  return (rows || []).filter((r) =>
    [r.name, r.tier].map((v) => String(v || "").toLowerCase()).some((v) => v.includes(q))
  );
}

/** CTR tone in the native badge token language (label carries the meaning). */
export function ctrTone(ctr) {
  if (ctr >= 2) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (ctr >= 0.5) return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  return "border-red-500/40 bg-red-500/10 text-red-300";
}

/** Ads with a runnable A/B test — web parity: at least two variants present. */
export function abTestAds(ads = []) {
  return (ads || []).filter((ad) => ad.ab_variants && ad.ab_variants.length >= 2);
}

/**
 * Variant-A-vs-B summary for one A/B ad — mirrors the web comparison block:
 * the first two variants, their impressions/clicks/CTR, the CTR winner (ties
 * → no winner), and the max impressions for bar scaling.
 */
export function abTestSummary(ad) {
  const [a, b] = (ad?.ab_variants || []).slice(0, 2);
  const aImps = a?.impressions || 0;
  const aClicks = a?.clicks || 0;
  const aCtr = calcCtr(aImps, aClicks);
  const bImps = b?.impressions || 0;
  const bClicks = b?.clicks || 0;
  const bCtr = calcCtr(bImps, bClicks);
  const winner = aCtr > bCtr ? "A" : bCtr > aCtr ? "B" : null;
  return { a, b, aImps, aClicks, aCtr, bImps, bClicks, bCtr, winner, maxImps: Math.max(aImps, bImps, 1) };
}

/**
 * Per-ad breakdown for a single sponsor bucket (the native sponsor detail
 * screen). Same per-ad figures the web CSV report would list for that sponsor:
 * title, position label, impressions, clicks, CTR, monthly revenue, device
 * target. "unassigned" collects ads with no sponsor_id (web parity).
 */
export function sponsorAdBreakdown(ads = [], stats = {}, sponsorId) {
  return (ads || [])
    .filter((ad) => (ad.sponsor_id || "unassigned") === sponsorId)
    .map((ad) => {
      const st = getAdStats(stats, ad);
      return {
        id: ad.id,
        title: ad.title || "Untitled",
        position: positionLabel(ad.position),
        impressions: st.impressions,
        clicks: st.clicks,
        ctr: calcCtr(st.impressions, st.clicks),
        monthlyRevenue: Number(ad.price_per_month || 0),
        deviceTarget: ad.device_target || "all",
        isActive: ad.is_active !== false,
      };
    });
}
