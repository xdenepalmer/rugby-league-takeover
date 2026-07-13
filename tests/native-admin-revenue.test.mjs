import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REVENUE_LS,
  POSITIONS,
  SPONSOR_COLUMNS,
  DEFAULT_SPONSOR_SORT,
  positionLabel,
  fmtCurrency,
  getAdStats,
  calcCtr,
  activeAds,
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
} from "../src/native/admin/workflows/revenue-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const WEB = read("../src/components/admin/AdRevenueTracker.jsx");
const NATIVE = read("../src/native/admin/workflows/NativeRevenueWorkflow.jsx");
const HELPERS = read("../src/native/admin/workflows/revenue-helpers.js");

// ── Source-of-truth keys mirror the web wrapper exactly ──────────────────
test("revenue reads the same three localStorage keys the web wrapper feeds", () => {
  assert.deepEqual(REVENUE_LS, { ads: "rlt_ad_config", sponsors: "rlt_sponsors", stats: "rlt_ad_stats" });
  const wrapper = read("../src/native/admin/admin-modules.jsx");
  // The web RevenueModule wrapper reads these three keys and passes them as props.
  assert.ok(wrapper.includes('readLS("rlt_ad_config"'), "wrapper feeds ads from rlt_ad_config");
  assert.ok(wrapper.includes('readLS("rlt_sponsors"'), "wrapper feeds sponsors from rlt_sponsors");
  assert.ok(wrapper.includes('readLS("rlt_ad_stats"'), "wrapper feeds stats from rlt_ad_stats");
  // Native reads the identical keys.
  for (const key of Object.values(REVENUE_LS)) {
    assert.ok(NATIVE.includes(`"${key}"`) || HELPERS.includes(`"${key}"`), `native reads ${key}`);
  }
});

test("positions match the web POSITIONS keys, labels and order", () => {
  assert.deepEqual(POSITIONS, [
    { key: "banner-top", label: "Banner Top" },
    { key: "banner-bottom", label: "Banner Bottom" },
    { key: "sidebar", label: "Sidebar" },
    { key: "in-feed", label: "In-Feed" },
    { key: "footer", label: "Footer" },
  ]);
  // Every position key/label must exist in the web source.
  for (const p of POSITIONS) {
    assert.ok(WEB.includes(`"${p.key}"`), `web has position key ${p.key}`);
    assert.ok(WEB.includes(`"${p.label}"`), `web has position label ${p.label}`);
  }
  assert.equal(positionLabel("footer"), "Footer");
  assert.equal(positionLabel("mystery"), "mystery", "unknown position falls back to the raw slug (web parity)");
});

// ── Currency + stat resolution parity ────────────────────────────────────
test("currency formatting is byte-identical to the web fmtCurrency", () => {
  assert.equal(fmtCurrency(0), "$0.00");
  assert.equal(fmtCurrency(1234.5), "$1,234.50");
  assert.equal(fmtCurrency(null), "$0.00");
  assert.equal(fmtCurrency(undefined), "$0.00");
});

test("getAdStats prefers durable server counts, falls back to the localStorage cache", () => {
  const stats = { "footer__a1": { impressions: 100, clicks: 4 } };
  // Cache used when the ad has no server counts.
  assert.deepEqual(getAdStats(stats, { id: "a1", position: "footer" }), { impressions: 100, clicks: 4 });
  // Durable server counts win over the cache.
  assert.deepEqual(
    getAdStats(stats, { id: "a1", position: "footer", impression_count: 500, click_count: 25 }),
    { impressions: 500, clicks: 25 }
  );
  // Missing everywhere → zeros.
  assert.deepEqual(getAdStats({}, { id: "x", position: "sidebar" }), { impressions: 0, clicks: 0 });
  // Zero server count is honoured (not treated as absent — web uses ??).
  assert.deepEqual(
    getAdStats(stats, { id: "a1", position: "footer", impression_count: 0, click_count: 0 }),
    { impressions: 0, clicks: 0 }
  );
});

test("CTR math matches the web (percentage, guarded against divide-by-zero)", () => {
  assert.equal(calcCtr(0, 0), 0);
  assert.equal(calcCtr(100, 2), 2);
  assert.equal(calcCtr(1000, 5), 0.5);
});

