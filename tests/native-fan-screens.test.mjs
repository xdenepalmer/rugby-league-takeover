import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  articlePath,
  findArticle,
  readingTimeMinutes,
  relatedArticles,
  getSavedArticleIds,
  toggleSavedArticle,
} from "../src/lib/news-articles.js";
import {
  normalizeSizeVariants,
  maxQuantityFor,
  productPath,
  galleryItemPath,
  formatAud,
} from "../src/lib/store-products.js";
import {
  addItemToCart,
  setCartItemQuantity,
  removeCartItem,
  cartQuantity,
  cartSubtotalAud,
  cartItemIdFor,
} from "../src/lib/cart-store.js";
import {
  resolveDragEnd,
  clampZoom,
  pointerDistance,
  adjacentIndices,
} from "../src/native/screens/gallery/gallery-gestures.js";
import { nativeAliasFor, ACCOUNT_TAB_ROUTES } from "../src/native/navigation/native-aliases.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Canonical share/deep-link URLs ──────────────────────────────────────
test("share targets are per-entity canonical routes", () => {
  const share = read("../src/lib/native/share.js");
  assert.ok(share.includes("/news/${encodeURIComponent(article.id)}"), "articles share /news/:id");
  assert.ok(share.includes("/forum/thread/${encodeURIComponent(thread.id)}"), "threads share /forum/thread/:id");
  assert.ok(share.includes("/store/product/${encodeURIComponent(product.id)}"), "products share /store/product/:id");
  assert.ok(share.includes("/gallery?item=${encodeURIComponent(item.id)}"), "gallery shares ?item=");
});

test("article helpers", () => {
  assert.equal(articlePath({ id: "abc 1" }), "/news/abc%201");
  assert.equal(articlePath(null), "/news");
  const list = [
    { id: "1", category: "Vegas", is_published: true },
    { id: "2", category: "Vegas" },
    { id: "3", category: "Team" },
    { id: "4", category: "Vegas", is_published: false },
  ];
  assert.equal(findArticle(list, "3").id, "3");
  assert.equal(findArticle(list, "nope"), null);
  const rel = relatedArticles(list, list[0], 2).map((a) => a.id);
  assert.deepEqual(rel, ["2", "3"], "same category first, unpublished excluded");
  assert.equal(readingTimeMinutes("word ".repeat(660)), 3);
  assert.equal(readingTimeMinutes(""), 1);
});

test("article bookmarks are bounded MRU and fail-safe", () => {
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
  };
  assert.equal(toggleSavedArticle("a", storage), true);
  assert.equal(toggleSavedArticle("b", storage), true);
  assert.deepEqual(getSavedArticleIds(storage), ["b", "a"]);
  assert.equal(toggleSavedArticle("a", storage), false);
  assert.deepEqual(getSavedArticleIds(storage), ["b"]);
  const broken = { getItem: () => "{corrupt", setItem: () => {} };
  assert.deepEqual(getSavedArticleIds(broken), []);
});

// ── Store product rules ─────────────────────────────────────────────────
test("size variants normalize like the web store", () => {
  assert.deepEqual(normalizeSizeVariants(["S", { size: "M", stock_quantity: 4 }, { size: " " }, null]), [
    { size: "S", stock_quantity: 0 },
    { size: "M", stock_quantity: 4 },
  ]);
  assert.deepEqual(normalizeSizeVariants(undefined), []);
});

test("maxQuantityFor: per-size stock wins, capped at 20, coming-soon blocked", () => {
  const product = { id: "p", stock_quantity: 50, sizes: [{ size: "M", stock_quantity: 3 }] };
  assert.equal(maxQuantityFor(product, "M"), 3);
  assert.equal(maxQuantityFor(product), 20, "total stock capped at 20");
  assert.equal(maxQuantityFor({ ...product, stock_quantity: 0 }, undefined), 0);
  assert.equal(maxQuantityFor({ ...product, coming_soon: true }, "M"), 0);
  assert.equal(maxQuantityFor(null), 0);
});

test("product/gallery paths and aud formatting", () => {
  assert.equal(productPath({ id: "x/1" }), "/store/product/x%2F1");
  assert.equal(galleryItemPath({ id: "g1" }), "/gallery?item=g1");
  assert.equal(formatAud(45), "$45");
  assert.equal(formatAud(45.5), "$45.50");
});

