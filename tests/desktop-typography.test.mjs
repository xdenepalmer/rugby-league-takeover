import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

// Every size in this app was tuned on the 390px phone, then rendered verbatim
// on a 1900px monitor: measured in a headless browser, 176 separate text
// elements landed at 11px or below (64 at 10px, 11 at 7px). Scaling at the
// breakpoint — rather than editing ~950 `text-[Npx]` literals — keeps the
// tuned phone layouts untouched.
test("desktop lifts the sub-11px type that was tuned for a phone", () => {
  const desktop = css.slice(css.indexOf("Desktop legibility floor"));
  assert.ok(desktop.includes("@media (min-width: 768px)"), "must scale at the md breakpoint");
  assert.ok(desktop.includes("@media (min-width: 1280px)"), "and again on a full monitor");
  for (const size of ["7px", "8px", "9px", "10px", "11px"]) {
    assert.ok(
      new RegExp(`\\.text-\\\\\\[${size}\\\\\\]\\s*\\{\\s*font-size:`).test(desktop),
      `text-[${size}] must be lifted on desktop`,
    );
  }
  // Font-size only: pinning line-height here would clip descenders in rows
  // whose height was set for the smaller type.
  const block = desktop.slice(desktop.indexOf("@media (min-width: 768px)"));
  assert.ok(!/line-height/.test(block), "line-height must inherit so line boxes grow with the text");
});

test("the phone surface keeps the sizes it was tuned with", () => {
  // The lift lives ONLY inside min-width media queries — no unscoped override
  // may leak into the 390px layout, which is the primary surface.
  const desktop = css.slice(css.indexOf("Desktop legibility floor"));
  const outsideMedia = desktop
    .split(/@media[^{]+\{/)
    .slice(0, 1)
    .join("");
  assert.ok(!/\.text-\\\[\d+px\\\]\s*\{/.test(outsideMedia), "no unconditional font-size override");
});

test("light-on-dark text is not thinned by grayscale antialiasing", () => {
  // `antialiased` renders light text on a near-black background with thinner
  // strokes, which is much of why small type read as blurry here.
  assert.match(css, /-webkit-font-smoothing:\s*auto/);
  assert.doesNotMatch(css, /-webkit-font-smoothing:\s*antialiased/);
});

test("the smallest stat labels clear the WCAG AA contrast floor", () => {
  // Measured at 4.4:1 on slate-500 — just under the 4.5:1 required for normal
  // text, at the smallest size in the app.
  const hero = fs.readFileSync(new URL("../src/components/forum/tipping/HeroStats.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(hero, /text-\[7px\]/, "no 7px type in the stat strip");
  assert.doesNotMatch(hero, /text-slate-500/, "slate-500 is under AA at this size");
});
