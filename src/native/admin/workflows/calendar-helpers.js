/**
 * Pure logic for the native Campaign Calendar workflow. Mirrors the web
 * CampaignCalendar's rules exactly — sponsor colour/name resolution, the
 * per-day active-ad filter (adsByDay), the month summary math (active /
 * scheduled / expired), the Gantt "campaign bar" set, the sponsor legend, and
 * the ad status labels — so the native timeline reads the SAME data
 * (localStorage `rlt_ad_config` for ads, `rlt_sponsors` for sponsors) and
 * derives the SAME numbers the web panel shows.
 *
 * The web CampaignCalendar is READ-ONLY: it never writes an entity, never
 * touches localStorage, dispatches no rlt_admin_log events and calls no edge
 * function. This module is likewise pure derivation — no writes, no side
 * effects — and the native workflow performs none either (payload parity for a
 * read-only surface is "no writes at all").
 */

/** Web parity: the fallback colour an ad gets with no sponsor/brand colour. */
export const PRIMARY_FALLBACK = "hsl(15, 95%, 55%)";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad2 = (n) => String(n).padStart(2, "0");

/** Web parity: local-date → "YYYY-MM-DD" (CampaignCalendar.toDateStr). */
export function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** The current local date as a "YYYY-MM-DD" string (matches the web default). */
export function todayStr() {
  return toDateStr(new Date());
}

/** Zero-padded "YYYY-MM-DD" for a day number within a viewed month. */
export function dateStrFor(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

/** Month bounds mirroring the web math (last day via new Date(y, m+1, 0)). */
export function monthBounds(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return {
    daysInMonth,
    monthStart: dateStrFor(year, month, 1),
    monthEnd: dateStrFor(year, month, daysInMonth),
  };
}

/** Web parity: CampaignCalendar.isDateInRange (inclusive string compare). */
export function isDateInRange(dateStr, startDate, endDate) {
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}

/** Web parity: CampaignCalendar.getAdColor. */
export function getAdColor(ad, sponsors) {
  if (ad.sponsor_id && sponsors?.length) {
    const sponsor = sponsors.find((s) => s.id === ad.sponsor_id);
    if (sponsor?.brand_color) return sponsor.brand_color;
  }
  return ad.brand_color || PRIMARY_FALLBACK;
}

/** Web parity: CampaignCalendar.getAdSponsorName. */
export function getAdSponsorName(ad, sponsors) {
  if (ad.sponsor_id && sponsors?.length) {
    const sponsor = sponsors.find((s) => s.id === ad.sponsor_id);
    if (sponsor?.name) return sponsor.name;
  }
  return null;
}

/** Web parity: CampaignCalendar.getAdStatus (today defaults to now). */
export function getAdStatus(ad, today = todayStr()) {
  if (!ad.is_active) {
    return { label: "Paused", cls: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
  }
  if (ad.start_date && today < ad.start_date) {
    return { label: "Scheduled", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
  }
  if (ad.end_date && today > ad.end_date) {
    return { label: "Expired", cls: "text-red-400 bg-red-500/10 border-red-500/20" };
  }
  return { label: "Live", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
}

/**
 * Web parity: CampaignCalendar.adsByDay filter — an ad with no window is shown
 * on every day while active; a windowed ad shows on days inside its range.
 */
export function adsActiveOnDate(ads, dateStr) {
  return (ads || []).filter((ad) => {
    if (!ad.start_date && !ad.end_date) return ad.is_active;
    return isDateInRange(dateStr, ad.start_date, ad.end_date);
  });
}

/** Per-day active-ad counts for the month (the web's heat/dot data). */
export function dayCounts(ads, year, month) {
  const { daysInMonth } = monthBounds(year, month);
  const counts = {};
  for (let d = 1; d <= daysInMonth; d++) {
    counts[d] = adsActiveOnDate(ads, dateStrFor(year, month, d)).length;
  }
  return counts;
}

/**
 * Web parity: CampaignCalendar.campaignBars — the dated campaigns overlapping
 * the viewed month, each clamped to a bar start/end day within the month.
 */
export function campaignsInMonth(ads, sponsors, year, month) {
  const { daysInMonth, monthStart, monthEnd } = monthBounds(year, month);
  return (ads || [])
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
      return {
        ad,
        barStart,
        barEnd,
        color: getAdColor(ad, sponsors),
        sponsorName: getAdSponsorName(ad, sponsors),
      };
    });
}

/**
 * Web parity: CampaignCalendar.stats — Live-and-overlapping ads count as
 * active; scheduled/expired are counted regardless of month overlap (exactly
 * the web's computation, faithfully reproduced).
 */
export function monthStats(ads, year, month, today = todayStr()) {
  const { monthStart, monthEnd } = monthBounds(year, month);
  let active = 0, scheduled = 0, expired = 0;
  (ads || []).forEach((ad) => {
    const status = getAdStatus(ad, today);
    const adStart = ad.start_date || "0000-00-00";
    const adEnd = ad.end_date || "9999-99-99";
    const overlaps = adStart <= monthEnd && adEnd >= monthStart;
    if (status.label === "Expired") expired++;
    else if (status.label === "Scheduled") scheduled++;
    else if (status.label === "Live" && overlaps) active++;
  });
  return { active, scheduled, expired };
}

/** Web parity: CampaignCalendar.legendEntries (first name seen per colour). */
export function legendEntries(ads, sponsors) {
  const seen = new Map();
  (ads || []).forEach((ad) => {
    const color = getAdColor(ad, sponsors);
    const name = getAdSponsorName(ad, sponsors) || ad.title || "Unassigned";
    if (!seen.has(color)) seen.set(color, name);
  });
  return Array.from(seen.entries()).map(([color, name]) => ({ color, name }));
}

/** Month navigation — pure {year, month} steppers (month is 0-indexed). */
export function stepMonth({ year, month }, dir) {
  let m = month + dir;
  let y = year;
  if (m < 0) { m = 11; y -= 1; }
  else if (m > 11) { m = 0; y += 1; }
  return { year: y, month: m };
}

/** "July 2026" for a viewed month. */
export function monthLabel(year, month) {
  return `${MONTH_NAMES[month]} ${year}`;
}

/** "13 July 2026" for a "YYYY-MM-DD" day string (day-detail title). */
export function formatDayTitle(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || "";
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * Native-only read-only search over the month's campaign rows (the web has no
 * search; this only slices what's already shown — it never affects any write).
 */
export function filterCampaigns(rows, query = "") {
  const q = query.trim().toLowerCase();
  if (!q) return rows || [];
  return (rows || []).filter(({ ad, sponsorName }) =>
    [ad?.title, sponsorName, ad?.position]
      .map((v) => String(v || "").toLowerCase())
      .some((v) => v.includes(q))
  );
}
