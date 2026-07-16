import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_CHECKOUT_QUANTITY,
  buildCheckoutLineItems,
  buildOrderMetadata,
  buildShippingLineItem,
  calculateOrderTotalAud,
  classifyCheckoutSession,
  getNextStockQuantity,
  isPaidSessionForOrder,
  normalizeCheckoutItems,
  resolveCheckoutCustomer,
  resolveCheckoutOrigin,
  validateStripeRefundAmount,
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

test("classifies webhook sessions as paid / pending / reject so async methods never retry-storm", () => {
  const order = { id: "order_123", total_aud: 99.9, stripe_session_id: "cs_live_123" };
  const metadata = buildOrderMetadata({ appId: "app_123", orderId: order.id, totalAud: order.total_aud });
  const session = { id: "cs_live_123", payment_status: "paid", amount_total: 9990, currency: "aud", metadata };

  assert.equal(classifyCheckoutSession(session, order, "app_123").outcome, "paid");
  // 100%-covered sessions confirm exactly like the return screens do.
  assert.equal(classifyCheckoutSession({ ...session, payment_status: "no_payment_required" }, order, "app_123").outcome, "paid");
  // Bindings hold but an async method (bank debit) hasn't settled: PENDING —
  // acknowledged with a 2xx, never 400d (Stripe would retry for days).
  assert.equal(classifyCheckoutSession({ ...session, payment_status: "unpaid" }, order, "app_123").outcome, "pending");
  // Binding/amount mismatches stay hard rejects regardless of payment state.
  assert.equal(classifyCheckoutSession({ ...session, amount_total: 9991 }, order, "app_123").outcome, "reject");
  assert.equal(classifyCheckoutSession({ ...session, id: "cs_live_other" }, order, "app_123").outcome, "reject");
  assert.equal(classifyCheckoutSession({ ...session, metadata: { ...metadata, order_id: "other" } }, order, "app_123").outcome, "reject");
  assert.equal(classifyCheckoutSession({ ...session, currency: "usd" }, order, "app_123").outcome, "reject");
  assert.equal(classifyCheckoutSession(session, null, "app_123").outcome, "reject");
});

test("server refund validation rounds to cents first and caps at the remaining balance", () => {
  // Cents-first rounding: 0.004 would record $0.00 — rejected.
  assert.equal(validateStripeRefundAmount(0.004, 100).ok, false);
  assert.equal(validateStripeRefundAmount("abc", 100).ok, false);
  assert.equal(validateStripeRefundAmount(-5, 100).ok, false);

  const full = validateStripeRefundAmount(99.9, 99.9);
  assert.equal(full.ok, true);
  assert.equal(full.amountAud, 99.9);
  assert.equal(full.amountCents, 9990);

  // A sub-cent overshoot rounds DOWN into validity, never over the total.
  assert.equal(validateStripeRefundAmount(99.901, 99.9).ok, true);
  assert.equal(validateStripeRefundAmount(99.91, 99.9).ok, false);

  // Partial refunds shrink what remains refundable.
  assert.equal(validateStripeRefundAmount(50, 99.9, 60).ok, false);
  const partial = validateStripeRefundAmount(39.9, 99.9, 60);
  assert.equal(partial.ok, true);
  assert.equal(partial.amountCents, 3990);
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
