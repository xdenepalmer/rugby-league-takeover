import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");

// LazySection sets `content-visibility: auto` for cheap off-screen sections.
// That applies layout + paint containment, which makes the element the
// CONTAINING BLOCK for `position: fixed` descendants. Any full-screen overlay
// rendered inside a lazy section is therefore sized/positioned to that section
// rather than the viewport — the event/news detail sheet was parked below the
// fold, so tapping a card looked like it did nothing and visibility depended
// purely on scroll offset. Overlays must escape via a portal to <body>.
test("LazySection still relies on content-visibility (the containment this guards)", () => {
  const source = read("../src/components/public/LazySection.jsx");
  assert.ok(
    source.includes("contentVisibility"),
    "LazySection uses content-visibility; if that changes, revisit the portal requirement below"
  );
});

test("PublicDetailSheet renders through a portal to document.body, not inline", () => {
  const source = read("../src/components/public/PublicDetailSheet.jsx");
  assert.ok(source.includes("createPortal"), "detail sheet must render via createPortal");
  assert.ok(
    /createPortal\(/.test(source) && source.includes("document.body"),
    "detail sheet must be portalled to document.body so content-visibility containment can't capture its fixed overlay"
  );
  // The overlay itself must stay viewport-fixed.
  assert.ok(source.includes("fixed inset-0"), "overlay root must remain fixed inset-0");
});

test("both lazy-section consumers of the detail sheet are covered by the portal", () => {
  for (const rel of [
    "../src/components/public/EventsSection.jsx",
    "../src/components/public/NewsSection.jsx",
  ]) {
    const source = read(rel);
    assert.ok(
      source.includes("PublicDetailSheet"),
      `${rel} should use the shared PublicDetailSheet (which is portalled)`
    );
  }
});

// Full-screen sheets must not depend on backdrop-filter for legibility: many
// Android WebViews don't render it, leaving the panel translucent so the page
// and background video bleed through.
test("sheet surfaces have an opaque background that does not rely on backdrop-filter", () => {
  const css = read("../src/index.css");
  assert.ok(css.includes(".cmd-glass.cmd-sheet"), "an opaque .cmd-sheet modifier must exist");
  assert.ok(
    css.includes("@supports not ((backdrop-filter"),
    "a @supports fallback must cover browsers without backdrop-filter"
  );
  for (const rel of [
    "../src/components/public/PublicDetailSheet.jsx",
    "../src/components/public/MobileCommandSheet.jsx",
  ]) {
    assert.ok(read(rel).includes("cmd-sheet"), `${rel} must opt into the opaque sheet surface`);
  }
});

test("cart drawer offers a way back to the shop while it holds items", () => {
  const source = read("../src/pages/Store.jsx");
  assert.ok(
    /Back to shop/i.test(source),
    "cart drawer must offer an explicit route back to browsing so shoppers can add more than one product"
  );
  // The empty state already had its own affordance; keep it.
  assert.ok(source.includes("Continue Shopping"), "empty-cart state should keep its continue-shopping action");
});
