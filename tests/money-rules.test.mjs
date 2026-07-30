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
  shippingModeSettings,
  computeFlatShippingCents,
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
  for (const token of [
    "calculateTotals",
    "gstIncluded",
    "cardIncluded",
    "freeShippingThresholdCents",
    "verifyQuoteSignature",
    "cartFingerprint(items)",
  ]) {
    assert.ok(src.includes(token), `createCheckout must implement ${token}`);
  }
  // The gross-up divisor is the part most likely to be "simplified" into a bug.
  assert.ok(src.includes("1 - rate"), "card fee must stay grossed up server-side");
  assert.ok(
    src.includes("merchandiseSubtotal < freeShippingThresholdCents"),
    "the signed PAC price must only be waived from the saved merchandise threshold",
  );
  assert.ok(!src.includes("FLAT_DOMESTIC_SHIPPING_CENTS"), "checkout must not silently replace PAC with a flat rate");
});

// ── Fixed (flat-rate) shipping ────────────────────────────────────────────
const FIXED = { shipping_mode: "fixed", shipping_flat_single_aud: 12.5, shipping_flat_multi_aud: 15.9 };
const phys = (n = 1, extra = {}) => ({ quantity: n, shipping_required: true, ...extra });

test("shippingModeSettings reads mode and clamps flat rates", () => {
  assert.equal(shippingModeSettings({ shipping_mode: "fixed" }).mode, "fixed");
  assert.equal(shippingModeSettings({}).mode, "calculated");
  assert.equal(shippingModeSettings({ shipping_mode: "nonsense" }).mode, "calculated");
  // Missing / malformed / out-of-range fall back to documented defaults, never 0.
  assert.equal(shippingModeSettings({}).flatSingleCents, 1250);
  assert.equal(shippingModeSettings({}).flatMultiCents, 1590);
  assert.equal(shippingModeSettings({ shipping_flat_single_aud: -5 }).flatSingleCents, 1250);
  assert.equal(shippingModeSettings({ shipping_flat_single_aud: 99999 }).flatSingleCents, 1250);
  assert.equal(shippingModeSettings({ shipping_flat_single_aud: 9 }).flatSingleCents, 900);
});

test("flat shipping: one item is the single rate, two or more is the multi rate", () => {
  assert.equal(computeFlatShippingCents([phys(1)], FIXED), 1250);
  assert.equal(computeFlatShippingCents([phys(2)], FIXED), 1590);          // qty 2 of one line
  assert.equal(computeFlatShippingCents([phys(1), phys(1)], FIXED), 1590); // two lines
});

test("flat shipping: a product flat override sets a floor and always counts as shippable", () => {
  // Membership alone: digital (shipping_required false) but carries a $15.90 override.
  const membership = { quantity: 1, shipping_required: false, flat_shipping_aud: 15.9 };
  assert.equal(computeFlatShippingCents([membership], FIXED), 1590);
  // Membership + a single tee → two units → multi, override matches.
  assert.equal(computeFlatShippingCents([membership, phys(1)], FIXED), 1590);
  // An override larger than the multi rate wins even for a single item.
  assert.equal(computeFlatShippingCents([{ quantity: 1, shipping_required: true, flat_shipping_aud: 25 }], FIXED), 2500);
});

test("flat shipping: an all-digital cart with no override ships nothing", () => {
  assert.equal(computeFlatShippingCents([{ quantity: 3, shipping_required: false }], FIXED), 0);
  assert.equal(computeFlatShippingCents([], FIXED), 0);
});

test("flat shipping still honours the free-shipping threshold via orderTotals", () => {
  // $200 of goods is over the $150 default threshold → postage waived to 0.
  const flat = computeFlatShippingCents([phys(2)], FIXED); // 1590
  const t = orderTotals({ subtotalCents: 20000, shippingCents: flat, settings: { ...FIXED, gst_enabled: false } });
  assert.equal(t.shippingCents, 0);
  assert.equal(t.freeShippingApplied, true);
  // Under the threshold the flat rate is charged.
  const u = orderTotals({ subtotalCents: 5000, shippingCents: flat, settings: { ...FIXED, gst_enabled: false } });
  assert.equal(u.shippingCents, 1590);
});

test("createCheckout mirrors the fixed-mode flat shipping path", () => {
  const src = readFileSync(new URL("../supabase/functions/createCheckout/index.ts", import.meta.url), "utf8");
  for (const token of ["computeFixedShippingCents", "shippingModeOf", "productShipsUnderMode", "shipping_flat_single_aud"]) {
    assert.ok(src.includes(token), `createCheckout must implement ${token}`);
  }
  // Fixed postage must still be gated by the free-shipping threshold.
  assert.ok(
    src.includes("merchandiseSubtotal < freeShippingThresholdCents"),
    "fixed postage must be waived from the same merchandise threshold",
  );
});
