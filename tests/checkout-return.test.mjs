import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isValidStripeSessionId,
  resolveCheckoutConfirmation,
  shouldClearCart,
  wasCartClearedFor,
  markCartClearedFor,
  PAID_ORDER_STATUSES,
} from "../src/lib/checkout-return.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Session-id validation (foreign/hostile ids rejected) ───────────────
test("stripe session ids validate strictly", () => {
  assert.equal(isValidStripeSessionId("cs_test_a1B2c3D4e5F6g7H8i9J0"), true);
  assert.equal(isValidStripeSessionId("cs_live_a1B2c3D4e5F6g7H8i9J0"), true);
  assert.equal(isValidStripeSessionId(""), false);
  assert.equal(isValidStripeSessionId(null), false);
  assert.equal(isValidStripeSessionId("cs_test_short"), false);
  assert.equal(isValidStripeSessionId("pi_3ABC123_secret_xyz"), false);
  assert.equal(isValidStripeSessionId("cs_test_abc$(rm -rf)"), false);
  assert.equal(isValidStripeSessionId(`cs_test_${"a".repeat(300)}`), false, "length bounded");
});

// ── Verification → confirmation state ───────────────────────────────────
test("only Stripe payment_status can confirm — order status never overrides", () => {
  assert.equal(resolveCheckoutConfirmation({ paymentStatus: "paid" }), "confirmed");
  assert.equal(resolveCheckoutConfirmation({ paymentStatus: "no_payment_required" }), "confirmed");
  // The unsafe override is GONE: a webhook-written paid-like order status must
  // NOT confirm a checkout return while Stripe still reports the session unpaid.
  for (const orderStatus of PAID_ORDER_STATUSES) {
    assert.equal(
      resolveCheckoutConfirmation({ paymentStatus: "unpaid", orderStatus }),
      "unverified",
      `unpaid Stripe + order '${orderStatus}' must NOT confirm (Stripe is exclusive)`
    );
    assert.equal(
      resolveCheckoutConfirmation({ paymentStatus: "unpaid", orderStatus, sessionStatus: "complete" }),
      "pending",
      `unpaid+complete stays pending regardless of order '${orderStatus}'`
    );
  }
  assert.equal(
    resolveCheckoutConfirmation({ paymentStatus: "unpaid", sessionStatus: "complete" }),
    "pending",
    "async payment settling"
  );
  assert.equal(resolveCheckoutConfirmation({ paymentStatus: "unpaid", sessionStatus: "expired" }), "cancelled");
  assert.equal(resolveCheckoutConfirmation({ paymentStatus: "unpaid", sessionStatus: "open" }), "unverified");
  assert.equal(resolveCheckoutConfirmation(null), "unverified");
  assert.equal(resolveCheckoutConfirmation("paid"), "unverified", "string result is not trusted");
  assert.equal(resolveCheckoutConfirmation({}), "unverified");
});

test("the cart clears exactly once and only on verified payment", () => {
  assert.equal(shouldClearCart("confirmed", false), true);
  assert.equal(shouldClearCart("confirmed", true), false, "already cleared → never again");
  assert.equal(shouldClearCart("pending", false), false, "pending keeps the cart");
  assert.equal(shouldClearCart("cancelled", false), false);
  assert.equal(shouldClearCart("unverified", false), false, "URL alone can never clear the cart");
  assert.equal(shouldClearCart("confirming", false), false);
});

test("exactly-once marker is per-session and fail-safe", () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(wasCartClearedFor("cs_test_abc", storage), false);
  markCartClearedFor("cs_test_abc", storage);
  assert.equal(wasCartClearedFor("cs_test_abc", storage), true);
  assert.equal(wasCartClearedFor("cs_test_other", storage), false);
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(wasCartClearedFor("cs_test_abc", broken), false);
  markCartClearedFor("cs_test_abc", broken); // must not throw
});

// ── Server contracts ────────────────────────────────────────────────────
test("createCheckout builds canonical, verifiable return URLs", () => {
  const fn = read("../supabase/functions/createCheckout/index.ts");
  assert.ok(fn.includes("/store/checkout/success?session_id={CHECKOUT_SESSION_ID}"), "success URL carries the session id");
  assert.ok(fn.includes("/store/checkout/cancel"), "cancel URL is canonical");
  assert.ok(!fn.includes("`${origin}/store?success=true`"), "legacy success URL removed");
  assert.ok(fn.includes("buildOrderMetadata"), "order metadata retained for the webhook + verifier");
});

