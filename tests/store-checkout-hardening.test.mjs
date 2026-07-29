import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CHECKOUT_REQUEST_ID_STORAGE_KEY,
  createCheckoutRequestId,
  getOrCreateCheckoutRequestId,
  isCheckoutRequestId,
  trustedCheckoutName,
} from "../src/lib/store-checkout.js";

test("checkout request IDs are valid and retained across retries", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  const bytesCrypto = {
    getRandomValues(bytes) {
      bytes.fill(7);
      return bytes;
    },
  };
  const first = getOrCreateCheckoutRequestId(storage, bytesCrypto);
  const second = getOrCreateCheckoutRequestId(storage, { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
  assert.equal(first, second);
  assert.equal(values.get(CHECKOUT_REQUEST_ID_STORAGE_KEY), first);
  assert.equal(isCheckoutRequestId(first), true);
});

test("checkout request ID has a standards-shaped fallback for old WebViews", () => {
  assert.equal(isCheckoutRequestId(createCheckoutRequestId({})), true);
});

test("email-local placeholders are never prefilled as delivery names", () => {
  assert.equal(trustedCheckoutName({ email: "t_mace@hotmail.com", full_name: "t_mace" }), "");
  assert.equal(trustedCheckoutName({ email: "deneop24@gmail.com", full_name: "deneop24" }), "");
  assert.equal(trustedCheckoutName({ email: "review@example.com", full_name: "googleplayreview", username: "googleplayreview" }), "");
  assert.equal(trustedCheckoutName({ email: "t_mace@hotmail.com", full_name: "Tom Mace" }), "Tom Mace");
});

test("store is keyboard-safe and active commerce has no AusPost invocation", () => {
  const store = readFileSync(new URL("../src/pages/Store.jsx", import.meta.url), "utf8");
  const orders = readFileSync(new URL("../src/components/admin/OrdersManager.jsx", import.meta.url), "utf8");
  const checkout = readFileSync(new URL("../supabase/functions/createCheckout/index.ts", import.meta.url), "utf8");
  assert.ok(store.includes("window.visualViewport"));
  assert.ok(store.includes("scrollCheckoutFieldIntoView"));
  assert.ok(store.includes("getOrCreateCheckoutRequestId"));
  for (const source of [store, orders, checkout]) {
    assert.ok(!source.includes('functions.invoke("auspost'));
  }
});

test("server checkout keeps legacy clients compatible but returns a session for native polling", () => {
  const checkout = readFileSync(new URL("../supabase/functions/createCheckout/index.ts", import.meta.url), "utf8");
  assert.ok(checkout.includes(": crypto.randomUUID()"));
  assert.ok(checkout.includes("checkout_request_id"));
  assert.ok(checkout.includes("idempotencyKey: `rlt_checkout_${checkoutRequestId}`"));
  assert.ok(checkout.includes("sessionId: session.id"));
  assert.ok(checkout.includes("product.coming_soon === true"));
  assert.ok(checkout.includes("variant.stock_quantity < item.quantity"));
});

test("shipped orders require structured address, carrier and tracking in UI and database", () => {
  const orders = readFileSync(new URL("../src/components/admin/OrdersManager.jsx", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/0021_store_checkout_and_fulfilment_hardening.sql", import.meta.url), "utf8");
  assert.ok(orders.includes("hasStructuredAddress"));
  assert.ok(orders.includes("Tracking details required"));
  assert.ok(migration.includes("A complete structured Australian shipping address is required before shipping"));
  assert.ok(migration.includes("Carrier and tracking number are required before shipping"));
});
