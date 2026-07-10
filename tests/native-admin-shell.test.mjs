import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NATIVE_ADMIN_TABS,
  ADMIN_SECTION_MODULES,
  NATIVE_ADMIN_MORE_ITEMS,
  adminTabForPath,
} from "../src/native/admin/admin-nav.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Tab contract ────────────────────────────────────────────────────────
test("native admin has exactly five tabs: Overview/Content/Store/Community/More", () => {
  assert.deepEqual(
    NATIVE_ADMIN_TABS.map((t) => t.id),
    ["overview", "content", "store", "community", "more"]
  );
  for (const tab of NATIVE_ADMIN_TABS) {
    assert.ok(tab.to.startsWith("/admin"), `${tab.id} routes under /admin`);
  }
});

test("adminTabForPath groups secondary sections under More", () => {
  assert.equal(adminTabForPath("/admin"), "overview");
  assert.equal(adminTabForPath("/admin/overview"), "overview");
  assert.equal(adminTabForPath("/admin/content/news"), "content");
  assert.equal(adminTabForPath("/admin/store/orders"), "store");
  assert.equal(adminTabForPath("/admin/community/forum"), "community");
  assert.equal(adminTabForPath("/admin/events/matchups"), "more");
  assert.equal(adminTabForPath("/admin/people/users"), "more");
  assert.equal(adminTabForPath("/admin/ads/revenue"), "more");
  assert.equal(adminTabForPath("/admin/settings/settings"), "more");
  assert.equal(adminTabForPath("/forum"), null);
});

// ── Capability parity: every web admin capability stays reachable ───────
test("all eight web admin capability groups map to native modules", () => {
  assert.deepEqual(
    Object.keys(ADMIN_SECTION_MODULES).sort(),
    ["ads", "community", "content", "events", "export", "people", "settings", "store"]
  );
  const expected = {
    content: ["news", "travel", "gallery", "faqs", "partners", "testimonials"],
    store: ["products", "orders"],
    community: ["forum", "bans"],
    events: ["events", "teams", "matchups"],
    people: ["users", "registrations", "invites", "bans"],
    ads: ["ads", "sponsors", "calendar", "revenue"],
    settings: ["settings"],
    export: ["export"],
  };
  assert.deepEqual(ADMIN_SECTION_MODULES, expected);
});

test("module registry implements every referenced module with real managers", () => {
  const registry = read("../src/native/admin/admin-modules.jsx");
  const allModules = new Set(Object.values(ADMIN_SECTION_MODULES).flat());
  for (const id of allModules) {
    assert.ok(new RegExp(`\\b${id}:\\s*\\{`).test(registry), `registry missing module "${id}"`);
  }
  // The heavyweight web managers must be reused, not reimplemented.
  for (const manager of [
    "admin/NewsManager", "admin/TravelPackagesManager", "admin/GalleryManager", "admin/FaqManager",
    "admin/PartnersManager", "admin/TestimonialsManager", "admin/ProductsManager", "admin/OrdersManager",
    "admin/ForumManager", "admin/UsersManager", "admin/RegistrationsTable", "admin/UserInviteManager",
    "admin/BansManager", "admin/EventsManager", "admin/TeamsManager", "admin/MatchupsManager",
    "admin/SiteSettingsManager", "admin/AdsManager", "admin/SponsorManager", "admin/CampaignCalendar",
    "admin/AdRevenueTracker", "admin/DataExporter",
  ]) {
    assert.ok(registry.includes(manager), `registry must lazy-load ${manager}`);
  }
});

// ── More screen contents ────────────────────────────────────────────────
test("More offers Events/People/Ads/Settings/Export plus return + sign out", () => {
  const ids = NATIVE_ADMIN_MORE_ITEMS.map((i) => i.id);
  for (const required of ["events", "people", "ads", "settings", "export", "return", "signout"]) {
    assert.ok(ids.includes(required), `More missing ${required}`);
  }
});

// ── Chrome + guard contracts ────────────────────────────────────────────
test("native tree mounts the admin shell behind RequireAdmin", () => {
  const routes = read("../src/native/app/NativeAppRoutes.jsx");
  assert.ok(routes.includes("<RequireAdmin><NativeAdminRoutes /></RequireAdmin>"), "admin stays guarded");
});

test("native admin shell drops the desktop command-centre chrome", () => {
  const shell = read("../src/native/admin/NativeAdminShell.jsx");
  for (const forbidden of ["AdminCommandPalette", "LiveClock", "useLiveClock", "breadcrumb", "Ctrl+"]) {
    assert.ok(!shell.includes(forbidden), `native admin shell must not carry ${forbidden}`);
  }
  assert.ok(shell.includes("min-h-dvh"), "shell uses min-h-dvh");
  assert.ok(shell.includes("AdminOfflineBanner"), "offline state retained");
  assert.ok(shell.includes("Fan app"), "return-to-fan affordance in the header");
});

test("web admin layout is untouched by the native shell", () => {
  const adminPage = read("../src/pages/Admin.jsx");
  assert.ok(adminPage.includes("AdminLayout"), "web admin keeps AdminLayout");
  assert.ok(!adminPage.includes("NativeAdmin"), "web admin does not import native admin");
});
