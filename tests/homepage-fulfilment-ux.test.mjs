import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("About has one stable anchor and hash scrolling compensates for mobile header and lazy layout shifts", async () => {
  const [home, about, scrolling, nav] = await Promise.all([
    read("src/pages/Home.jsx"),
    read("src/components/public/AboutSection.jsx"),
    read("src/lib/scroll-to-hash.js"),
    read("src/components/public/SiteNav.jsx"),
  ]);
  assert.match(home, /id="about"/);
  assert.doesNotMatch(about, /id="about"/);
  assert.match(scrolling, /data-site-header/);
  assert.match(scrolling, /\[250, 700, 1300\]/);
  assert.match(nav, /data-site-header/);
  assert.match(nav, /scrollToHashTarget/);
});

test("homepage ticker messages are editable in Command Centre and exposed through the safe settings view", async () => {
  const [home, settings, migration] = await Promise.all([
    read("src/pages/Home.jsx"),
    read("src/components/admin/SiteSettingsManager.jsx"),
    read("supabase/migrations/0010_store_payments_hardening.sql"),
  ]);
  assert.match(home, /settings\.ticker_items/);
  assert.match(settings, /Scrolling Banner Text/);
  assert.match(settings, /update\(\s*"ticker_items"/);
  assert.match(migration, /add column if not exists ticker_items jsonb/);
  assert.match(migration, /\n\s+ticker_items,/);
});

test("Command Centre distinguishes unpaid missing addresses and prints address-only labels safely", async () => {
  const orders = await read("src/components/admin/OrdersManager.jsx");
  assert.match(orders, /order\.shipping_address_line1/);
  assert.match(orders, /Stripe supplies the address only after payment completes/);
  assert.match(orders, /Print Address Label/);
  assert.match(orders, /Address label only — postage and carrier tracking must be purchased separately/);
  assert.match(orders, /paidLike\.includes\(order\.status\)/);
  assert.doesNotMatch(orders, /document\.write/);
});