test("activeAds keeps everything except is_active === false (web parity)", () => {
  const ads = [{ id: "1" }, { id: "2", is_active: true }, { id: "3", is_active: false }];
  assert.deepEqual(activeAds(ads).map((a) => a.id), ["1", "2"]);
});

// ── KPI summary parity ───────────────────────────────────────────────────
test("revenue summary mirrors the web dashboard computations", () => {
  const ads = [
    { id: "1", position: "footer", price_per_month: 100, is_active: true },
    { id: "2", position: "sidebar", price_per_month: 50 }, // active (undefined)
    { id: "3", position: "footer", price_per_month: 999, is_active: false }, // excluded from monthly
    { id: "4", position: "banner-top", price_per_month: 0, cpm_rate: 5, impression_count: 2000 },
  ];
  const s = computeRevenueSummary(ads, {});
  assert.equal(s.totalMonthlyRevenue, 150, "only active ads count toward monthly");
  assert.equal(s.projectedAnnual, 1800, "annual is monthly × 12");
  assert.equal(s.activeSlots, 3, "three active slots (ids 1,2,4)");
  assert.equal(s.avgRevenuePerSlot, 50, "150 / 3 active slots");
  assert.equal(s.cpmRevenue, 10, "(2000/1000) × $5 CPM = $10");
  assert.equal(computeRevenueSummary([], {}).avgRevenuePerSlot, 0, "no slots → no divide-by-zero");
});

// ── Grouping parity ──────────────────────────────────────────────────────
test("revenue by sponsor rolls up all ads, sorts high→low, uses web name fallback", () => {
  const ads = [
    { id: "1", sponsor_id: "s1", price_per_month: 100 },
    { id: "2", sponsor_id: "s1", price_per_month: 50 },
    { id: "3", sponsor_id: "s2", price_per_month: 200 },
    { id: "4", price_per_month: 25 }, // unassigned
  ];
  const sponsors = [{ id: "s1", company: "Acme" }, { id: "s2", name: "Globex" }];
  const rows = revenueBySponsor(ads, sponsors);
  assert.deepEqual(rows.map((r) => [r.name, r.revenue]), [
    ["Globex", 200],
    ["Acme", 150],
    ["Unassigned", 25],
  ]);
});

test("revenue by position uses active ads only in the fixed position order", () => {
  const ads = [
    { id: "1", position: "footer", price_per_month: 100, is_active: true },
    { id: "2", position: "footer", price_per_month: 900, is_active: false }, // excluded
    { id: "3", position: "sidebar", price_per_month: 40 },
    { id: "4", position: "unknown-slot", price_per_month: 10 }, // dropped (not a known position)
  ];
  const rows = revenueByPosition(ads);
  assert.deepEqual(rows.map((r) => r.key), ["banner-top", "banner-bottom", "sidebar", "in-feed", "footer"]);
  assert.equal(rows.find((r) => r.key === "footer").revenue, 100);
  assert.equal(rows.find((r) => r.key === "sidebar").revenue, 40);
  assert.equal(rows.find((r) => r.key === "banner-top").revenue, 0);
});

// ── Sponsor performance + sort parity ────────────────────────────────────
test("sponsor performance sums impressions/clicks/revenue and derives CTR", () => {
  const ads = [
    { id: "a1", sponsor_id: "s1", position: "footer", price_per_month: 100 },
    { id: "a2", sponsor_id: "s1", position: "sidebar", price_per_month: 50 },
  ];
  const stats = {
    "footer__a1": { impressions: 1000, clicks: 30 },
    "sidebar__a2": { impressions: 1000, clicks: 10 },
  };
  const rows = sponsorPerformance(ads, [{ id: "s1", company: "Acme", tier: "gold" }], stats);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Acme");
  assert.equal(rows[0].tier, "gold");
  assert.equal(rows[0].adCount, 2);
  assert.equal(rows[0].impressions, 2000);
  assert.equal(rows[0].clicks, 40);
  assert.equal(rows[0].revenue, 150);
  assert.equal(rows[0].ctr, 2, "(40/2000)×100 = 2%");
  // Unknown sponsor → Unassigned / default tier (web parity).
  const orphan = sponsorPerformance([{ id: "x", price_per_month: 5 }], [], {});
  assert.equal(orphan[0].name, "Unassigned");
  assert.equal(orphan[0].tier, "default");
});

