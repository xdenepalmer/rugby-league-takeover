import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AD_POSITIONS,
  AD_SIZES,
  AD_DEVICE_TARGETS,
  emptyAd,
  sampleAd,
  sampleAdCreative,
  isValidUrl,
  isScheduleActive,
  getStatusLabel,
  validateAd,
  toMoneyField,
  aggregateAnalytics,
  adCounts,
  buildDuplicatePayload,
  stripAdId,
  newAbVariant,
  filterAds,
} from "../src/native/admin/workflows/ads-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const WEB = read("../src/components/admin/AdsManager.jsx");
const NATIVE = read("../src/native/admin/workflows/NativeAdsWorkflow.jsx");

// ── Constant parity ──────────────────────────────────────────────────────
test("positions/sizes/device targets mirror the web AdsManager keys", () => {
  assert.deepEqual(AD_POSITIONS.map((p) => p.key), ["banner-top", "banner-bottom", "in-feed", "sidebar", "footer"]);
  assert.deepEqual(AD_SIZES.map((s) => s.key), ["leaderboard", "medium-rectangle", "wide-skyscraper", "mobile-banner"]);
  assert.deepEqual(AD_DEVICE_TARGETS.map((d) => d.key), ["all", "desktop", "mobile"]);
  // Every position/size key the native offers must exist in the web source.
  for (const p of AD_POSITIONS) assert.ok(WEB.includes(`"${p.key}"`), `web knows position ${p.key}`);
  for (const s of AD_SIZES) assert.ok(WEB.includes(`"${s.key}"`), `web knows size ${s.key}`);
});

// ── Create-draft shape parity ────────────────────────────────────────────
test("emptyAd is byte-compatible with the web emptyAd() shape", () => {
  assert.deepEqual(emptyAd(), {
    title: "",
    image_url: "",
    target_url: "",
    position: "banner-top",
    size: "leaderboard",
    is_active: true,
    start_date: "",
    end_date: "",
    sponsor_id: "",
    price_per_month: 0,
    cpm_rate: 0,
    device_target: "all",
    ab_variants: [],
  });
  // Every field of the native draft must exist in the web manager's source.
  for (const field of Object.keys(emptyAd())) {
    assert.ok(WEB.includes(field), `web AdsManager writes ${field}`);
  }
});

test("sampleAd matches the web sample/test ad exactly (fields + SVG creative)", () => {
  const s = sampleAd();
  assert.equal(s.title, "Sample Ad (test)");
  assert.equal(s.target_url, "https://example.com");
  assert.equal(s.position, "footer", "default sample slot is footer");
  assert.equal(s.is_active, true);
  assert.ok(s.image_url.startsWith("data:image/svg+xml,"), "self-contained SVG creative");
  assert.equal(sampleAd("banner-top").position, "banner-top", "position override honoured");
  // The web ships the identical SVG creative string.
  assert.ok(WEB.includes("SAMPLE AD · 728 × 90"), "web sample creative text");
  assert.ok(sampleAdCreative().includes(encodeURIComponent("SAMPLE AD")), "native sample creative encodes the same text");
});

// ── URL + schedule + status rules mirror the web ─────────────────────────
test("isValidUrl matches the web (new URL must not throw)", () => {
  assert.equal(isValidUrl("https://example.com"), true);
  assert.equal(isValidUrl("not a url"), false);
  assert.equal(isValidUrl(""), false);
  assert.equal(isValidUrl(null), false);
});

test("isScheduleActive respects start/end windows like the web", () => {
  const today = "2026-07-13";
  assert.equal(isScheduleActive({}, today), true, "no window ⇒ always in schedule");
  assert.equal(isScheduleActive({ start_date: "2026-07-01", end_date: "2026-07-31" }, today), true);
  assert.equal(isScheduleActive({ start_date: "2026-08-01" }, today), false, "future start ⇒ not yet");
  assert.equal(isScheduleActive({ end_date: "2026-07-01" }, today), false, "past end ⇒ expired");
  assert.equal(isScheduleActive(null, today), false);
});

