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
test("payment truth maps to confirmation states", () => {
  assert.equal(resolveCheckoutConfirmation({ paymentStatus: "paid" }), "confirmed");
  assert.equal(resolveCheckoutConfirmation({ paymentStatus: "no_payment_required" }), "confirmed");
  for (const orderStatus of PAID_ORDER_STATUSES) {
    assert.equal(
      resolveCheckoutConfirmation({ paymentStatus: "unpaid", orderStatus }),
      "confirmed",
      `webhook-written ${orderStatus} confirms`
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

test("verifyCheckoutReturn verifies server-side and leaks nothing", () => {
  const fn = read("../supabase/functions/verifyCheckoutReturn/index.ts");
  assert.ok(fn.includes("SESSION_ID_PATTERN"), "session id validated before Stripe call");
  assert.ok(fn.includes("rlt_app_id"), "foreign apps' sessions rejected");
  assert.ok(fn.includes("stripe_session_id === id"), "order double-bound to the session");
  assert.ok(fn.includes("sessions.retrieve"), "asks Stripe, not the client");
  assert.ok(!fn.includes("customer_email"), "no PII in the response");
  assert.ok(!fn.includes("update("), "read-only — the webhook stays the only writer");
});

// ── Screen contract ─────────────────────────────────────────────────────
test("native return screen never trusts the URL", () => {
  const screen = read("../src/native/screens/store/NativeCheckoutReturnScreen.jsx");
  assert.ok(screen.includes('invoke("verifyCheckoutReturn"'), "verification is mandatory");
  assert.ok(screen.includes("resolveCheckoutConfirmation"), "shared policy applied");
  assert.ok(screen.includes("shouldClearCart"), "cart clearing goes through the policy");
  assert.ok(screen.includes("wasCartClearedFor") && screen.includes("markCartClearedFor"), "exactly-once across remounts");
  assert.ok(screen.includes("Confirming your payment"), "confirming state exists");
  assert.ok(!screen.includes("Payment received"), "no unconditional success copy");
  const clears = screen.split("writeCart([])").length - 1;
  assert.equal(clears, 1, "a single, guarded cart-clear call site");
});

test("web keeps its legacy banner flow via the alias routes", () => {
  const app = read("../src/App.jsx");
  assert.ok(app.includes('path="/store/checkout/success"'));
  assert.ok(app.includes('to="/store?success=true"'), "web alias → existing banner behavior");
});