// ── Cart contract ───────────────────────────────────────────────────────
test("addItemToCart respects stock, merges lines and keeps the item shape", () => {
  const product = { id: "p1", name: "Jersey", price_aud: 120, image_url: "x.jpg", stock_quantity: 10, sizes: [{ size: "M", stock_quantity: 2 }] };
  let { cart, outcome } = addItemToCart([], product, "M");
  assert.equal(outcome, "added");
  assert.deepEqual(Object.keys(cart[0]).sort(), ["cartItemId", "id", "image_url", "name", "price_aud", "quantity", "size", "stock_quantity"].sort());
  assert.equal(cart[0].cartItemId, cartItemIdFor("p1", "M"));
  ({ cart, outcome } = addItemToCart(cart, product, "M"));
  assert.equal(cart[0].quantity, 2);
  ({ cart, outcome } = addItemToCart(cart, product, "M"));
  assert.equal(outcome, "limit", "size stock (2) caps the line");
  assert.equal(addItemToCart([], { ...product, coming_soon: true }, "M").outcome, "unavailable");
});

test("cart quantity/subtotal/update/remove", () => {
  const cart = [
    { cartItemId: "a", price_aud: 10, quantity: 2 },
    { cartItemId: "b", price_aud: 5.5, quantity: 1 },
  ];
  assert.equal(cartQuantity(cart), 3);
  assert.equal(cartSubtotalAud(cart), 25.5);
  assert.equal(setCartItemQuantity(cart, "a", 99, 4)[0].quantity, 4, "clamped to max");
  assert.equal(setCartItemQuantity(cart, "a", 0)[0].quantity, 1, "min 1");
  assert.equal(removeCartItem(cart, "a").length, 1);
});

// ── Gallery gestures ────────────────────────────────────────────────────
test("drag resolution: swipe, dismiss, zoomed pan", () => {
  assert.equal(resolveDragEnd({ dx: -120, dy: 10 }), "next");
  assert.equal(resolveDragEnd({ dx: 120, dy: -20 }), "prev");
  assert.equal(resolveDragEnd({ dx: 10, dy: 160 }), "dismiss");
  assert.equal(resolveDragEnd({ dx: 8, dy: 8 }), null, "small drags do nothing");
  assert.equal(resolveDragEnd({ dx: -200, dy: 0, zoom: 2 }), null, "zoomed images pan, not navigate");
  assert.equal(resolveDragEnd({ dx: 100, dy: 95 }), null, "ambiguous diagonals do nothing");
});