test("sort state + comparator mirror the web handleSort (toggle dir, new col → desc)", () => {
  assert.deepEqual(DEFAULT_SPONSOR_SORT, { col: "revenue", dir: "desc" });
  assert.deepEqual(SPONSOR_COLUMNS.map((c) => c.key), ["name", "adCount", "impressions", "clicks", "ctr", "revenue"]);
  // Tapping the active column flips direction.
  assert.deepEqual(nextSortState({ col: "revenue", dir: "desc" }, "revenue"), { col: "revenue", dir: "asc" });
  assert.deepEqual(nextSortState({ col: "revenue", dir: "asc" }, "revenue"), { col: "revenue", dir: "desc" });
  // A new column resets to descending.
  assert.deepEqual(nextSortState({ col: "revenue", dir: "asc" }, "ctr"), { col: "ctr", dir: "desc" });

  const rows = [
    { id: "1", revenue: 10, ctr: 5 },
    { id: "2", revenue: 30, ctr: 1 },
    { id: "3", revenue: 20, ctr: 3 },
  ];
  assert.deepEqual(sortSponsors(rows, { col: "revenue", dir: "desc" }).map((r) => r.id), ["2", "3", "1"]);
  assert.deepEqual(sortSponsors(rows, { col: "revenue", dir: "asc" }).map((r) => r.id), ["1", "3", "2"]);
  assert.deepEqual(sortSponsors(rows, { col: "ctr", dir: "desc" }).map((r) => r.id), ["1", "3", "2"]);
  // Source array is not mutated.
  assert.deepEqual(rows.map((r) => r.id), ["1", "2", "3"], "sort works on a copy");
});

test("native-only sponsor search is a pure read filter (no write impact)", () => {
  const rows = [
    { id: "s1", name: "Acme", tier: "gold" },
    { id: "s2", name: "Globex", tier: "silver" },
  ];
  assert.deepEqual(filterSponsorPerformance(rows, "acme").map((r) => r.id), ["s1"]);
  assert.deepEqual(filterSponsorPerformance(rows, "silver").map((r) => r.id), ["s2"], "tier is searchable");
  assert.equal(filterSponsorPerformance(rows, "").length, 2, "empty query returns everything");
});

test("ctrTone tiers match the web thresholds (≥2 good, ≥0.5 warn, else bad)", () => {
  assert.match(ctrTone(3), /emerald/);
  assert.match(ctrTone(1), /amber/);
  assert.match(ctrTone(0.1), /red/);
});

// ── A/B parity ───────────────────────────────────────────────────────────
test("A/B ads require ≥2 variants; summary picks the CTR winner (ties → none)", () => {
  const ads = [
    { id: "1", ab_variants: [{ impressions: 100, clicks: 5 }] }, // 1 variant → excluded
    { id: "2", ab_variants: [{ impressions: 1000, clicks: 50 }, { impressions: 1000, clicks: 10 }] },
    { id: "3", ab_variants: [{ impressions: 100, clicks: 2 }, { impressions: 100, clicks: 2 }] }, // tie
  ];
  assert.deepEqual(abTestAds(ads).map((a) => a.id), ["2", "3"]);
  const t2 = abTestSummary(ads[1]);
  assert.equal(t2.aCtr, 5);
  assert.equal(t2.bCtr, 1);
  assert.equal(t2.winner, "A");
  assert.equal(t2.maxImps, 1000);
  assert.equal(abTestSummary(ads[2]).winner, null, "equal CTR → no winner");
});

// ── Sponsor detail breakdown ─────────────────────────────────────────────
test("sponsorAdBreakdown lists a sponsor's ads with the web's per-ad figures", () => {
  const ads = [
    { id: "a1", sponsor_id: "s1", position: "footer", price_per_month: 100, device_target: "mobile", is_active: true },
    { id: "a2", sponsor_id: "s2", position: "sidebar", price_per_month: 50 },
    { id: "a3", position: "footer", price_per_month: 20, is_active: false }, // unassigned
  ];
  const stats = { "footer__a1": { impressions: 500, clicks: 25 } };
  const s1 = sponsorAdBreakdown(ads, stats, "s1");
  assert.equal(s1.length, 1);
  assert.deepEqual(
    { title: s1[0].title, position: s1[0].position, impressions: s1[0].impressions, clicks: s1[0].clicks, ctr: s1[0].ctr, monthlyRevenue: s1[0].monthlyRevenue, deviceTarget: s1[0].deviceTarget, isActive: s1[0].isActive },
    { title: "Untitled", position: "Footer", impressions: 500, clicks: 25, ctr: 5, monthlyRevenue: 100, deviceTarget: "mobile", isActive: true }
  );
  // Unassigned ads collect under the "unassigned" bucket (web parity).
  assert.deepEqual(sponsorAdBreakdown(ads, stats, "unassigned").map((a) => a.id), ["a3"]);
  assert.equal(sponsorAdBreakdown(ads, stats, "unassigned")[0].isActive, false);
});

