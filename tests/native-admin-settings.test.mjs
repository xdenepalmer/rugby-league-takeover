import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SETTINGS_DEFAULTS,
  SETTINGS_SECTIONS,
  mergeSettings,
  isSettingsDirty,
  isCustomField,
  customIndicator,
  parseVideoUrls,
  videoUrlsToText,
  appendVideoUrl,
  removeVideoUrl,
  sanitizePostcode,
  countdownEnabled,
  heroEyebrowVisible,
  isExistingRecord,
  settingsLogText,
} from "../src/native/admin/workflows/settings-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const NATIVE = read("../src/native/admin/workflows/NativeSettingsWorkflow.jsx");
const WEB = read("../src/components/admin/SiteSettingsManager.jsx");

// ── Default seed parity ──────────────────────────────────────────────────
test("SETTINGS_DEFAULTS mirrors the web `defaults` object verbatim", () => {
  assert.equal(SETTINGS_DEFAULTS.site_logo_url, "/icons/icon-192.png");
  assert.equal(SETTINGS_DEFAULTS.countdown_enabled, true);
  assert.equal(SETTINGS_DEFAULTS.countdown_title, "The takeover begins in");
  assert.equal(SETTINGS_DEFAULTS.footer_powered_by, "DENEO.AI");
  assert.deepEqual(SETTINGS_DEFAULTS.background_video_urls, [
    "https://ohytlrgfpcpvnqgdpqap.supabase.co/storage/v1/object/public/media/migrated/7753542d9_b39f245c-2207-4f31-bd97-2cb52f47dc3a.mov",
    "https://ohytlrgfpcpvnqgdpqap.supabase.co/storage/v1/object/public/media/migrated/bf55ac1e7_allegiantstadiumparadisenevadaclaytonhaamallegiantallegiantstadiumparadis.mp4",
  ]);
  // Every default key must appear in the web source (never invent a field).
  for (const key of Object.keys(SETTINGS_DEFAULTS)) {
    assert.ok(WEB.includes(key), `web SiteSettingsManager references default field ${key}`);
  }
});

