import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NATIVE_FAN_TABS,
  NATIVE_MORE_ITEMS,
  tabForPath,
  tabRoot,
  isTabRootPath,
} from "../src/native/app/native-tabs.js";
import {
  rememberTabPath,
  resolveTabPress,
  loadTabMemory,
} from "../src/native/navigation/tab-history.js";
import { HAPTIC_EVENTS, shouldEmitHaptic } from "../src/lib/native/haptic-events.js";
import {
  THEME_ACCENTS,
  DEFAULT_THEME_ACCENT,
  getStoredThemeAccent,
} from "../src/lib/theme-accents.js";
import { saveScrollPosition, getScrollPosition, clearScrollMemory } from "../src/native/navigation/scroll-memory.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Five-tab contract ───────────────────────────────────────────────────
test("native shell has exactly five fan tabs in the agreed order", () => {
  assert.deepEqual(
    NATIVE_FAN_TABS.map((t) => t.id),
    ["home", "news", "forum", "store", "account"]
  );
  assert.deepEqual(
    NATIVE_FAN_TABS.map((t) => t.to),
    ["/", "/news", "/forum", "/store", "/account"]
  );
});

test("Admin is never a public tab — it lives behind the More sheet, gated", () => {
  assert.ok(!NATIVE_FAN_TABS.some((t) => t.id === "admin" || t.to.startsWith("/admin")));
  const admin = NATIVE_MORE_ITEMS.find((i) => i.id === "admin");
  assert.ok(admin, "More sheet must offer an Admin entry");
  assert.equal(admin.requiresAdmin, true);
});

test("More sheet covers the secondary destinations", () => {
  const ids = NATIVE_MORE_ITEMS.map((i) => i.id);
  for (const required of ["plan", "gallery", "faq", "terms", "privacy"]) {
    assert.ok(ids.includes(required), `missing More item: ${required}`);
  }
});

// ── Path → tab ownership ────────────────────────────────────────────────
test("tabForPath maps roots and child routes to their owning tab", () => {
  assert.equal(tabForPath("/"), "home");
  assert.equal(tabForPath("/news"), "news");
  assert.equal(tabForPath("/news/some-article"), "news");
  assert.equal(tabForPath("/forum/thread/abc"), "forum");
  assert.equal(tabForPath("/store/product/42"), "store");
  assert.equal(tabForPath("/account"), "account");
  assert.equal(tabForPath("/gallery"), null, "More destinations belong to no tab");
  assert.equal(tabForPath("/admin/overview"), null);
  assert.equal(tabForPath(""), null);
});

test("tab root helpers", () => {
  assert.equal(tabRoot("store"), "/store");
  assert.ok(isTabRootPath("/forum"));
  assert.ok(!isTabRootPath("/forum/thread/x"));
});

// ── Tab press state machine ─────────────────────────────────────────────
test("pressing another tab restores its remembered route", () => {
  let memory = rememberTabPath({}, "/news/some-article");
  memory = rememberTabPath(memory, "/store/product/9?size=L");
  const action = resolveTabPress({ pressedTab: "news", currentPath: "/store/product/9", memory });
  assert.deepEqual(action, { type: "navigate", to: "/news/some-article" });
});

test("pressing another tab with no memory goes to its root", () => {
  const action = resolveTabPress({ pressedTab: "forum", currentPath: "/", memory: {} });
  assert.deepEqual(action, { type: "navigate", to: "/forum" });
});

test("reselecting the active tab on a child route pops to root", () => {
  const action = resolveTabPress({
    pressedTab: "forum",
    currentPath: "/forum/thread/abc",
    memory: { forum: "/forum/thread/abc" },
  });
  assert.deepEqual(action, { type: "pop-to-root", to: "/forum" });
});

test("reselecting the active tab at its root scrolls to top", () => {
  const action = resolveTabPress({ pressedTab: "home", currentPath: "/", memory: {} });
  assert.deepEqual(action, { type: "scroll-top" });
});

test("rememberTabPath ignores paths no tab owns and keeps others", () => {
  const memory = rememberTabPath({ news: "/news" }, "/gallery");
  assert.deepEqual(memory, { news: "/news" });
});