// ── Read-only + safety source contracts ──────────────────────────────────
test("revenue is strictly read-only: no entity writes, no edge fns, no mutations", () => {
  // Neither the workflow nor the helpers write anything back.
  assert.ok(!NATIVE.includes("base44.entities"), "no entity access at all (revenue reads localStorage only)");
  assert.ok(!NATIVE.includes("functions.invoke"), "no edge-function calls (web parity)");
  assert.ok(!NATIVE.includes("useMutation"), "no mutations — nothing is written");
  assert.ok(!NATIVE.includes("localStorage.setItem"), "revenue never writes localStorage");
  assert.ok(!HELPERS.includes("localStorage.setItem"), "helpers never write localStorage");
  // The web report is read-only too: it performs no entity/localStorage writes.
  assert.ok(!WEB.includes(".create(") && !WEB.includes(".update(") && !WEB.includes(".delete("), "web report writes no entities");
  assert.ok(!WEB.includes("localStorage.setItem"), "web report writes no localStorage");
});

test("no invented audit events: the web report dispatches none, so neither does native", () => {
  assert.ok(!WEB.includes("rlt_admin_log") && !WEB.includes("emitAdminLog"), "web report emits no audit events");
  assert.ok(!NATIVE.includes("emitAdminLog") && !NATIVE.includes("rlt_admin_log") && !NATIVE.includes("dispatchEvent"), "native matches the empty event set");
});

test("cache keys: reuses the shared ['sponsors'] key, adds native localStorage caches", () => {
  assert.ok(NATIVE.includes('["sponsors"]'), "sponsor slice reuses the Sponsors workflow cache key");
  assert.ok(NATIVE.includes('["adConfig"]') && NATIVE.includes('["adStats"]'), "ad-config and stats get native cache keys");
  // PullToRefresh must re-read every source.
  assert.ok(NATIVE.includes("REVENUE_QUERY_KEYS"), "pull-to-refresh invalidates all revenue sources");
});

test("native revenue UX contracts: windowing, haptics, states, no forbidden patterns", () => {
  assert.ok(NATIVE.includes("useWindowedList"), "the sponsor list is windowed");
  assert.ok(NATIVE.includes('restoreKey: "admin-revenue"'), "window depth survives remounts for scroll restore");
  assert.ok(NATIVE.includes("emitHaptic"), "haptics on interactions");
  assert.ok(NATIVE.includes('"tab.select"'), "row/sort taps emit a selection haptic");
  assert.ok(NATIVE.includes("NativeEmptyState") && NATIVE.includes("NativeSkeleton"), "empty + loading states");
  assert.ok(NATIVE.includes("PullToRefresh"), "pull to refresh the report");
  assert.ok(NATIVE.includes("NativeTopBar") && NATIVE.includes('fallback="/admin/ads"'), "self-chromed with a section-hub fallback");
  assert.ok(NATIVE.includes("Search"), "search where the native list benefits (read-only)");
  assert.ok(!NATIVE.includes("group-hover:"), "no hover-only affordances");
  assert.ok(!/from ["']@capacitor/.test(NATIVE), "no static @capacitor imports");
  assert.ok(!/import\s+\{[^}]*\}\s+from\s+["']recharts["']/.test(NATIVE), "no desktop recharts dependency in the native report");
});

test("detail screen is exported for URL addressability", () => {
  assert.ok(/export function NativeRevenueSponsorDetail/.test(NATIVE), "sponsor detail is a named export");
  assert.ok(NATIVE.includes("useParams"), "detail reads its id from the route");
  assert.ok(NATIVE.includes("/admin/ads/revenue/"), "list navigates to the addressable detail route");
});