test("getStatusLabel yields the web's Paused/Scheduled/Live labels", () => {
  const today = "2026-07-13";
  assert.equal(getStatusLabel({ is_active: false }, today).label, "Paused");
  assert.equal(getStatusLabel({ is_active: "false" }, today).label, "Paused");
  assert.equal(getStatusLabel({ is_active: true, start_date: "2026-08-01" }, today).label, "Scheduled");
  assert.equal(getStatusLabel({ is_active: true }, today).label, "Live");
  // The web writes these exact status labels.
  for (const label of ["Paused", "Scheduled", "Live"]) {
    assert.ok(WEB.includes(`label: "${label}"`), `web status label ${label}`);
  }
});

// ── Validation parity ────────────────────────────────────────────────────
test("validateAd returns the web's messages in the same order", () => {
  const titled = { ...emptyAd(), title: "Promo" };
  assert.deepEqual(validateAd(emptyAd()), ["Title is required", "Ad creative image is required"]);
  assert.deepEqual(validateAd({ ...emptyAd(), title: "  " }), ["Title is required", "Ad creative image is required"]);
  assert.deepEqual(validateAd(titled), ["Ad creative image is required"]);
  assert.deepEqual(validateAd({ ...titled, image_url: "x" }), []);
  assert.deepEqual(
    validateAd({ ...titled, image_url: "x", target_url: "nope" }),
    ["Target URL is not a valid URL"]
  );
  assert.deepEqual(
    validateAd({ ...titled, image_url: "x", start_date: "2026-08-02", end_date: "2026-08-01" }),
    ["End date must be after start date"]
  );
  assert.deepEqual(validateAd({}), ["Title is required", "Ad creative image is required"]);
  for (const msg of ["Title is required", "Ad creative image is required", "Target URL is not a valid URL", "End date must be after start date"]) {
    assert.ok(WEB.includes(`"${msg}"`), `web validation message ${msg}`);
  }
});

// ── Money coercion parity ────────────────────────────────────────────────
test("toMoneyField coerces exactly like the web (parseFloat(value) || 0)", () => {
  assert.equal(toMoneyField("29.95"), 29.95);
  assert.equal(toMoneyField(""), 0);
  assert.equal(toMoneyField("abc"), 0);
  assert.equal(toMoneyField("0"), 0);
  assert.ok(WEB.includes("parseFloat(e.target.value) || 0"), "web uses the same coercion");
});

// ── Analytics aggregation over rlt_ad_stats ──────────────────────────────
test("aggregateAnalytics splits keys on __ and sums per position, like the web", () => {
  const stats = {
    "banner-top__a1": { impressions: 100, clicks: 4 },
    "banner-top__a2": { impressions: 100, clicks: 0 },
    "footer__a3": { impressions: 50, clicks: 5 },
    "unknown__a4": { impressions: 999, clicks: 9 }, // counts toward totals, not any known slot
  };
  const a = aggregateAnalytics(stats);
  assert.equal(a.totalImpressions, 1249);
  assert.equal(a.totalClicks, 18);
  assert.equal(a.ctr, ((18 / 1249) * 100).toFixed(2));
  assert.deepEqual(a.byPosition["banner-top"], { impressions: 200, clicks: 4 });
  assert.deepEqual(a.byPosition["footer"], { impressions: 50, clicks: 5 });
  assert.deepEqual(a.byPosition["sidebar"], { impressions: 0, clicks: 0 });

  const empty = aggregateAnalytics({});
  assert.equal(empty.totalImpressions, 0);
  assert.equal(empty.ctr, "0.00");
  assert.deepEqual(aggregateAnalytics(null).byPosition["footer"], { impressions: 0, clicks: 0 });
  // Web parity: the key split and the "0.00" default both live in the web source.
  assert.ok(WEB.includes('key.split("__")[0]'), "web splits stats keys on __");
  assert.ok(WEB.includes('"0.00"'), "web CTR default");
});

// ── Header counts (active vs scheduled) ──────────────────────────────────
test("adCounts mirrors the web active/scheduled math", () => {
  const today = "2026-07-13";
  const ads = [
    { is_active: true }, // live
    { is_active: true, start_date: "2026-08-01" }, // scheduled
    { is_active: false }, // paused (neither)
    { is_active: true, end_date: "2026-07-01" }, // expired ⇒ scheduled bucket (active && !inSchedule)
  ];
  assert.deepEqual(adCounts(ads, today), { total: 4, active: 1, scheduled: 2 });
  assert.deepEqual(adCounts([], today), { total: 0, active: 0, scheduled: 0 });
});

