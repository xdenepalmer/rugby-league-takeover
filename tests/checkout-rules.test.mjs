import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_CHECKOUT_QUANTITY,
  buildCheckoutLineItems,
  buildOrderMetadata,
  calculateOrderTotalAud,
  getNextStockQuantity,
  isPaidSessionForOrder,
  normalizeCheckoutItems,
  resolveCheckoutCustomer,
  resolveCheckoutOrigin,
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
  assert.equal(isPaidSessionForOrder({ ...session, metadata: { ...metadata, base44_app_id: "other" } }, order, "app_123").ok, false);
  assert.equal(isPaidSessionForOrder({ ...session, payment_status: "unpaid" }, order, "app_123").ok, false);
});

test("decrements stock without allowing negative inventory", () => {
  assert.equal(getNextStockQuantity({ stock_quantity: 5 }, 2), 3);
  assert.equal(getNextStockQuantity({ stock_quantity: 1 }, 3), 0);
  assert.equal(getNextStockQuantity({}, 3), null);
});
