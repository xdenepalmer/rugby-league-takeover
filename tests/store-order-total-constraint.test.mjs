import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/0022_store_order_total_consistency.sql", import.meta.url),
  "utf8",
);

test("store order total constraint includes fees charged on top", () => {
  assert.match(migration, /store_orders_promo_total_consistent/);
  assert.match(
    migration,
    /when coalesce\(gst_included,\s*false\) then 0[\s\S]*else coalesce\(gst_amount_aud,\s*0\)/,
  );
  assert.match(
    migration,
    /when coalesce\(card_fee_included,\s*true\) then 0[\s\S]*else coalesce\(card_fee_aud,\s*0\)/,
  );
  assert.match(migration, /merchandise_subtotal_aud[\s\S]*discount_amount_aud[\s\S]*shipping_cost_aud/);
});
