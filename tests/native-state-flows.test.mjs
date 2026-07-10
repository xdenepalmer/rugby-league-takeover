import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolvePushRoute } from "../src/lib/native/push-routing.js";
import { FOREGROUND_REFRESH_KEYS } from "../src/lib/native/app-lifecycle.js";
import { nextWindowLimit } from "../src/hooks/use-windowed-list.js";
import {
  saveScrollPosition,
  getScrollPosition,
  clearScrollMemory,
} from "../src/native/navigation/scroll-memory.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Notification tap routing ────────────────────────────────────────────
test("push payloads route to the exact screen", () => {
  assert.equal(resolvePushRoute({ type: "forum_reply", thread_id: "t1" }), "/forum/thread/t1");
  assert.equal(resolvePushRoute({ type: "forum_mention", thread_id: "t 2" }), "/forum/thread/t%202");
  assert.equal(resolvePushRoute({ type: "news", article_id: "a1" }), "/news/a1");
  assert.equal(resolvePushRoute({ type: "product_drop", product_id: "p1" }), "/store/product/p1");
  assert.equal(resolvePushRoute({ type: "order_update", order_id: "o1" }), "/account/orders");
  assert.equal(resolvePushRoute({ type: "admin_announcement", link: "/admin" }), "/admin");
  assert.equal(resolvePushRoute({ link: "/gallery?item=g1" }), "/gallery?item=g1");
});

test("malformed or hostile push payloads fall back to the notification centre", () => {
  assert.equal(resolvePushRoute(null), "/account/notifications");
  assert.equal(resolvePushRoute("string"), "/account/notifications");
  assert.equal(resolvePushRoute({}), "/account/notifications");
  assert.equal(resolvePushRoute({ type: "forum_reply" }), "/account/notifications", "missing id");
  assert.equal(resolvePushRoute({ link: "https://evil.example.com" }), "/account/notifications");
  assert.equal(resolvePushRoute({ link: "//evil.example.com" }), "/account/notifications");
});

// ── Query-cache persistence policy ──────────────────────────────────────
test("persistence allowlist admits only public, non-PII content roots", async () => {
  const src = read("../src/lib/native/query-persistence.js");
  for (const key of ["siteSettings", "news", "products", "gallery", "matchups", "events", "teams", "partners", "faqs"]) {
    assert.ok(src.includes(`"${key}"`), `allowlist must include ${key}`);
  }
  assert.ok(!src.includes("PERSIST_DENYLIST"), "denylist model must be gone — allowlist is the policy");
  for (const key of ["forumPosts", "testimonials", "tippingEntries", "notifications", "orders"]) {
    assert.ok(
      !new RegExp(`PERSIST_ALLOWLIST[\\s\\S]*?"${key}"[\\s\\S]*?\\];`).test(src),
      `${key} must never be allowlisted (PII/admin projections)`
    );
  }
  assert.ok(src.includes("shouldDehydrateQuery"), "allowlist must be enforced at dehydrate time");
  assert.ok(src.includes("shouldDehydrateMutation"), "mutations must never dehydrate");
  assert.ok(src.includes("SIGNED_OUT"), "sign-out must clear the persisted cache");
  assert.ok(src.includes("maxAge"), "persistence must be age-bounded");
  assert.ok(src.includes("buster"), "persistence must be version-busted");
});

test("shouldPersistQuery policy (pure)", async () => {
  // Import via file URL to avoid pulling the @tanstack persist deps into
  // this test — the policy function is what matters.
  const src = read("../src/lib/native/query-persistence.js");
  const match = src.match(/export function shouldPersistQuery[\s\S]*?\n\}/);
  assert.ok(match, "shouldPersistQuery must exist");
  const allowMatch = src.match(/export const PERSIST_ALLOWLIST = \[([\s\S]*?)\]/);
  assert.ok(allowMatch, "PERSIST_ALLOWLIST must exist");
  const allowlist = allowMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
  const shouldPersistQuery = new Function(
    "queryKey",
    "state",
    `const PERSIST_ALLOWLIST = ${JSON.stringify(allowlist)};
     ${match[0].replace("export function shouldPersistQuery", "function shouldPersistQuery")}
     return shouldPersistQuery(queryKey, state);`
  );
  // Public content persists.
  assert.equal(shouldPersistQuery(["news"], { status: "success" }), true);
  assert.equal(shouldPersistQuery(["products"], { status: "success" }), true);
  // Admin/PII surfaces never persist.
  assert.equal(shouldPersistQuery(["orders"], { status: "success" }), false);
  assert.equal(shouldPersistQuery(["forumPosts"], { status: "success" }), false, "admin projections carry ip_address/user_email");
  assert.equal(shouldPersistQuery(["testimonials"], { status: "success" }), false);
  assert.equal(shouldPersistQuery(["tippingEntries"], { status: "success" }), false);
  // User-scoped data never persists (secure by default: not allowlisted).
  assert.equal(shouldPersistQuery(["notifications", "u1"], { status: "success" }), false);
  assert.equal(shouldPersistQuery(["myOrders", "a@b.c"], { status: "success" }), false);
  assert.equal(shouldPersistQuery(["myInterest", "a@b.c"], { status: "success" }), false);
  assert.equal(shouldPersistQuery(["user"], { status: "success" }), false);
  // Only settled successes persist.
  assert.equal(shouldPersistQuery(["news"], { status: "error" }), false, "only successful queries persist");
  assert.equal(shouldPersistQuery(["news"], undefined), false, "no state means no persistence");
});