// ── Duplicate + update payloads ──────────────────────────────────────────
test("buildDuplicatePayload strips id/timestamps and appends (Copy), like the web", () => {
  const payload = buildDuplicatePayload({
    id: "ad1",
    created_date: "2026-01-01",
    updated_date: "2026-02-02",
    title: "Spring Promo",
    image_url: "x",
    position: "footer",
  });
  assert.equal(payload.title, "Spring Promo (Copy)");
  assert.equal(payload.image_url, "x");
  assert.equal(payload.position, "footer");
  assert.ok(!("id" in payload), "id stripped");
  assert.ok(!("created_date" in payload), "created_date stripped");
  assert.ok(!("updated_date" in payload), "updated_date stripped");
  assert.ok(WEB.includes("(Copy)"), "web appends (Copy)");
});

test("stripAdId separates id from the update body, like the web save path", () => {
  const { id, payload } = stripAdId({ id: "ad9", title: "T", image_url: "x" });
  assert.equal(id, "ad9");
  assert.deepEqual(payload, { title: "T", image_url: "x" });
  assert.ok(!("id" in payload));
});

test("newAbVariant produces the web variant shape", () => {
  const v = newAbVariant();
  assert.deepEqual(Object.keys(v).sort(), ["clicks", "id", "image_url", "impressions"]);
  assert.equal(v.image_url, "");
  assert.equal(v.impressions, 0);
  assert.equal(v.clicks, 0);
  assert.ok(v.id, "variant carries an id");
  assert.ok(WEB.includes("impressions: 0, clicks: 0"), "web seeds variant counters");
});

// ── Native-only read-only search ─────────────────────────────────────────
test("filterAds searches title/position/url (read-only, native addition)", () => {
  const ads = [
    { id: "1", title: "Spring Promo", position: "footer", target_url: "https://a.com" },
    { id: "2", title: "Vegas Trip", position: "banner-top", target_url: "https://vegas.com" },
  ];
  assert.deepEqual(filterAds(ads, "").map((a) => a.id), ["1", "2"], "empty query returns all");
  assert.deepEqual(filterAds(ads, "spring").map((a) => a.id), ["1"]);
  assert.deepEqual(filterAds(ads, "banner").map((a) => a.id), ["2"], "matches on position");
  assert.deepEqual(filterAds(ads, "vegas.com").map((a) => a.id), ["2"], "matches on url");
  assert.deepEqual(filterAds(ads, "zzz"), []);
});

// ── Source contracts: write authority, cache and payload parity ──────────
test("native ads workflow writes through the same entities as the web", () => {
  assert.ok(NATIVE.includes("base44.entities.SiteAd.create"), "create through the entity");
  assert.ok(NATIVE.includes("base44.entities.SiteAd.update"), "update through the entity");
  assert.ok(NATIVE.includes("base44.entities.SiteAd.delete"), "delete through the entity");
  assert.ok(NATIVE.includes("base44.entities.SiteSettings.update"), "settings update through the entity");
  assert.ok(NATIVE.includes("base44.entities.SiteSettings.create"), "settings create through the entity");
  // Same entity calls appear in the web source of truth.
  assert.ok(WEB.includes("base44.entities.SiteAd.update"), "web updates SiteAd");
  assert.ok(WEB.includes("base44.entities.SiteSettings.update"), "web updates SiteSettings");
});

test("native ads workflow shares the web query keys (shared cache)", () => {
  for (const key of ['["siteAds"]', '["siteSettings"]']) {
    assert.ok(NATIVE.includes(`queryKey: ${key}`), `native uses query key ${key}`);
    assert.ok(NATIVE.includes(`invalidateQueries({ queryKey: ${key} })`), `native invalidates ${key}`);
  }
  // The web AdsManager keys the same caches.
  assert.ok(WEB.includes("queryKey: ['siteAds']"), "web keys siteAds");
  assert.ok(WEB.includes("queryKey: ['siteSettings']"), "web keys siteSettings");
});

test("the toggle writes ads_enabled exactly as the web does", () => {
  assert.ok(NATIVE.includes("ads_enabled: enabled"), "native writes ads_enabled");
  assert.ok(WEB.includes("ads_enabled: enabled"), "web writes ads_enabled");
});

