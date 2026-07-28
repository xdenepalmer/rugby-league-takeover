import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("promo codes are managed in Stripe behind admin authorization", async () => {
  const source = await read("supabase/functions/promoCodes/index.ts");
  assert.match(source, /caller\.role !== 'admin'/);
  assert.match(source, /stripe\.coupons\.create/);
  assert.match(source, /stripe\.promotionCodes\.create/);
  assert.match(source, /max_redemptions/);
  assert.match(source, /expires_at/);
  assert.match(source, /minimum_amount/);
  assert.match(source, /stripe\.promotionCodes\.update\(promotionCodeId, \{ active: false \}\)/);
  assert.doesNotMatch(source, /Access-Control-Allow-Origin['"]:\s*['"]\*/);
});

test("public promo validation is bounded and rate limited", async () => {
  const source = await read("supabase/functions/promoCodes/index.ts");
  assert.match(source, /action === 'validate'/);
  assert.match(source, /claim_checkout_attempt/);
  assert.match(source, /PROMO_RATE_LIMIT = 30/);
  assert.match(source, /calculateDiscountCents/);
  assert.match(source, /minimum > subtotalCents/);
});

test("checkout independently applies the Stripe promotion to merchandise", async () => {
  const source = await read("supabase/functions/createCheckout/index.ts");
  assert.match(source, /resolvePromotion\(stripe, input\?\.promoCode, merchandiseSubtotalCents\)/);
  assert.match(source, /discounts: \[\{ promotion_code: promotion\.promotionCodeId \}\]/);
  assert.match(source, /shipping_options: \[shippingSelection\.stripeShippingOption\]/);
  assert.doesNotMatch(source, /Shipping — Standard delivery \(Australia\)/);
  assert.match(source, /authoritativeDiscountAud/);
  assert.match(source, /stripe_promotion_code_id/);
});

test("storefront and command centre expose the promo workflow", async () => {
  const [store, manager, panel] = await Promise.all([
    read("src/pages/Store.jsx"),
    read("src/components/admin/PromoCodesManager.jsx"),
    read("src/components/admin/panels/StorePanel.jsx"),
  ]);
  assert.match(store, /functions\.invoke\("promoCodes"/);
  assert.match(store, /promoCode: appliedPromoIsCurrent \? appliedPromo\.code/);
  assert.match(store, /promoDiscount/);
  assert.match(manager, /Create & activate/);
  assert.match(manager, /Deactivate/);
  assert.match(panel, /PromoCodesManager/);
});

test("orders persist and protect Stripe-owned promotion totals", async () => {
  const migration = await read("supabase/migrations/0010_store_payments_hardening.sql");
  assert.match(migration, /merchandise_subtotal_aud/);
  assert.match(migration, /discount_amount_aud/);
  assert.match(migration, /promo_code/);
  assert.match(migration, /stripe_promotion_code_id/);
  assert.match(migration, /store_orders_promo_total_consistent/);
  assert.match(migration, /new\.discount_amount_aud is distinct from old\.discount_amount_aud/);
});
