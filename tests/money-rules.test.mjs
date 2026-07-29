import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  orderTotals,
  computeGstCents,
  computeCardFeeCents,
  qualifiesForFreeShipping,
  cartFingerprint,
  toCents,
} from "../src/lib/money-rules.js";

const ADDED = { gst_enabled: true, gst_rate_percent: 6.5, gst_mode: "added" };
const ABSORBED = { gst_enabled: true, gst_rate_percent: 6.5, gst_mode: "absorbed" };

// ── GST ─────────────────────────────────────────────────────────────────
test("added GST is charged on top of goods and shipping", () => {
  const t = orderTotals({ subtotalCents: 10000, shippingCents: 1170, settings: ADDED });
  assert.equal(t.gstCents, Math.round(11170 * 0.065)); // 726
  assert.equal(t.gstIncluded, false);
  assert.equal(t.totalCents, 11170 + 726);
});

test("absorbed GST is the component already inside the price, not rate/100", () => {
  // The classic error: treating absorbed 6.5% on $100 as $6.50. It is
  // 100 x 6.5/106.5 = $6.10, because the $100 already contains the tax.
  assert.equal(computeGstCents(10000, ABSORBED), 610);
  assert.notEqual(computeGstCents(10000, ABSORBED), 650);

  const t = orderTotals({ subtotalCents: 10000, shippingCents: 0, settings: ABSORBED });
  assert.equal(t.gstIncluded, true);
  assert.equal(t.totalCents, 10000, "absorbing must not change what the customer pays");
});

test("GST can be switched off entirely", () => {
  const t = orderTotals({ subtotalCents: 5000, settings: { gst_enabled: false } });
  assert.equal(t.gstCents, 0);
  assert.equal(t.totalCents, 5000);
});

test("a missing or junk rate falls back to the default instead of collecting nothing", () => {
  assert.equal(computeGstCents(10000, { gst_rate_percent: undefined }), 650);
  assert.equal(computeGstCents(10000, { gst_rate_percent: -5 }), 650);
  assert.equal(computeGstCents(10000, { gst_rate_percent: "abc" }), 650);
});

// ── Card processing fee ─────────────────────────────────────────────────
const FEE_ON = (mode) => ({
  ...ADDED,
  card_fee_enabled: true,
  card_fee_percent: 1.75,
  card_fee_fixed_aud: 0.3,
  card_fee_mode: mode,
});

test("an added card fee is grossed up so it actually covers the Stripe cost", () => {
  // Naive: 1.75% of $100 + $0.30 = $2.05, total $102.05 — but Stripe then
  // charges 1.75% of $102.05 + $0.30 = $2.09, so the shop is 4c short.
  // Gross-up: (100 + 0.30) / (1 - 0.0175) = $102.09, fee $2.09.
  const fee = computeCardFeeCents(10000, FEE_ON("added"));
  assert.equal(fee, 209);

  // Verify it genuinely breaks even: Stripe's cut of the final total.
  const total = 10000 + fee;
  const stripeTakes = Math.round(total * 0.0175) + 30;
  assert.ok(fee >= stripeTakes, `fee ${fee} must cover Stripe's ${stripeTakes}`);
});

test("an absorbed card fee is disclosed but never charged", () => {
  const t = orderTotals({ subtotalCents: 10000, settings: FEE_ON("absorbed") });
  assert.ok(t.cardFeeCents > 0, "still reported so the shop can see the cost");
  assert.equal(t.cardFeeIncluded, true);
  const noFee = orderTotals({ subtotalCents: 10000, settings: ADDED });
  assert.equal(t.totalCents, noFee.totalCents, "absorbing must not change the total");
});

test("the card fee is off unless explicitly enabled", () => {
  const t = orderTotals({ subtotalCents: 10000, settings: ADDED });
  assert.equal(t.cardFeeCents, 0);
});

test("a nonsensical fee percent can never multiply the order", () => {
  const fee = computeCardFeeCents(10000, { card_fee_enabled: true, card_fee_percent: 100, card_fee_mode: "added" });
  assert.equal(fee, 0, "a 100% rate would divide by zero — must be refused");
});

test("both absorbed leaves the customer paying exactly the sticker price", () => {
  const settings = { ...ABSORBED, card_fee_enabled: true, card_fee_mode: "absorbed" };
  const t = orderTotals({ subtotalCents: 8999, shippingCents: 1170, settings });
  assert.equal(t.totalCents, 8999 + 1170);
  assert.ok(t.gstCents > 0 && t.cardFeeCents > 0, "both still reported for the books");
});

// ── Free shipping ───────────────────────────────────────────────────────
test("free shipping is decided on goods only, from the saved threshold", () => {
  const settings = { ...ADDED, free_shipping_threshold_aud: 150 };
  // Postage must not help the cart reach the threshold.
  assert.equal(qualifiesForFreeShipping(toCents(149), settings), false);
  assert.equal(qualifiesForFreeShipping(toCents(150), settings), true);

  const t = orderTotals({ subtotalCents: toCents(200), shippingCents: 1170, settings });
  assert.equal(t.shippingCents, 0);
  assert.equal(t.freeShippingApplied, true);
  // ...and the waived postage is not taxed either.
  assert.equal(t.gstCents, Math.round(toCents(200) * 0.065));
});

test("pickup carries no postage and no postage tax", () => {
  const t = orderTotals({ subtotalCents: 5000, shippingCents: 9999, settings: ADDED, isPickup: true });
  assert.equal(t.shippingCents, 0);
  assert.equal(t.totalCents, 5000 + Math.round(5000 * 0.065));
});

// ── Signed quotes ───────────────────────────────────────────────────────
test("the cart fingerprint ignores ordering but not contents", () => {
  const a = cartFingerprint([{ productId: "x", quantity: 1 }, { productId: "y", quantity: 2 }]);
  const b = cartFingerprint([{ productId: "y", quantity: 2 }, { productId: "x", quantity: 1 }]);
  assert.equal(a, b, "reordering the cart must not invalidate a quote");
  const c = cartFingerprint([{ productId: "x", quantity: 9 }, { productId: "y", quantity: 2 }]);
  assert.notEqual(a, c, "changing a quantity must invalidate it");
});

// ── Mirror check ────────────────────────────────────────────────────────
test("createCheckout carries the same money rules as this module", () => {
  const src = readFileSync(new URL("../supabase/functions/createCheckout/index.ts", import.meta.url), "utf8");
  for (const token of ["calculateTotals", "gstIncluded", "cardIncluded", "FLAT_DOMESTIC_SHIPPING_CENTS"]) {
    assert.ok(src.includes(token), `createCheckout must implement ${token}`);
  }
  // The gross-up divisor is the part most likely to be "simplified" into a bug.
  assert.ok(src.includes("1 - rate"), "card fee must stay grossed up server-side");
  assert.ok(!src.includes("verifyQuoteSignature"), "flat shipping must not depend on a carrier quote");
});