test("ad-creative uploads reuse the exact web ImageField client call", () => {
  const webField = read("../src/components/admin/ImageField.jsx");
  assert.ok(webField.includes("base44.integrations.Core.UploadFile({ file })"), "web upload mechanism unchanged");
  assert.ok(NATIVE.includes("base44.integrations.Core.UploadFile({ file })"), "native uploads through the same call");
});

test("session ad stats + sponsors stay in the same localStorage keys (read/reset only)", () => {
  assert.ok(NATIVE.includes('"rlt_ad_stats"'), "native reads/resets rlt_ad_stats");
  assert.ok(NATIVE.includes('"rlt_sponsors"'), "native reads rlt_sponsors");
  assert.ok(WEB.includes('"rlt_ad_stats"'), "web uses rlt_ad_stats");
  assert.ok(WEB.includes("'rlt_sponsors'") || WEB.includes('"rlt_sponsors"'), "web uses rlt_sponsors");
  // Stats are reset-only: the ONLY write to the stats key is the empty-object
  // clear (the key is a module constant; there is no other writeLS(...stats...)).
  assert.ok(NATIVE.includes("writeLS(AD_STATS_KEY, {})"), "native resets stats to {} (no invented stat writes)");
  assert.equal(
    (NATIVE.match(/writeLS\(AD_STATS_KEY/g) || []).length,
    1,
    "the only write to the stats key is the empty-object reset"
  );
});

test("no invented audit events or edge functions: the web ads manager has none", () => {
  assert.ok(!WEB.includes("rlt_admin_log") && !WEB.includes("emitAdminLog"), "web dispatches no ad audit events");
  assert.ok(!NATIVE.includes("emitAdminLog") && !NATIVE.includes("dispatchEvent"), "native matches: same (empty) event set");
  assert.ok(!WEB.includes("functions.invoke"), "web ads has no edge-function calls");
  assert.ok(!NATIVE.includes("functions.invoke"), "native ads has no edge-function calls (parity)");
});

test("toast copy matches the web manager verbatim", () => {
  for (const title of ["Ad saved", "Ad removed", "Ad duplicated", "Sample ad added", "Analytics cleared", "Validation Error"]) {
    assert.ok(NATIVE.includes(`"${title}"`), `native keeps the web toast: ${title}`);
    assert.ok(WEB.includes(`"${title}"`), `web has toast: ${title}`);
  }
  assert.ok(NATIVE.includes('`"${draft.title}" has been saved successfully.`'), "save description parity");
  assert.ok(NATIVE.includes("A test ad is live in the Footer slot"), "sample-ad description parity");
});

test("native ads UX contracts: windowing, haptics, native states, no hover-only", () => {
  assert.ok(NATIVE.includes("useWindowedList"), "long lists are windowed");
  assert.ok(NATIVE.includes('restoreKey: "admin-ads"'), "window depth survives remounts for scroll restore");
  assert.ok(NATIVE.includes("emitHaptic"), "haptics present");
  for (const event of ["tab.select", "action.primary", "mutation.warning", "save.success", "mutation.error"]) {
    assert.ok(NATIVE.includes(`"${event}"`), `haptic event ${event} used`);
  }
  assert.ok(!NATIVE.includes("group-hover:"), "no hover-only affordances");
  assert.ok(!/from ["']@capacitor/.test(NATIVE), "no static @capacitor imports");
  assert.ok(NATIVE.includes("NativeEmptyState") && NATIVE.includes("NativeSkeleton"), "empty + loading states");
  assert.ok(NATIVE.includes("PullToRefresh"), "pull to refresh");
  assert.ok(NATIVE.includes("AdminConfirmSheet"), "destructive actions confirmed via the sheet");
  assert.ok(NATIVE.includes("MobileActionDrawer"), "create uses the mobile drawer");
  assert.ok(NATIVE.includes("NativeTopBar"), "self-chromed with its own top bar");
});

test("editor + list are both exported and URL-addressable", () => {
  assert.ok(/export default function NativeAdsWorkflow/.test(NATIVE), "default export = list/hub screen");
  assert.ok(/export function NativeAdDetail/.test(NATIVE), "named export = creative editor");
  assert.ok(NATIVE.includes("/admin/ads/creatives/"), "editor is addressable per ad");
});
