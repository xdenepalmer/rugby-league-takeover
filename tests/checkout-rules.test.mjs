import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_CHECKOUT_QUANTITY,
  buildCheckoutLineItems,
  buildOrderMetadata,
  buildShippingLineItem,
  isAustralia,
  resolveFulfilment,
  calculateOrderTotalAud,
  getNextStockQuantity,
  isPaidSessionForOrder,
  normalizeCheckoutItems,
  resolveCheckoutCustomer,
  resolveCheckoutOrigin,
  shippingModeOf,
  productShipsUnderMode,
  computeFixedShippingCents,
} from "./checkout-rules.mjs";

test("normalizes cart quantities and removes malformed items", () => {
  const items = normalizeCheckoutItems([
    { productId: "shirt", quantity: "3" },
    { productId: "hat", quantity: 200 },
    { productId: "", quantity: 2 },
    { quantity: 1 },
  ]);

  assert.deepEqual(items, [
    { productId: "shirt", quantity: 3 },
    { productId: "hat", quantity: MAX_CHECKOUT_QUANTITY },
  ]);
});

test("builds line items only when products are active, priced, and in stock", () => {
  const productsById = new Map([
    ["shirt", { id: "shirt", name: "Vegas Shirt", price_aud: 49.95, stock_quantity: 5, is_active: true }],
    ["pin", { id: "pin", name: "Pin", price_aud: 10, stock_quantity: 0, is_active: true }],
  ]);

  const result = buildCheckoutLineItems(
    [
      { productId: "shirt", quantity: 2 },
      { productId: "pin", quantity: 1 },
    ],
    (id) => productsById.get(id)
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.match(result.error, /not enough stock/i);

  const success = buildCheckoutLineItems([{ productId: "shirt", quantity: 2 }], (id) => productsById.get(id));
  assert.equal(success.ok, true);
  assert.equal(success.lineItems[0].price_aud, 49.95);
  assert.equal(success.stripeLineItems[0].price_data.unit_amount, 4995);
  assert.equal(calculateOrderTotalAud(success.lineItems), 99.9);
});

test("resolves checkout redirects only to allowlisted origins", () => {
  const fallback = "https://rugbyleagetakeover.base44.app";
  const allowlist = "https://rugbyleagetakeover.com, https://www.rugbyleagetakeover.com";

  assert.equal(resolveCheckoutOrigin("https://www.rugbyleagetakeover.com", allowlist, fallback), "https://www.rugbyleagetakeover.com");
  assert.equal(resolveCheckoutOrigin("https://evil.example", allowlist, fallback), fallback);
  assert.equal(resolveCheckoutOrigin("not a url", allowlist, fallback), fallback);
});

test("falls back to signed-in customer details during checkout", () => {
  assert.deepEqual(
    resolveCheckoutCustomer({
      customerName: "",
      customerEmail: "",
      user: { full_name: "Dene Palmer", email: "dene@example.com" },
    }),
    { name: "Dene Palmer", email: "dene@example.com" }
  );

  assert.deepEqual(
    resolveCheckoutCustomer({
      customerName: " Guest ",
      customerEmail: " guest@example.com ",
      user: { full_name: "Dene Palmer", email: "dene@example.com" },
    }),
    { name: "Guest", email: "guest@example.com" }
  );
});

test("accepts paid webhook sessions only when order, amount, currency, app, and session match", () => {
  const order = {
    id: "order_123",
    total_aud: 99.9,
    stripe_session_id: "cs_live_123",
  };
  const metadata = buildOrderMetadata({ appId: "app_123", orderId: order.id, totalAud: order.total_aud });
  const session = {
    id: "cs_live_123",
    payment_status: "paid",
    amount_total: 9990,
    currency: "aud",
    metadata,
  };

  assert.equal(isPaidSessionForOrder(session, order, "app_123").ok, true);
  assert.equal(isPaidSessionForOrder({ ...session, amount_total: 9991 }, order, "app_123").ok, false);
  assert.equal(isPaidSessionForOrder({ ...session, metadata: { ...metadata, rlt_app_id: "other" } }, order, "app_123").ok, false);
  assert.equal(isPaidSessionForOrder({ ...session, payment_status: "unpaid" }, order, "app_123").ok, false);
});

test("builds a priced AusPost shipping line item and rejects missing rate selections", () => {
  const shipping = buildShippingLineItem({ code: "AUS_PARCEL_REGULAR", name: "Parcel Post", postcode: "4000", price_aud: 12.5 });
  assert.equal(shipping.price_aud, 12.5);
  assert.equal(shipping.stripeLineItem.price_data.unit_amount, 1250);
  assert.match(shipping.stripeLineItem.price_data.product_data.name, /Parcel Post/);

  // Free shipping: recorded on the order, but no Stripe charge for $0.
  const free = buildShippingLineItem({ code: "FREE", name: "Free Shipping", postcode: "4000", price_aud: 0 });
  assert.equal(free.price_aud, 0);
  assert.equal(free.stripeLineItem, null);

  assert.equal(buildShippingLineItem(undefined), null);
  assert.equal(buildShippingLineItem({ code: "X", name: "Y", postcode: "", price_aud: 5 }), null);
  assert.equal(buildShippingLineItem({ code: "X", name: "Y", postcode: "4000", price_aud: -1 }), null);
});

test("order total includes the selected shipping cost", () => {
  const productsById = new Map([
    ["shirt", { id: "shirt", name: "Vegas Shirt", price_aud: 49.95, stock_quantity: 5, is_active: true }],
  ]);
  const { lineItems } = buildCheckoutLineItems([{ productId: "shirt", quantity: 2 }], (id) => productsById.get(id));
  assert.equal(calculateOrderTotalAud(lineItems), 99.9);
  assert.equal(calculateOrderTotalAud(lineItems, 12.5), 112.4);
});

test("decrements stock without allowing negative inventory", () => {
  assert.equal(getNextStockQuantity({ stock_quantity: 5 }, 2), 3);
  assert.equal(getNextStockQuantity({ stock_quantity: 1 }, 3), 0);
  assert.equal(getNextStockQuantity({}, 3), null);
});

/* ── Vegas pickup fulfilment ───────────────────────────────────────────── */

test("shipping is refused for non-Australian orders", () => {
  const settings = { pickup_enabled: false, pickup_audience: "international" };
  const rate = { code: "AUS_PARCEL_REGULAR", name: "Parcel Post", postcode: "4000", price_aud: 12.5 };

  const overseas = resolveFulfilment({ method: "shipping", shipping: rate, country: "US", settings });
  assert.equal(overseas.ok, false);
  assert.match(overseas.error, /only ship within Australia/i);

  const domestic = resolveFulfilment({ method: "shipping", shipping: rate, country: "AU", settings });
  assert.equal(domestic.ok, true);
  assert.equal(domestic.method, "shipping");
  assert.equal(domestic.shipping.price_aud, 12.5);
});

test("an order can never check out without a fulfilment choice", () => {
  const settings = { pickup_enabled: true, pickup_audience: "everyone" };
  // shipping selected but no rate chosen
  assert.equal(resolveFulfilment({ method: "shipping", shipping: null, country: "AU", settings }).ok, false);
  // a bogus method is rejected rather than defaulting to free delivery
  assert.equal(resolveFulfilment({ method: "teleport", country: "AU", settings }).ok, false);
});

test("pickup obeys the admin toggle and its audience", () => {
  const rate = { code: "X", name: "Parcel", postcode: "4000", price_aud: 10 };

  // Collection can never be switched off for an overseas buyer: AusPost is
  // domestic-only, so it is their ONLY route. Turning the toggle off with a US
  // customer in the cart used to leave them unable to order at all.
  const off = { pickup_enabled: false, pickup_audience: "everyone" };
  assert.equal(resolveFulfilment({ method: "pickup", country: "US", settings: off }).ok, true);
  // ...but it still gates Australians, who have shipping available.
  assert.equal(resolveFulfilment({ method: "pickup", country: "AU", settings: off }).ok, false);

  // international-only → overseas yes, Australians no
  const intl = { pickup_enabled: true, pickup_audience: "international" };
  assert.equal(resolveFulfilment({ method: "pickup", country: "US", settings: intl }).ok, true);
  const auBlocked = resolveFulfilment({ method: "pickup", country: "AU", settings: intl });
  assert.equal(auBlocked.ok, false);
  assert.match(auBlocked.error, /international/i);

  // everyone → an Australian may collect instead of paying for shipping
  const all = { pickup_enabled: true, pickup_audience: "everyone" };
  const auPickup = resolveFulfilment({ method: "pickup", country: "AU", settings: all });
  assert.equal(auPickup.ok, true);
  assert.equal(auPickup.method, "pickup");
  assert.equal(auPickup.shipping, null, "pickup must not carry a shipping charge");

  // overseas customer gets pointed at collection instead of a dead end
  const nudge = resolveFulfilment({ method: "shipping", shipping: rate, country: "GB", settings: intl });
  assert.equal(nudge.ok, false);
  assert.match(nudge.error, /collection in Las Vegas/i);
});

test("Australia is recognised however the client spells it", () => {
  for (const c of ["AU", "au", "AUS", "Australia"]) assert.equal(isAustralia(c), true, c);
  for (const c of ["US", "NZ", "GB", ""]) assert.equal(isAustralia(c), false, c);
});

// ── Fixed (flat-rate) shipping — the amount actually charged, server-side ────
// These exercise the executable mirror of createCheckout's fixed-mode maths so
// the charged postage has behavioural coverage, not just a source-string grep.
const FIXED_SETTINGS = { shipping_mode: "fixed", shipping_flat_single_aud: 12.5, shipping_flat_multi_aud: 15.9 };
const bagProducts = () => new Map([
  ["tee", { id: "tee", shipping_required: true, flat_shipping_aud: null }],
  ["cap", { id: "cap", shipping_required: true, flat_shipping_aud: null }],
  ["membership", { id: "membership", shipping_required: false, flat_shipping_aud: 15.9 }],
  ["ebook", { id: "ebook", shipping_required: false, flat_shipping_aud: null }],
  ["freight", { id: "freight", shipping_required: true, flat_shipping_aud: 25 }],
]);

test("fixed shipping: single item is the single rate, two or more is the multi rate", () => {
  const p = bagProducts();
  assert.equal(computeFixedShippingCents([{ productId: "tee", quantity: 1 }], p, FIXED_SETTINGS), 1250);
  assert.equal(computeFixedShippingCents([{ productId: "tee", quantity: 2 }], p, FIXED_SETTINGS), 1590);
  assert.equal(computeFixedShippingCents([{ productId: "tee", quantity: 1 }, { productId: "cap", quantity: 1 }], p, FIXED_SETTINGS), 1590);
});

test("fixed shipping: the Membership Package override always ships at its flat rate, even alone/digital", () => {
  const p = bagProducts();
  // Digital membership (shipping_required false) alone → override floor, not free.
  assert.equal(computeFixedShippingCents([{ productId: "membership", quantity: 1 }], p, FIXED_SETTINGS), 1590);
  // Membership + a tee → two units → multi, matches the $15.90 override.
  assert.equal(computeFixedShippingCents([{ productId: "membership", quantity: 1 }, { productId: "tee", quantity: 1 }], p, FIXED_SETTINGS), 1590);
  // An override above the multi rate wins for a single item.
  assert.equal(computeFixedShippingCents([{ productId: "freight", quantity: 1 }], p, FIXED_SETTINGS), 2500);
});

test("fixed shipping: an all-digital cart with no override ships nothing", () => {
  const p = bagProducts();
  assert.equal(computeFixedShippingCents([{ productId: "ebook", quantity: 3 }], p, FIXED_SETTINGS), 0);
  assert.equal(computeFixedShippingCents([], p, FIXED_SETTINGS), 0);
});

test("fixed shipping: a per-product override is capped at $1000 like the store rates", () => {
  const p = new Map([["oops", { id: "oops", shipping_required: true, flat_shipping_aud: 999999 }]]);
  assert.equal(computeFixedShippingCents([{ productId: "oops", quantity: 1 }], p, FIXED_SETTINGS), 100000);
});

test("productShipsUnderMode treats an override as shippable only in fixed mode", () => {
  const membership = { shipping_required: false, flat_shipping_aud: 15.9 };
  assert.equal(productShipsUnderMode(membership, "fixed"), true);
  assert.equal(productShipsUnderMode(membership, "calculated"), false);
  assert.equal(productShipsUnderMode({ shipping_required: true }, "calculated"), true);
  assert.equal(shippingModeOf({ shipping_mode: "fixed" }), "fixed");
  assert.equal(shippingModeOf({}), "calculated");
});

test("fixed mode ships a physical AU cart with NO client quote; calculated mode still demands one", () => {
  const settings = { pickup_enabled: false };
  // Fixed: no signed quote, still resolves to shipping.
  const fixed = resolveFulfilment({ method: "shipping", shipping: null, country: "AU", settings, shippingMode: "fixed" });
  assert.equal(fixed.ok, true);
  assert.equal(fixed.method, "shipping");
  assert.equal(fixed.shipping, null);
  // Calculated: a missing quote is refused.
  const calc = resolveFulfilment({ method: "shipping", shipping: null, country: "AU", settings, shippingMode: "calculated" });
  assert.equal(calc.ok, false);
  // Fixed mode still refuses non-AU shipping and still honours pickup rules.
  const overseas = resolveFulfilment({ method: "shipping", shipping: null, country: "US", settings, shippingMode: "fixed" });
  assert.equal(overseas.ok, false);
});