test("loadTabMemory tolerates corrupt storage", () => {
  const fake = { getItem: () => "{not json" };
  assert.deepEqual(loadTabMemory(fake), {});
  const fakeArray = { getItem: () => "[1,2]" };
  assert.deepEqual(loadTabMemory(fakeArray), {});
});

// ── Scroll memory ───────────────────────────────────────────────────────
test("scroll memory stores and clears per-path positions", () => {
  clearScrollMemory();
  saveScrollPosition("/news", 480);
  assert.equal(getScrollPosition("/news"), 480);
  assert.equal(getScrollPosition("/store"), null);
  clearScrollMemory();
  assert.equal(getScrollPosition("/news"), null);
});

// ── Semantic haptics ────────────────────────────────────────────────────
test("every haptic event maps to a known handler with a throttle window", () => {
  const known = new Set(["selection", "light", "medium", "heavy", "success", "warning", "error"]);
  for (const [event, spec] of Object.entries(HAPTIC_EVENTS)) {
    assert.ok(known.has(spec.handler), `${event} has unknown handler ${spec.handler}`);
    assert.ok(spec.minIntervalMs >= 100, `${event} must throttle (>=100ms)`);
  }
  for (const required of ["tab.select", "sheet.snap", "action.primary", "save.success", "mutation.warning", "mutation.error", "cart.add", "forum.react", "casino.win", "casino.jackpot"]) {
    assert.ok(HAPTIC_EVENTS[required], `missing haptic event ${required}`);
  }
});

test("haptic throttle suppresses rapid re-fires and allows spaced ones", () => {
  assert.equal(shouldEmitHaptic("tab.select", 1000, {}), true);
  assert.equal(shouldEmitHaptic("tab.select", 1050, { "tab.select": 1000 }), false);
  assert.equal(shouldEmitHaptic("tab.select", 1000 + 120, { "tab.select": 1000 }), true);
  assert.equal(shouldEmitHaptic("not.an.event", 1000, {}), false);
});

// ── Theme accents ───────────────────────────────────────────────────────
test("theme accent registry keeps the five brand accents with sincity default", () => {
  assert.deepEqual(
    Object.keys(THEME_ACCENTS).sort(),
    ["emerald", "flamingo", "highroller", "jackpot", "sincity"]
  );
  assert.equal(DEFAULT_THEME_ACCENT, "sincity");
  assert.equal(getStoredThemeAccent({ getItem: () => "flamingo" }), "flamingo");
  assert.equal(getStoredThemeAccent({ getItem: () => "bogus" }), "sincity");
  assert.equal(
    getStoredThemeAccent({
      getItem: () => {
        throw new Error("blocked");
      },
    }),
    "sincity"
  );
});

// ── Source contracts: the split itself ──────────────────────────────────
test("App.jsx routes natively via isNativeApp + lazy NativeAppRoutes", () => {
  const src = read("../src/App.jsx");
  assert.ok(src.includes("isNativeApp()"), "App must branch on isNativeApp()");
  assert.ok(/lazy\(\(\) => import\("@\/native\/app\/NativeAppRoutes/.test(src), "NativeAppRoutes must be lazy");
  assert.ok(src.includes("<PublicLayout />"), "web tree must keep PublicLayout");
});

test("native shell renders no web chrome", () => {
  const shell = read("../src/native/app/NativePublicShell.jsx");
  for (const forbidden of ["SiteNav", "AdSlot", "ScrollProgressBar", "InstallAppPrompt", "PwaUpdatePrompt"]) {
    assert.ok(!shell.includes(forbidden), `native shell must not render ${forbidden}`);
  }
  assert.ok(shell.includes("min-h-dvh"), "shell must use min-h-dvh");
  assert.ok(shell.includes("PublicOfflineBanner"), "shell keeps the offline banner");
  assert.ok(shell.includes("var(--safe-bottom)"), "content must clear the tab bar + home indicator");
});

test("native route tree keeps auth/admin guards and skips PublicLayout", () => {
  const routes = read("../src/native/app/NativeAppRoutes.jsx");
  assert.ok(routes.includes("RequireAuth"), "account stays guarded");
  assert.ok(routes.includes("RequireAdmin"), "admin stays guarded");
  assert.ok(!routes.includes("PublicLayout"), "native tree must not use the web layout");
});
