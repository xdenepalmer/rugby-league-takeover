import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const libPath = new URL("../src/lib/scroll-to-anchor.js", import.meta.url);
const navPath = new URL("../src/components/public/SiteNav.jsx", import.meta.url);
const layoutPath = new URL("../src/components/public/PublicLayout.jsx", import.meta.url);
const homePath = new URL("../src/pages/Home.jsx", import.meta.url);

// The homepage lazy-mounts sections behind fixed-height placeholders, so the
// document reflows while a smooth scroll is in flight and a one-shot
// scrollIntoView lands on the wrong section (About Us dropping you at Events).
test("anchor scrolling re-asserts position while the page reflows", () => {
  const source = fs.readFileSync(libPath, "utf8");

  assert.match(source, /getBoundingClientRect/, "must measure the live position, not trust the initial one");
  assert.match(source, /scrollMarginTop/, "must honour each section's scroll-margin-top for the sticky header");
  assert.match(source, /prefers-reduced-motion/, "must respect reduced-motion");

  for (const evt of ["wheel", "touchstart", "keydown"]) {
    assert.ok(source.includes(evt), `must stop re-scrolling once the user takes over (${evt})`);
  }
});

test("nav entry points use the reflow-safe scroll helper", () => {
  for (const [label, path] of [["SiteNav", navPath], ["PublicLayout", layoutPath], ["Home", homePath]]) {
    const source = fs.readFileSync(path, "utf8");
    assert.match(source, /scroll-to-anchor/, `${label} should import the shared anchor-scroll helper`);
    assert.ok(
      !/\.scrollIntoView\(\{\s*behavior:\s*"smooth"/.test(source),
      `${label} must not use a bare smooth scrollIntoView — it cannot survive the lazy-section reflow`,
    );
  }
});