test("createCheckout fails closed when the session-id bind can't be written", () => {
  const fn = read("../supabase/functions/createCheckout/index.ts");
  // The update error must be inspected before the URL is returned.
  assert.ok(/const \{ error: bindError \}[\s\S]*?\.update\(\{ stripe_session_id/.test(fn), "bind error is captured");
  const bindIdx = fn.indexOf("bindError");
  const returnUrlIdx = fn.indexOf("return json({ url: session.url })");
  assert.ok(bindIdx > -1 && returnUrlIdx > -1 && bindIdx < returnUrlIdx, "bind error is checked before returning the URL");
  // On failure the session is expired and no payable URL is returned.
  assert.ok(fn.includes("sessions.expire(session.id)"), "unbound session is expired");
  assert.ok(/if \(bindError\)[\s\S]*?return json\(\{ error:[\s\S]*?\}, 500\)/.test(fn), "bind failure returns an error, not a checkout URL");
});

test("verifyCheckoutReturn verifies server-side and leaks nothing", () => {
  const fn = read("../supabase/functions/verifyCheckoutReturn/index.ts");
  assert.ok(fn.includes("SESSION_ID_PATTERN"), "session id validated before any lookup");
  const dbBindIdx = fn.indexOf(".eq('stripe_session_id', id)");
  const stripeIdx = fn.indexOf("sessions.retrieve");
  assert.ok(dbBindIdx > -1, "order looked up by the exact session id (bind #1)");
  assert.ok(stripeIdx > -1, "asks Stripe, not the client");
  assert.ok(dbBindIdx < stripeIdx, "DB bind must precede the Stripe call (anti-amplification: unknown ids 404 for free)");
  assert.ok(fn.includes("rlt_app_id"), "foreign apps' sessions rejected");
  assert.ok(fn.includes("metadata?.order_id"), "session metadata must point back at the same order (bind #2)");
  assert.ok(!fn.includes("customer_email"), "no PII in the response");
  assert.ok(!fn.includes("update("), "read-only — the webhook stays the only writer");
});

// ── Shared verification hook (one policy for web + native) ───────────────
test("the shared checkout-return hook never trusts the URL", () => {
  const hook = read("../src/hooks/use-checkout-return.js");
  assert.ok(hook.includes('invoke("verifyCheckoutReturn"'), "verification is mandatory");
  assert.ok(hook.includes("resolveCheckoutConfirmation"), "shared policy applied");
  assert.ok(hook.includes("shouldClearCart"), "cart clearing goes through the policy");
  assert.ok(hook.includes("wasCartClearedFor") && hook.includes("markCartClearedFor"), "exactly-once across remounts");
  const clears = hook.split("writeCart([])").length - 1;
  assert.equal(clears, 1, "a single, guarded cart-clear call site for BOTH platforms");
});

test("a missing session id is deploy skew, not a failure", () => {
  const hook = read("../src/hooks/use-checkout-return.js");
  assert.ok(hook.includes("confirming_offline"), "soft state exists for returns without a session id");
  const missingIdx = hook.indexOf("if (!sessionId)");
  const invalidIdx = hook.indexOf("if (!isValidStripeSessionId(sessionId))");
  assert.ok(missingIdx > -1 && invalidIdx > -1 && missingIdx < invalidIdx,
    "missing session id (old createCheckout deploy) is checked before invalid → soft copy, never red");
});

test("both return screens drive their UI from the shared hook", () => {
  const nativeScreen = read("../src/native/screens/store/NativeCheckoutReturnScreen.jsx");
  const webPage = read("../src/pages/CheckoutReturn.jsx");
  for (const [name, src] of [["native screen", nativeScreen], ["web page", webPage]]) {
    assert.ok(src.includes("useCheckoutReturn"), `${name} uses the shared hook`);
    assert.ok(src.includes("Confirming your payment"), `${name} has the confirming state`);
    assert.ok(!src.includes("Payment received"), `${name} has no unconditional success copy`);
    // The screens are presentation only — the single guarded cart-clear lives
    // in the hook, never re-implemented per screen.
    assert.ok(!src.includes("writeCart(["), `${name} does not clear the cart itself`);
  }
});

test("the web checkout return is verified, not a URL-trusting banner", () => {
  const app = read("../src/App.jsx");
  assert.ok(app.includes('element={<CheckoutReturn status="success" />}'), "success route renders the verified page");
  assert.ok(app.includes('element={<CheckoutReturn status="cancel" />}'), "cancel route renders the verified page");
  assert.ok(!app.includes('to="/store?success=true"'), "legacy URL-trust success alias removed");

  // Store.jsx hands legacy deploy-skew returns (?success=true from an older
  // createCheckout) to the verified pipeline instead of rendering silence —
  // and never clears the cart or claims success from the URL itself.
  const store = read("../src/pages/Store.jsx");
  assert.ok(store.includes('navigate("/store/checkout/success"'), "legacy ?success=true redirects into the verified return page");
  assert.ok(store.includes('navigate("/store/checkout/cancel"'), "legacy ?cancelled=true redirects into the verified cancel page");
  assert.ok(!store.includes("Order Placed Successfully"), "store no longer shows an unverified success banner");
  assert.ok(!store.includes('removeItem("rlt_cart")'), "store no longer clears the cart from the URL");
  // Native mirrors the same shim (NativeStoreScreen) — one pipeline everywhere.
  const nativeStore = read("../src/native/screens/store/NativeStoreScreen.jsx");
  assert.ok(nativeStore.includes('navigate("/store/checkout/success"'), "native store redirects legacy returns too");
});
