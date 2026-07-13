/**
 * Pure logic for the native Ads workflow. Mirrors the web AdsManager exactly —
 * the ad-slot positions, creative sizes, the empty-ad draft shape, the sample
 * (test) creative, URL/schedule validation, the status badge, the analytics
 * aggregation over the localStorage `rlt_ad_stats` map, and the duplicate
 * payload — so the native screens write payload-parity records through the
 * SAME entities (SiteAd / SiteSettings) with the same field names and values.
 *
 * Note: the web AdsManager dispatches NO rlt_admin_log events for ads, so the
 * native workflow intentionally emits none either (audit parity is "same
 * events"; here the same set is the empty set). Session ad metrics live in
 * localStorage `rlt_ad_stats` and sponsors in `rlt_sponsors` — both read-only
 * here, exactly as the web manager treats them (stats are reset-only).
 */

/** Ad-slot positions — identical keys/labels/desc to AdsManager.POSITIONS. */
export const AD_POSITIONS = [
  { key: "banner-top", label: "Banner Top", desc: "Full-width above main content" },
  { key: "banner-bottom", label: "Banner Bottom", desc: "Full-width below page content" },
  { key: "in-feed", label: "In-Feed", desc: "Between content sections (Home, Forum)" },
  { key: "sidebar", label: "Sidebar", desc: "Right column on desktop" },
  { key: "footer", label: "Footer", desc: "Above site footer (all pages)" },
];

/** Creative sizes — identical keys/labels/dims to AdsManager.SIZES. */
export const AD_SIZES = [
  { key: "leaderboard", label: "Leaderboard", dim: "728 × 90" },
  { key: "medium-rectangle", label: "Medium Rectangle", dim: "300 × 250" },
  { key: "wide-skyscraper", label: "Wide Skyscraper", dim: "160 × 600" },
  { key: "mobile-banner", label: "Mobile Banner", dim: "320 × 50" },
];

/** Device-target options — identical to the web select. */
export const AD_DEVICE_TARGETS = [
  { key: "all", label: "All Devices" },
  { key: "desktop", label: "Desktop Only" },
  { key: "mobile", label: "Mobile Only" },
];

/**
 * Exact create-draft shape the web manager seeds (AdsManager.emptyAd). Every
 * field here must exist in the web source — the native create never invents a
 * field the web doesn't write.
 */
export function emptyAd() {
  return {
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
  };
}

/** Self-contained SVG sample creative — byte-identical to AdsManager. */
export function sampleAdCreative() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="728" height="90"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f97316"/><stop offset="1" stop-color="#d97706"/></linearGradient></defs><rect width="728" height="90" fill="url(#g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="bold" fill="#ffffff" letter-spacing="2">SAMPLE AD · 728 × 90</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Ready-made sample/test ad — same fields the web sampleAd() creates. */
export function sampleAd(position = "footer") {
  return {
    ...emptyAd(),
    title: "Sample Ad (test)",
    image_url: sampleAdCreative(),
    target_url: "https://example.com",
    position,
    is_active: true,
  };
}

/** URL validity — same rule the web uses (new URL() must not throw). */
export function isValidUrl(url) {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether an ad's date window includes today. Mirrors AdsManager.isScheduleActive
 * (ISO yyyy-mm-dd string comparison against today). `today` is injectable for
 * tests; production callers use the default (today in local ISO date).
 */
export function isScheduleActive(ad, today = new Date().toISOString().split("T")[0]) {
  if (!ad) return false;
  if (ad.start_date && today < ad.start_date) return false;
  if (ad.end_date && today > ad.end_date) return false;
  return true;
}

/**
 * Status badge for an ad — same label logic as AdsManager.getStatusLabel
 * (Paused / Scheduled / Live). `tone` uses the native badge token language;
 * the LABEL is what carries the business meaning and is identical to the web.
 */
export function getStatusLabel(ad, today) {
  if (!ad?.is_active || ad?.is_active === "false") {
    return { label: "Paused", tone: "border-border bg-muted/10 text-muted-foreground" };
  }
  if (!isScheduleActive(ad, today)) {
    return { label: "Scheduled", tone: "border-amber-500/40 bg-amber-500/10 text-amber-300" };
  }
  return { label: "Live", tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
}

/** Validation — same messages/order as AdsManager.validateAd. */
export function validateAd(ad) {
  const errors = [];
  if (!ad.title?.trim()) errors.push("Title is required");
  if (!ad.image_url?.trim()) errors.push("Ad creative image is required");
  if (ad.target_url && !isValidUrl(ad.target_url)) errors.push("Target URL is not a valid URL");
  if (ad.start_date && ad.end_date && ad.start_date > ad.end_date) errors.push("End date must be after start date");
  return errors;
}

/** Same money coercion the web number inputs apply: parseFloat(value) || 0. */
export function toMoneyField(value) {
  return parseFloat(value) || 0;
}

/**
 * Aggregate the localStorage `rlt_ad_stats` map exactly as AdsManager does:
 * keys are `${position}__${adId}`, values carry impressions/clicks. Returns
 * totals, a two-decimal CTR string, and a per-position breakdown keyed by the
 * position slug.
 */
export function aggregateAnalytics(stats, positions = AD_POSITIONS) {
  let totalImpressions = 0;
  let totalClicks = 0;
  const byPosition = {};
  positions.forEach((p) => {
    byPosition[p.key] = { impressions: 0, clicks: 0 };
  });

  Object.entries(stats || {}).forEach(([key, val]) => {
    const pos = key.split("__")[0];
    totalImpressions += val?.impressions || 0;
    totalClicks += val?.clicks || 0;
    if (byPosition[pos]) {
      byPosition[pos].impressions += val?.impressions || 0;
      byPosition[pos].clicks += val?.clicks || 0;
    }
  });

  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";
  return { totalImpressions, totalClicks, ctr, byPosition };
}

/** Header counts, mirroring the web math (active + scheduled use is_active AND schedule). */
export function adCounts(ads, today) {
  const list = ads || [];
  return {
    total: list.length,
    active: list.filter((a) => a.is_active && isScheduleActive(a, today)).length,
    scheduled: list.filter((a) => a.is_active && !isScheduleActive(a, today)).length,
  };
}

/**
 * Duplicate payload — identical to AdsManager.duplicateMutation: strip id and
 * server timestamps, append " (Copy)" to the title.
 */
export function buildDuplicatePayload(ad) {
  const { id, created_date, updated_date, ...rest } = ad;
  void id;
  void created_date;
  void updated_date;
  return { ...rest, title: `${ad.title} (Copy)` };
}

/**
 * Update payload — same as AdsManager.saveMutation: on an existing record the
 * id is stripped and the remaining fields are sent as the update body.
 */
export function stripAdId(ad) {
  const { id, ...payload } = ad;
  return { id, payload };
}

/** A new A/B variant row — same shape the web editor pushes. */
export function newAbVariant() {
  return { id: cryptoRandomId(), image_url: "", impressions: 0, clicks: 0 };
}

/** UUID with a deterministic fallback so pure tests don't need a browser. */
function cryptoRandomId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Native-only read-only search over the ad list (the web has no ad search).
 * Matches title, position and target URL — no write impact, purely client-side.
 */
export function filterAds(ads, query = "") {
  const q = query.trim().toLowerCase();
  if (!q) return ads || [];
  return (ads || []).filter((ad) =>
    [ad.title, ad.position, ad.target_url]
      .map((v) => String(v || "").toLowerCase())
      .some((v) => v.includes(q))
  );
}
