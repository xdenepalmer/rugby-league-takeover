import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hideBrokenImage } from "../src/lib/img-fallback.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => { try { readFileSync(new URL(`../${p}`, import.meta.url)); return true; } catch { return false; } };

test("hideBrokenImage hides the failed image, never throws", () => {
  const el = { style: {} };
  hideBrokenImage({ currentTarget: el });
  assert.equal(el.style.display, "none");
  // Defensive: no currentTarget / no style must not throw.
  hideBrokenImage({});
  hideBrokenImage(undefined);
  hideBrokenImage({ currentTarget: {} });
});

test("remote-image call sites wire the fallback", () => {
  for (const p of [
    "src/components/public/HeroSection.jsx",
    "src/components/public/BackgroundVideo.jsx",
    "src/pages/Gallery.jsx",
    "src/pages/Store.jsx",
    "src/components/public/TravelSection.jsx",
    "src/pages/Home.jsx",
  ]) {
    assert.ok(read(p).includes("hideBrokenImage"), `${p} must use hideBrokenImage`);
  }
});

test("News page has an h1 for a11y/SEO", () => {
  assert.ok(/<h1[\s>]/.test(read("src/pages/News.jsx")), "News.jsx must render an <h1>");
});

test("bottom tab bar covers the 1024-1279 range (no nav dead zone)", () => {
  const layout = read("src/components/public/PublicLayout.jsx");
  assert.ok(layout.includes('aria-label="Main navigation"'));
  assert.ok(!/border-border\/70 lg:hidden pointer-events-auto/.test(layout), "tab bar must not hide at lg (would leave 1024-1279 with no nav)");
  assert.ok(/border-border\/70 xl:hidden pointer-events-auto/.test(layout), "tab bar should hide at xl");
});

test("supabase client applies a request timeout (no infinite hang)", () => {
  const client = read("src/api/supabaseClient.js");
  assert.ok(client.includes("AbortSignal.timeout"));
  assert.ok(client.includes("global: { fetch:"));
});

test("dead components were removed", () => {
  assert.ok(!exists("src/components/ui/form.jsx"), "unused ui/form.jsx should be deleted");
  assert.ok(!exists("src/components/ui/skeleton.jsx"), "unused ui/skeleton.jsx should be deleted");
  assert.ok(!exists("src/components/forum/FanBadgeUnlocks.jsx"), "unused FanBadgeUnlocks.jsx should be deleted");
});

test("reactors modal has dialog semantics + keyboard dismiss", () => {
  const rp = read("src/components/forum/ReactionPicker.jsx");
  assert.ok(rp.includes('role="dialog"') && rp.includes('aria-modal="true"'));
  assert.ok(rp.includes('e.key === "Escape"'), "must support Escape dismiss");
});
