import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PRIMARY_FALLBACK,
  MONTH_NAMES,
  toDateStr,
  dateStrFor,
  monthBounds,
  isDateInRange,
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
} from "../src/native/admin/workflows/calendar-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const WEB = read("../src/components/admin/CampaignCalendar.jsx");
const NATIVE = read("../src/native/admin/workflows/NativeCalendarWorkflow.jsx");
const HELPERS = read("../src/native/admin/workflows/calendar-helpers.js");

const SPONSORS = [
  { id: "s1", name: "Telstra", brand_color: "#0055ff" },
  { id: "s2", name: "Qantas" }, // no brand_color
];

// ── Constant + date-helper parity ────────────────────────────────────────
test("PRIMARY_FALLBACK and month names mirror the web constants", () => {
  assert.equal(PRIMARY_FALLBACK, "hsl(15, 95%, 55%)");
  assert.ok(WEB.includes('PRIMARY_FALLBACK = "hsl(15, 95%, 55%)"'), "web uses the same fallback colour");
  assert.equal(MONTH_NAMES.length, 12);
  assert.equal(MONTH_NAMES[6], "July");
});

test("toDateStr / dateStrFor zero-pad exactly like the web", () => {
  assert.equal(toDateStr(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(dateStrFor(2026, 6, 3), "2026-07-03");
  assert.equal(dateStrFor(2026, 11, 25), "2026-12-25");
});

test("monthBounds computes the last day like the web (new Date(y, m+1, 0))", () => {
  assert.deepEqual(monthBounds(2026, 1), { daysInMonth: 28, monthStart: "2026-02-01", monthEnd: "2026-02-28" });
  assert.deepEqual(monthBounds(2024, 1), { daysInMonth: 29, monthStart: "2024-02-01", monthEnd: "2024-02-29" }); // leap
  assert.deepEqual(monthBounds(2026, 6), { daysInMonth: 31, monthStart: "2026-07-01", monthEnd: "2026-07-31" });
});

test("isDateInRange is inclusive on both ends (web parity)", () => {
  assert.equal(isDateInRange("2026-07-10", "2026-07-01", "2026-07-31"), true);
  assert.equal(isDateInRange("2026-07-01", "2026-07-01", "2026-07-31"), true, "start is inclusive");
  assert.equal(isDateInRange("2026-07-31", "2026-07-01", "2026-07-31"), true, "end is inclusive");
  assert.equal(isDateInRange("2026-06-30", "2026-07-01", null), false);
  assert.equal(isDateInRange("2026-08-01", null, "2026-07-31"), false);
  assert.equal(isDateInRange("2026-08-01", null, null), true, "no window ⇒ always in range");
});

// ── Sponsor colour / name resolution ─────────────────────────────────────
test("getAdColor resolves sponsor colour, then ad colour, then fallback", () => {
  assert.equal(getAdColor({ sponsor_id: "s1" }, SPONSORS), "#0055ff", "sponsor brand_color wins");
  assert.equal(getAdColor({ sponsor_id: "s2", brand_color: "#111" }, SPONSORS), "#111", "sponsor without colour ⇒ ad colour");
  assert.equal(getAdColor({ brand_color: "#abc" }, SPONSORS), "#abc");
  assert.equal(getAdColor({}, SPONSORS), PRIMARY_FALLBACK, "nothing ⇒ fallback");
  assert.equal(getAdColor({ sponsor_id: "missing" }, SPONSORS), PRIMARY_FALLBACK);
});

test("getAdSponsorName returns the sponsor name or null", () => {
  assert.equal(getAdSponsorName({ sponsor_id: "s1" }, SPONSORS), "Telstra");
  assert.equal(getAdSponsorName({ sponsor_id: "s2" }, SPONSORS), "Qantas");
  assert.equal(getAdSponsorName({ sponsor_id: "missing" }, SPONSORS), null);
  assert.equal(getAdSponsorName({}, SPONSORS), null);
});

// ── Status labels mirror the web getAdStatus ─────────────────────────────
test("getAdStatus yields the web's Paused/Scheduled/Expired/Live labels", () => {
  const today = "2026-07-13";
  assert.equal(getAdStatus({ is_active: false }, today).label, "Paused");
  assert.equal(getAdStatus({ is_active: true, start_date: "2026-08-01" }, today).label, "Scheduled");
  assert.equal(getAdStatus({ is_active: true, end_date: "2026-07-01" }, today).label, "Expired");
  assert.equal(getAdStatus({ is_active: true }, today).label, "Live");
  assert.equal(getAdStatus({ is_active: true, start_date: "2026-07-01", end_date: "2026-07-31" }, today).label, "Live");
  // The web writes these exact labels and class strings.
  for (const label of ["Paused", "Scheduled", "Expired", "Live"]) {
    assert.ok(WEB.includes(`label: "${label}"`), `web status label ${label}`);
  }
  assert.ok(WEB.includes("text-emerald-400 bg-emerald-500/10 border-emerald-500/20"), "web Live tone reused");
  assert.equal(getAdStatus({ is_active: true }, today).cls, "text-emerald-400 bg-emerald-500/10 border-emerald-500/20");
});

// ── adsByDay parity ──────────────────────────────────────────────────────
test("adsActiveOnDate mirrors the web adsByDay filter", () => {
  const ads = [
    { id: "a", is_active: true }, // no window, active ⇒ every day
    { id: "b", is_active: false }, // no window, inactive ⇒ never
    { id: "c", is_active: true, start_date: "2026-07-10", end_date: "2026-07-20" },
    { id: "d", is_active: false, start_date: "2026-07-01", end_date: "2026-07-31" }, // window overrides active flag
  ];
  assert.deepEqual(adsActiveOnDate(ads, "2026-07-15").map((a) => a.id), ["a", "c", "d"]);
  assert.deepEqual(adsActiveOnDate(ads, "2026-07-05").map((a) => a.id), ["a", "d"]);
  assert.deepEqual(adsActiveOnDate(ads, "2026-08-01").map((a) => a.id), ["a"]);
  assert.deepEqual(adsActiveOnDate([], "2026-07-15"), []);
});

test("dayCounts counts active ads per day of the month", () => {
  const ads = [
    { id: "a", is_active: true }, // every day
    { id: "c", is_active: true, start_date: "2026-07-10", end_date: "2026-07-12" },
  ];
  const counts = dayCounts(ads, 2026, 6);
  assert.equal(counts[1], 1);
  assert.equal(counts[10], 2);
  assert.equal(counts[12], 2);
  assert.equal(counts[13], 1);
  assert.equal(Object.keys(counts).length, 31);
});

// ── campaignBars parity ──────────────────────────────────────────────────
test("campaignsInMonth mirrors the web campaignBars (dated overlap + clamping)", () => {
  const ads = [
    { id: "spans", is_active: true, start_date: "2026-06-20", end_date: "2026-08-05" }, // clamps to 1..31
    { id: "inside", is_active: true, start_date: "2026-07-10", end_date: "2026-07-20" },
    { id: "undated", is_active: true }, // excluded — no window
    { id: "off", is_active: true, start_date: "2026-09-01", end_date: "2026-09-10" }, // no overlap
  ];
  const rows = campaignsInMonth(ads, SPONSORS, 2026, 6);
  assert.deepEqual(rows.map((r) => r.ad.id), ["spans", "inside"], "only dated, overlapping campaigns");
  assert.deepEqual(
    rows.find((r) => r.ad.id === "spans"),
    { ad: ads[0], barStart: 1, barEnd: 31, color: PRIMARY_FALLBACK, sponsorName: null }
  );
  const inside = rows.find((r) => r.ad.id === "inside");
  assert.equal(inside.barStart, 10);
  assert.equal(inside.barEnd, 20);
  assert.deepEqual(campaignsInMonth([], SPONSORS, 2026, 6), []);
});

// ── stats parity ─────────────────────────────────────────────────────────
test("monthStats mirrors the web active/scheduled/expired computation", () => {
  const today = "2026-07-13";
  const ads = [
    { id: "live", is_active: true, start_date: "2026-07-01", end_date: "2026-07-31" }, // live + overlaps ⇒ active
    { id: "liveUndated", is_active: true }, // Live, no window; overlaps (0000..9999) ⇒ active
    { id: "sched", is_active: true, start_date: "2026-08-01" }, // future start ⇒ scheduled
    { id: "exp", is_active: true, end_date: "2026-07-01" }, // past end ⇒ expired
    { id: "paused", is_active: false }, // paused ⇒ none of the buckets
  ];
  // Viewing July (today's month): the live+overlapping ads count as active.
  assert.deepEqual(monthStats(ads, 2026, 6, today), { active: 2, scheduled: 1, expired: 1 });
  // Viewing August with the same "today": the July-only dated ad is still Live
  // (today sits in its window) but no longer OVERLAPS the viewed month, so it
  // drops out of "active" — exactly the web's Live-and-overlaps gate.
  assert.deepEqual(monthStats(ads, 2026, 7, today), { active: 1, scheduled: 1, expired: 1 });
  assert.deepEqual(monthStats([], 2026, 6, today), { active: 0, scheduled: 0, expired: 0 });
});

// ── legend parity ────────────────────────────────────────────────────────
test("legendEntries dedupes by colour, first name wins (web parity)", () => {
  const ads = [
    { id: "1", sponsor_id: "s1", title: "Promo A" }, // #0055ff → Telstra
    { id: "2", sponsor_id: "s1", title: "Promo B" }, // same colour, ignored
    { id: "3", title: "Unbranded" }, // fallback colour → title
    { id: "4" }, // fallback colour again → ignored (Unbranded name kept)
  ];
  assert.deepEqual(legendEntries(ads, SPONSORS), [
    { color: "#0055ff", name: "Telstra" },
    { color: PRIMARY_FALLBACK, name: "Unbranded" },
  ]);
  assert.deepEqual(legendEntries([{ id: "x" }], SPONSORS), [{ color: PRIMARY_FALLBACK, name: "Unassigned" }]);
});

// ── month navigation + labels ────────────────────────────────────────────
test("stepMonth wraps year boundaries in both directions", () => {
  assert.deepEqual(stepMonth({ year: 2026, month: 6 }, 1), { year: 2026, month: 7 });
  assert.deepEqual(stepMonth({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 });
  assert.deepEqual(stepMonth({ year: 2026, month: 0 }, -1), { year: 2025, month: 11 });
  assert.deepEqual(stepMonth({ year: 2026, month: 6 }, -1), { year: 2026, month: 5 });
});

test("monthLabel and formatDayTitle format human strings", () => {
  assert.equal(monthLabel(2026, 6), "July 2026");
  assert.equal(formatDayTitle("2026-07-13"), "13 July 2026");
  assert.equal(formatDayTitle("2026-12-01"), "1 December 2026");
  assert.equal(formatDayTitle(""), "");
  assert.equal(formatDayTitle("garbage"), "garbage");
});

// ── native-only search (read-only) ───────────────────────────────────────
test("filterCampaigns searches title/sponsor/position (read-only native add)", () => {
  const rows = [
    { ad: { id: "1", title: "Spring Promo", position: "footer" }, sponsorName: "Telstra" },
    { ad: { id: "2", title: "Vegas Trip", position: "banner-top" }, sponsorName: null },
  ];
  assert.deepEqual(filterCampaigns(rows, "").map((r) => r.ad.id), ["1", "2"], "empty query ⇒ all");
  assert.deepEqual(filterCampaigns(rows, "spring").map((r) => r.ad.id), ["1"]);
  assert.deepEqual(filterCampaigns(rows, "telstra").map((r) => r.ad.id), ["1"], "matches sponsor");
  assert.deepEqual(filterCampaigns(rows, "banner").map((r) => r.ad.id), ["2"], "matches slot");
  assert.deepEqual(filterCampaigns(rows, "zzz"), []);
});

// ── Source contracts: read-only, correct localStorage keys, shared cache ──
test("calendar is read-only: no writes, no entities, no edge fns on either surface", () => {
  // The web CampaignCalendar performs no writes at all.
  assert.ok(!WEB.includes("base44.entities"), "web calendar touches no entity");
  assert.ok(!WEB.includes("functions.invoke"), "web calendar calls no edge function");
  assert.ok(!WEB.includes("localStorage.setItem"), "web calendar writes no localStorage");
  // The native workflow matches: pure reads, no writes.
  assert.ok(!NATIVE.includes("base44.entities"), "native calendar touches no entity (parity)");
  assert.ok(!NATIVE.includes("functions.invoke"), "native calendar calls no edge function (parity)");
  assert.ok(!NATIVE.includes("localStorage.setItem"), "native calendar writes no localStorage (read-only)");
  assert.ok(!NATIVE.includes("useMutation"), "no mutations — nothing to write");
});

test("native calendar reads the same localStorage stores the web wrapper feeds it", () => {
  const wrapper = read("../src/native/admin/admin-modules.jsx");
  // The admin-modules wrapper feeds CampaignCalendar from these two keys.
  assert.ok(wrapper.includes('readLS("rlt_ad_config"') && wrapper.includes('readLS("rlt_sponsors"'), "wrapper reads both keys");
  assert.ok(NATIVE.includes('"rlt_ad_config"'), "native reads rlt_ad_config");
  assert.ok(NATIVE.includes('"rlt_sponsors"'), "native reads rlt_sponsors");
  assert.ok(NATIVE.includes("localStorage.getItem"), "native reads localStorage directly");
});

test("sponsors cache key is reused so the cache stays shared with the sponsors workflow", () => {
  const sponsorsNative = read("../src/native/admin/workflows/NativeSponsorsWorkflow.jsx");
  assert.ok(sponsorsNative.includes('["sponsors"]'), "sponsors workflow owns the [\"sponsors\"] key");
  assert.ok(NATIVE.includes('SPONSORS_QUERY_KEY = ["sponsors"]'), "calendar reuses the same key");
  assert.ok(NATIVE.includes('AD_CONFIG_QUERY_KEY = ["adConfig"]'), "ad config cached under its own native key");
});

test("no invented audit events: the web calendar dispatches none", () => {
  assert.ok(!WEB.includes("rlt_admin_log") && !WEB.includes("emitAdminLog"), "web calendar has no audit events");
  assert.ok(!NATIVE.includes("emitAdminLog") && !NATIVE.includes("dispatchEvent"), "native matches: same (empty) event set");
});

// ── Native UX contracts ──────────────────────────────────────────────────
test("native calendar UX contracts: windowing, haptics, native states, no hover-only", () => {
  assert.ok(NATIVE.includes("useWindowedList"), "the campaign list is windowed");
  assert.ok(NATIVE.includes('restoreKey: "admin-calendar"'), "window depth survives remounts for scroll restore");
  assert.ok(NATIVE.includes("emitHaptic"), "haptics present on primary actions");
  for (const event of ["action.primary", "tab.select"]) {
    assert.ok(NATIVE.includes(`"${event}"`), `haptic event ${event} used`);
  }
  assert.ok(!NATIVE.includes("group-hover:"), "no hover-only affordances");
  assert.ok(!/from ["']@capacitor/.test(NATIVE), "no static @capacitor imports");
  assert.ok(NATIVE.includes("NativeEmptyState") && NATIVE.includes("NativeSkeleton"), "empty + loading states");
  assert.ok(NATIVE.includes("PullToRefresh"), "pull to refresh re-reads localStorage");
  assert.ok(NATIVE.includes("NativeTopBar"), "self-chromed with its own top bar");
  assert.ok(NATIVE.includes('fallback="/admin/ads"'), "top bar falls back to the ads section hub");
  // 44pt touch targets: min-h-11 (44px) on the interactive controls.
  assert.ok(NATIVE.includes("min-h-11") || NATIVE.includes("h-11"), "44pt touch targets");
});

test("list + day detail are both exported and URL-addressable", () => {
  assert.ok(/export default function NativeCalendarWorkflow/.test(NATIVE), "default export = month timeline");
  assert.ok(/export function NativeCalendarDay/.test(NATIVE), "named export = per-day detail");
  assert.ok(NATIVE.includes("/admin/ads/calendar/"), "day detail is addressable per date");
  assert.ok(NATIVE.includes("useParams"), "day detail reads the :date param");
});

test("helpers stay pure — no side effects, no localStorage, no dispatch", () => {
  assert.ok(!/localStorage\./.test(HELPERS), "helpers never touch storage");
  assert.ok(!HELPERS.includes("dispatchEvent"), "helpers dispatch nothing");
  assert.ok(!HELPERS.includes("base44"), "helpers hit no entity/client");
});
