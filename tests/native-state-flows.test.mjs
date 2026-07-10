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
test("persistence denylist protects admin/PII surfaces", async () => {
  const src = read("../src/lib/native/query-persistence.js");
  for (const key of ["orders", "registrations", "users", "bans", "invites", "adminAttention", "myOrders"]) {
    assert.ok(src.includes(`"${key}"`), `denylist must include ${key}`);
  }
  assert.ok(src.includes("shouldDehydrateQuery"), "denylist must be enforced at dehydrate time");
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
  const denyMatch = src.match(/export const PERSIST_DENYLIST = \[([\s\S]*?)\]/);
  const denylist = denyMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
  const shouldPersistQuery = new Function(
    "queryKey",
    "state",
    `const PERSIST_DENYLIST = ${JSON.stringify(denylist)};
     ${match[0].replace("export function shouldPersistQuery", "function shouldPersistQuery")}
     return shouldPersistQuery(queryKey, state);`
  );
  assert.equal(shouldPersistQuery(["news"], { status: "success" }), true);
  assert.equal(shouldPersistQuery(["orders"], { status: "success" }), false);
  assert.equal(shouldPersistQuery(["notifications", "u1"], { status: "success" }), true);
  assert.equal(shouldPersistQuery(["news"], { status: "error" }), false, "only successful queries persist");
  assert.equal(shouldPersistQuery(["myOrders", "a@b.c"], { status: "success" }), false);
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

// ── Runtime wiring ──────────────────────────────────────────────────────
test("native runtime wires persistence, lifecycle and push-tap routing", () => {
  const runtime = read("../src/native/app/NativeRuntime.jsx");
  assert.ok(runtime.includes('import("@/lib/native/query-persistence.js")'), "persistence loads lazily");
  assert.ok(runtime.includes("initNativeLifecycle"));
  assert.ok(runtime.includes("resolvePushRoute"));
  const routes = read("../src/native/app/NativeAppRoutes.jsx");
  assert.ok(routes.includes("<NativeRuntime />"), "runtime mounted in the native tree");
});