test("every field the native form writes exists in the web source (no invented fields)", () => {
  const fields = new Set();
  for (const m of NATIVE.matchAll(/update\("([a-zA-Z0-9_]+)"/g)) fields.add(m[1]);
  // Sanity: the form writes a healthy field set, not zero.
  assert.ok(fields.size > 30, `expected many settings fields, saw ${fields.size}`);
  for (const field of fields) {
    assert.ok(WEB.includes(field), `web SiteSettingsManager writes ${field}`);
  }
  // The extra fields the web writes beyond `defaults` are all carried over.
  for (const extra of ["hero_eyebrow_visible", "facebook_fans", "legal_terms", "legal_privacy"]) {
    assert.ok(fields.has(extra), `native carries the web extra field ${extra}`);
    assert.ok(WEB.includes(extra), `web writes ${extra}`);
  }
});

// ── Merge + dirty semantics ──────────────────────────────────────────────
test("mergeSettings overlays the stored record on defaults and keeps id + custom values", () => {
  const merged = mergeSettings({ id: "rec_1", footer_powered_by: "ACME", extra_server_field: 7 });
  assert.equal(merged.id, "rec_1", "record id rides on the draft (update semantics)");
  assert.equal(merged.footer_powered_by, "ACME", "stored value wins over default");
  assert.equal(merged.site_logo_url, "/icons/icon-192.png", "untouched fields fall back to defaults");
  assert.equal(merged.extra_server_field, 7, "unknown server fields are preserved, not dropped");
  // No record ⇒ pure defaults.
  assert.deepEqual(mergeSettings(undefined), SETTINGS_DEFAULTS);
});

test("isSettingsDirty compares like the web savedRef JSON snapshot", () => {
  const baseline = mergeSettings({ id: "x" });
  assert.equal(isSettingsDirty(baseline, mergeSettings({ id: "x" })), false, "identical draft is clean");
  assert.equal(isSettingsDirty(baseline, { ...baseline, hero_title: "New" }), true, "an edit is dirty");
  // Toggling a field the record didn't have (adds a key) reads dirty, web parity.
  assert.equal(isSettingsDirty(baseline, { ...baseline, hero_eyebrow_visible: false }), true);
});

test("isExistingRecord decides update vs create exactly like the web ternary", () => {
  assert.equal(isExistingRecord({ id: "abc" }), true);
  assert.equal(isExistingRecord({}), false);
  assert.equal(isExistingRecord(mergeSettings(undefined)), false, "a defaults-only draft creates");
  // The web keys off `data.id` for the same branch.
  assert.ok(WEB.includes("data.id ? base44.entities.SiteSettings.update(data.id, data) : base44.entities.SiteSettings.create(data)"));
});

// ── Custom-vs-default indicator ──────────────────────────────────────────
test("isCustomField matches the web isCustom rule (set AND differs from default)", () => {
  assert.equal(isCustomField(null, "site_logo_url"), false, "no record ⇒ never custom");
  assert.equal(isCustomField({ site_logo_url: "/icons/icon-192.png" }, "site_logo_url"), false, "equals default ⇒ not custom");
  assert.equal(isCustomField({ site_logo_url: "https://x/logo.png" }, "site_logo_url"), true);
  assert.equal(isCustomField({ footer_text: "Hi" }, "site_logo_url"), false, "field not set ⇒ not custom");
  assert.equal(customIndicator({ site_logo_url: "https://x/logo.png" }, "site_logo_url"), "custom");
  assert.equal(customIndicator(null, "site_logo_url"), "default");
});

// ── Background video parsing ─────────────────────────────────────────────
test("parseVideoUrls splits lines, trims and drops blanks (web textarea parity)", () => {
  assert.deepEqual(parseVideoUrls("  a.mp4 \n\n b.mov \n   "), ["a.mp4", "b.mov"]);
  assert.deepEqual(parseVideoUrls(""), []);
  assert.deepEqual(parseVideoUrls(null), []);
  assert.deepEqual(videoUrlsToText(["a.mp4", "b.mov"]), "a.mp4\nb.mov");
  assert.equal(videoUrlsToText(undefined), "");
});

test("appendVideoUrl adds an uploaded URL; removeVideoUrl is immutable by index", () => {
  assert.deepEqual(appendVideoUrl(["a"], "b"), ["a", "b"]);
  assert.deepEqual(appendVideoUrl(undefined, "b"), ["b"]);
  const src = ["a", "b", "c"];
  assert.deepEqual(removeVideoUrl(src, 1), ["a", "c"]);
  assert.deepEqual(src, ["a", "b", "c"], "source untouched");
});

// ── Postcode sanitiser ───────────────────────────────────────────────────
test("sanitizePostcode strips non-digits and caps at 4 (web parity)", () => {
  assert.equal(sanitizePostcode("4000"), "4000");
  assert.equal(sanitizePostcode("40a0x"), "400");
  assert.equal(sanitizePostcode("123456"), "1234");
  assert.equal(sanitizePostcode(""), "");
  assert.equal(sanitizePostcode(null), "");
  // The web input uses exactly this transform.
  assert.ok(WEB.includes('replace(/\\D/g, "").slice(0, 4)'));
});

// ── Toggle semantics ─────────────────────────────────────────────────────
test("toggles default ON unless explicitly false (web `!== false`)", () => {
  assert.equal(countdownEnabled({}), true);
  assert.equal(countdownEnabled({ countdown_enabled: false }), false);
  assert.equal(countdownEnabled({ countdown_enabled: true }), true);
  assert.equal(heroEyebrowVisible({}), true);
  assert.equal(heroEyebrowVisible({ hero_eyebrow_visible: false }), false);
});

// ── Audit log text ───────────────────────────────────────────────────────
test("settingsLogText reproduces the web rlt_admin_log text verbatim", () => {
  assert.equal(settingsLogText({}), '[SETTING-UPDATE] Configuration saved successfully. Site Name: "Takeover"');
  assert.equal(settingsLogText({ site_name: "Vegas HQ" }), '[SETTING-UPDATE] Configuration saved successfully. Site Name: "Vegas HQ"');
  // The web dispatches this exact prefix, with type "success".
  assert.ok(WEB.includes('[SETTING-UPDATE] Configuration saved successfully. Site Name: "'));
  assert.ok(WEB.includes('type: "success"'));
});

// ── Section metadata mirrors the web categories ──────────────────────────
test("SETTINGS_SECTIONS mirror the web category ids, titles and summaries", () => {
  assert.deepEqual(SETTINGS_SECTIONS.map((s) => s.id), ["hero", "countdown", "media", "sections", "about", "shipping", "footer"]);
  const byId = Object.fromEntries(SETTINGS_SECTIONS.map((s) => [s.id, s]));
  assert.equal(byId.hero.summary({}, { site_logo_url: "https://x" }), "Logo: Custom");
  assert.equal(byId.hero.summary({}, null), "Logo: Default");
  assert.equal(byId.countdown.summary({ countdown_enabled: false }), "Live: Disabled");
  assert.equal(byId.countdown.summary({}), "Live: Enabled");
  assert.equal(byId.media.summary({ background_video_urls: ["a", "b"] }), "2 Video(s)");
  assert.equal(byId.sections.summary({ news_title: "From the strip" }), 'Title: "From the strip"');
  assert.equal(byId.about.summary({ about_title: "Built by fans" }), 'Headline: "Built by fans"');
  assert.equal(byId.shipping.summary({ shipping_sender_postcode: "4000" }), "Configured");
  assert.equal(byId.shipping.summary({ shipping_sender_postcode: "" }), "Not set up");
  assert.equal(byId.footer.summary({ footer_powered_by: "DENEO.AI" }), "Socials + powered by: DENEO.AI");
  // Titles are the web's category titles.
  for (const title of ["Brand & Hero", "Countdown Timer", "Background Media", "Shipping (AusPost)"]) {
    assert.ok(WEB.includes(title), `web has category title ${title}`);
  }
});

// ── Source contracts: same entity, cache, audit + upload authority ───────
test("native settings writes through the same SiteSettings entity + query key", () => {
  assert.ok(NATIVE.includes("base44.entities.SiteSettings.update(data.id, data)"), "update through the entity");
  assert.ok(NATIVE.includes("base44.entities.SiteSettings.create(data)"), "create through the entity");
  assert.ok(NATIVE.includes('queryKey: ["siteSettings"]'), "same query key as the web wrapper (shared cache)");
  assert.ok(NATIVE.includes('invalidateQueries({ queryKey: ["siteSettings"] })'), "invalidates the same key");
  assert.ok(NATIVE.includes('base44.entities.SiteSettings.list("-updated_date", 1)'), "same single-record fetch as admin-modules");
});

test("native settings dispatches the SAME rlt_admin_log success event", () => {
  assert.ok(NATIVE.includes('emitAdminLog("success"'), "success-typed audit event, web parity");
  assert.ok(NATIVE.includes("settingsLogText(variables)"), "logs the saved record's text");
  // emitAdminLog is the shared bus that dispatches rlt_admin_log.
  const helpers = read("../src/native/admin/workflows/workflow-helpers.js");
  assert.ok(helpers.includes('new CustomEvent("rlt_admin_log"'), "shared helper dispatches rlt_admin_log");
});

test("uploads reuse the exact client call the web MediaUploader/ImageField use", () => {
  const webUploader = read("../src/components/admin/MediaUploader.jsx");
  const webImage = read("../src/components/admin/ImageField.jsx");
  assert.ok(webUploader.includes("base44.integrations.Core.UploadFile({ file })"), "web media upload unchanged");
  assert.ok(webImage.includes("base44.integrations.Core.UploadFile({ file })"), "web image upload unchanged");
  assert.ok(NATIVE.includes("base44.integrations.Core.UploadFile({ file })"), "native uploads through the same call");
});

test("date/time uses the same DateTimePicker the web writes (PT-offset payload parity)", () => {
  assert.ok(NATIVE.includes('from "@/components/admin/DateTimePicker"'), "reuses the web PT-aware picker");
  assert.ok(NATIVE.includes('update("countdown_date"'), "writes the same countdown_date field");
});

// ── Native UX + safety contracts ─────────────────────────────────────────
test("native settings UX: sheets, confirm-guarded discard, haptics, native states", () => {
  assert.ok(NATIVE.includes("MobileActionDrawer"), "sections open as bottom sheets");
  assert.ok(NATIVE.includes("AdminConfirmSheet"), "discard is confirm-guarded");
  assert.ok(NATIVE.includes("Discard changes?"), "discard confirm copy");
  assert.ok(NATIVE.includes("NativeSkeleton"), "loading skeleton");
  assert.ok(NATIVE.includes("NativeEmptyState"), "empty/error state");
  assert.ok(NATIVE.includes("PullToRefresh"), "pull to refresh the settings query");
  assert.ok(NATIVE.includes("emitHaptic"), "haptics present");
  for (const event of ["action.primary", "save.success", "mutation.error", "mutation.warning", "tab.select"]) {
    assert.ok(NATIVE.includes(`"${event}"`), `haptic event ${event} used`);
  }
});

test("native settings has no forbidden patterns", () => {
  assert.ok(!NATIVE.includes("group-hover:"), "no hover-only affordances");
  assert.ok(!/from ["']@capacitor/.test(NATIVE), "no static @capacitor imports");
  assert.ok(!NATIVE.includes("window.confirm"), "no blocking window.confirm");
  // 44pt-plus touch targets on the primary/secondary actions.
  assert.ok(NATIVE.includes("min-h-12"), "primary actions are at least 48pt");
  assert.ok(NATIVE.includes("min-h-11") || NATIVE.includes("h-11"), "inputs/buttons meet 44pt");
});