// ── Foreground refresh ──────────────────────────────────────────────────
test("foreground refresh targets freshness-critical keys only", () => {
  assert.deepEqual(FOREGROUND_REFRESH_KEYS, [["notifications"], ["forumPosts"], ["adminAttention"]]);
});

// ── Windowed lists ──────────────────────────────────────────────────────
test("window limit grows by step and clamps to total", () => {
  assert.equal(nextWindowLimit(12, 12, 100), 24);
  assert.equal(nextWindowLimit(95, 12, 100), 100);
  assert.equal(nextWindowLimit(0, 12, 5), 5);
  assert.equal(nextWindowLimit(NaN, 12, 100), 0);
});

// ── Scroll memory persistence is fail-safe in non-browser contexts ──────
test("scroll memory works without sessionStorage", () => {
  clearScrollMemory();
  saveScrollPosition("/news", 300);
  assert.equal(getScrollPosition("/news"), 300);
  clearScrollMemory();
  assert.equal(getScrollPosition("/news"), null);
});

// ── Checkout return contracts ───────────────────────────────────────────
test("checkout return routes exist on both platforms", () => {
  const nativeRoutes = read("../src/native/app/NativeAppRoutes.jsx");
  assert.ok(nativeRoutes.includes('path="/store/checkout/success"'));
  assert.ok(nativeRoutes.includes('path="/store/checkout/cancel"'));
  const app = read("../src/App.jsx");
  assert.ok(app.includes('path="/store/checkout/success"'), "web alias for success");
  assert.ok(app.includes('path="/store/checkout/cancel"'), "web alias for cancel");
});

test("native checkout return defers payment truth to the webhook", () => {
  const screen = read("../src/native/screens/store/NativeCheckoutReturnScreen.jsx");
  assert.ok(screen.includes("webhook"), "must document webhook authority");
  assert.ok(screen.includes('["myOrders"]'), "refreshes webhook-written orders");
  assert.ok(screen.includes("closeInAppBrowser"), "closes the lingering browser sheet");
  assert.ok(!screen.includes("status: \"paid\""), "must not write payment state client-side");
});

// ── Chunking discipline for the persist packages ────────────────────────
test("vite exempts the persist packages from web-preloaded vendor chunks", () => {
  const config = read("../vite.config.js");
  const persistIdx = config.indexOf("@tanstack/react-query-persist-client");
  const miscIdx = config.indexOf("return 'vendor-misc'");
  assert.ok(persistIdx > -1 && persistIdx < miscIdx, "persist exemption must precede vendor-misc catch-all");
  assert.ok(config.includes("@tanstack/query-sync-storage-persister"), "persister exempted too");
});

// ── Native lifecycle hygiene (003J) ─────────────────────────────────────
test("launch URL is latched — consumed at most once per session", () => {
  const src = read("../src/lib/native/deep-links.js");
  assert.ok(src.includes("launchUrlConsumed"), "module-scope latch must exist");
  const latchIdx = src.indexOf("if (launchUrlConsumed) return;");
  const consumeIdx = src.indexOf("App.getLaunchUrl()");
  assert.ok(latchIdx > -1 && consumeIdx > -1 && latchIdx < consumeIdx,
    "latch must guard getLaunchUrl so re-inits never re-navigate to the launch route");
});

test("bootstrap and runtime effects register listeners once, not per navigation", () => {
  const bootstrap = read("../src/components/NativeAppBootstrap.jsx");
  assert.ok(!bootstrap.includes("}, [navigate])"), "bootstrap must not re-run on navigate identity churn");
  assert.ok(bootstrap.includes("navigateRef"), "bootstrap reads the latest navigate via a ref");
  const runtime = read("../src/native/app/NativeRuntime.jsx");
  assert.ok(!runtime.includes("}, [navigate])"), "runtime must not re-register push listeners per navigation");
  assert.ok(runtime.includes("navigateRef"), "runtime reads the latest navigate via a ref");
});

test("awaited listener registration never orphans handles after cleanup", () => {
  for (const path of ["../src/lib/native/deep-links.js", "../src/lib/native/app-lifecycle.js", "../src/lib/native/push.js"]) {
    const src = read(path);
    assert.ok(src.includes("handle.remove()"), `${path} must remove handles created after cancellation`);
  }
});

test("persister unsubscribe is captured and called on cleanup", () => {
  const src = read("../src/lib/native/query-persistence.js");
  assert.ok(src.includes("const [stopPersistence, restorePromise]"), "unsubscribe must not be discarded");
  assert.ok(src.includes("stopPersistence?.()"), "cleanup must stop the persister subscription");
});

// ── Runtime wiring ──────────────────────────────────────────────────────
test("native runtime wires persistence, lifecycle and push-tap routing", () => {
  const runtime = read("../src/native/app/NativeRuntime.jsx");
  assert.ok(runtime.includes('import("@/lib/native/query-persistence.js")'), "persistence loads lazily");
  assert.ok(runtime.includes("initNativeLifecycle"));
  assert.ok(runtime.includes("resolvePushRoute"));
  const routes = read("../src/native/app/NativeAppRoutes.jsx");
  assert.ok(routes.includes("<NativeRuntime />"), "runtime mounted in the native tree");
});