test("zoom clamp + pinch distance + prefetch neighbours", () => {
  assert.equal(clampZoom(9), 4);
  assert.equal(clampZoom(0.2), 1);
  assert.equal(clampZoom(NaN), 1);
  assert.equal(pointerDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.deepEqual(adjacentIndices(0, 5), [4, 1]);
  assert.deepEqual(adjacentIndices(4, 5), [3, 0]);
  assert.deepEqual(adjacentIndices(0, 2), [1], "two items → single neighbour");
  assert.deepEqual(adjacentIndices(0, 1), []);
});

// ── Legacy aliases ──────────────────────────────────────────────────────
test("native aliases normalize legacy query-param URLs", () => {
  assert.equal(nativeAliasFor({ pathname: "/forum", search: "?thread=abc" }), "/forum/thread/abc");
  assert.equal(nativeAliasFor({ pathname: "/forum", search: "" }), null);
  assert.equal(nativeAliasFor({ pathname: "/store", search: "?product=p1" }), "/store/product/p1");
  assert.equal(nativeAliasFor({ pathname: "/store", search: "?success=true" }), null, "checkout params are not aliases");
  assert.equal(nativeAliasFor({ pathname: "/account", search: "?tab=orders" }), "/account/orders");
  assert.equal(nativeAliasFor({ pathname: "/account", search: "?tab=fanhub" }), null, "hub tab stays on the hub");
  assert.equal(nativeAliasFor({ pathname: "/account", search: "?tab=bogus" }), null);
  for (const route of Object.values(ACCOUNT_TAB_ROUTES)) {
    assert.ok(route.startsWith("/account"), `${route} under /account`);
  }
});

test("alias resolution is centralized in the shell (one live implementation)", () => {
  const shell = read("../src/native/app/NativePublicShell.jsx");
  assert.ok(shell.includes("nativeAliasFor"), "NativePublicShell resolves aliases at runtime");
  const forum = read("../src/native/screens/forum/NativeForumScreen.jsx");
  assert.ok(!forum.includes('get("thread")'), "forum screen has no inline alias effect");
  const account = read("../src/native/screens/account/NativeAccountScreen.jsx");
  assert.ok(!account.includes('get("tab")'), "account screen has no inline alias effect");
});

// ── Native auth escape hatch ────────────────────────────────────────────
test("auth screens carry a native close affordance back to home", () => {
  const routes = read("../src/native/app/NativeAppRoutes.jsx");
  for (const page of ["<Login />", "<Register />", "<ForgotPassword />", "<ResetPassword />"]) {
    assert.ok(routes.includes(`<NativeAuthFrame>${page}</NativeAuthFrame>`), `${page} wrapped in NativeAuthFrame`);
  }
  const frame = read("../src/native/components/NativeAuthFrame.jsx");
  assert.ok(frame.includes('navigate("/")'), "close returns to the home tab");
  assert.ok(frame.includes("aria-label"), "close affordance is labelled");
});

// ── News deep-link parity ───────────────────────────────────────────────
test("article screen falls back to a by-id fetch like the web page", () => {
  const screen = read("../src/native/screens/news/NativeArticleScreen.jsx");
  assert.ok(screen.includes("NewsArticle.get(id)"), "by-id fetch for articles beyond the newest-50 list");
  assert.ok(screen.includes("!listArticle"), "by-id fetch only runs when the list misses");
});

// ── Notification links + reply titles ───────────────────────────────────
test("notification taps only navigate canonical-host links", () => {
  const screen = read("../src/native/screens/account/NativeNotificationsScreen.jsx");
  assert.ok(screen.includes("mapUrlToRoute"), "same host policy as universal links");
  assert.ok(!screen.includes("url.pathname"), "no raw pathname navigation for foreign URLs");
});

test("native replies carry thread context in the title (web parity)", () => {
  const thread = read("../src/native/screens/forum/NativeThreadScreen.jsx");
  assert.ok(thread.includes('`Re: ${thread.title || "Discussion Thread"}`'), "Re: <thread title> like Forum.jsx");
  const mod = read("../src/native/admin/workflows/NativeModerationWorkflow.jsx");
  assert.ok(mod.includes('/^(Reply$|Re: )/'), "moderation hides both native and web reply titles");
});

// ── Route/source contracts ──────────────────────────────────────────────
test("native tree exposes the canonical detail routes", () => {
  const routes = read("../src/native/app/NativeAppRoutes.jsx");
  for (const path of ['path="/news/:id"', 'path="/forum/thread/:id"', 'path="/store/product/:id"', 'path="/account/notifications"']) {
    assert.ok(routes.includes(path), `missing ${path}`);
  }
  assert.ok(!routes.includes("PublicLayout"), "native tree must not use the web layout");
});

test("web tree gained the same canonical routes without losing pages", () => {
  const app = read("../src/App.jsx");
  for (const path of ['path="/news/:id"', 'path="/forum/thread/:id"', 'path="/store/product/:id"']) {
    assert.ok(app.includes(path), `missing web ${path}`);
  }
  assert.ok(app.includes("ForumThreadRedirect"), "web /forum/thread/:id aliases to ?thread=");
  assert.ok(app.includes('path="/forum"'), "web forum page retained");
});

test("thread screen marks read, counts views once and drafts per thread", () => {
  const screen = read("../src/native/screens/forum/NativeThreadScreen.jsx");
  assert.ok(screen.includes("markThreadRead"), "unread tracking");
  assert.ok(screen.includes("recordThreadView"), "session-deduped view count");
  assert.ok(screen.includes("rlt_native_reply_draft_"), "per-thread draft key");
});

test("native cart checkout stays server-authoritative", () => {
  const sheet = read("../src/native/screens/store/NativeCartSheet.jsx");
  assert.ok(sheet.includes('invoke("createCheckout"'), "uses the createCheckout contract");
  assert.ok(sheet.includes('invoke("auspostRates"'), "live shipping rates");
  assert.ok(sheet.includes("openExternalUrl"), "system-browser handoff");
  assert.ok(!sheet.includes("success_url"), "client must not dictate redirect URLs");
})
