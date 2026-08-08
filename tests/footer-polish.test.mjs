import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// Owner requests from the WhatsApp round: TikTok handle, stock numbers off the
// live store (behind an admin toggle), and Shipping / Refunds policy pages.

test("social handles derive from the settings URL, not hardcoded text", () => {
  const src = read("src/components/public/SocialLinks.jsx");
  // The footer showed @nrl_las_vegas AFTER the admin fixed the URL in
  // settings, because the detail line was a hardcoded string.
  assert.ok(!src.includes('detail: "@nrl_las_vegas"'), "stale hardcoded handle must be gone");
  assert.ok(src.includes("handleFromUrl(settings.social_tiktok_url"), "TikTok handle derives from settings");
  assert.ok(!src.includes("tiktok.com/@nrl_las_vegas"), "stale default URL must be gone");
});

test("stock numbers on the live store are an admin toggle, off by default", () => {
  const store = read("src/pages/Store.jsx");
  const admin = read("src/components/admin/SiteSettingsManager.jsx");
  const migration = read("supabase/migrations/0034_footer_polish.sql");
  assert.ok(store.includes("showStockNumbers = false"), "default hides counts");
  assert.ok(store.includes("store_show_stock_numbers === true"), "gated on the saved setting");
  // Qualitative state must survive with the toggle off — shoppers still need
  // In Stock / Low stock / Sold Out.
  assert.ok(store.includes('"Low stock"'), "urgency stays, number goes");
  assert.ok(admin.includes("store_show_stock_numbers"), "admin toggle exists");
  assert.ok(migration.includes("store_show_stock_numbers boolean not null default false"), "column defaults off");
  assert.ok(/store_show_stock_numbers,\n\s+legal_shipping/.test(migration), "new columns exposed via site_settings_view");
});

test("Shipping and Refunds pages exist, are admin-editable, and are in both footers", () => {
  assert.ok(read("src/pages/Shipping.jsx").includes('settingsKey="legal_shipping"'));
  assert.ok(read("src/pages/Refunds.jsx").includes('settingsKey="legal_refunds"'));
  const app = read("src/App.jsx");
  assert.ok(app.includes('path="/shipping"') && app.includes('path="/refunds"'), "routes exist");
  for (const f of ["src/components/public/PublicLayout.jsx", "src/pages/Home.jsx"]) {
    const src = read(f);
    assert.ok(src.includes('to="/shipping"') && src.includes('to="/refunds"'), `${f} links both policies`);
  }
  const admin = read("src/components/admin/SiteSettingsManager.jsx");
  assert.ok(admin.includes("legal_shipping") && admin.includes("legal_refunds"), "editable in Site Settings");
  // The refunds fallback must not try to contract out of consumer guarantees.
  assert.ok(read("src/pages/Refunds.jsx").includes("Australian Consumer Law"), "ACL rights acknowledged");
});
