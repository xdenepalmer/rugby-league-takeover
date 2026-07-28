import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// iOS auto-zooms when a focused input's font-size is under 16px, and the user
// cannot zoom back out — the page stays magnified and scrolls sideways. A guard
// rule existed but silently did nothing, because Tailwind emits @layer base
// before the utilities layer and a bare `input` selector (0,0,1) loses to the
// `text-sm` (0,1,0) that ui/input.jsx bakes into every field.

test("the coarse-pointer rule can actually beat Tailwind's text utilities", () => {
  const css = read("src/index.css");
  const block = css.match(/@media \(pointer: coarse\)\s*\{[\s\S]*?\n {2}\}/);
  assert.ok(block, "coarse-pointer font-size guard is missing");
  const rule = block[0];

  assert.match(rule, /font-size:\s*16px\s*!important/,
    "without !important the rule loses to .text-sm and every input still zooms");
  for (const selector of ["input", "textarea", "select"]) {
    assert.ok(rule.includes(selector), `${selector} must be covered`);
  }
});

test("checkboxes and radios are left alone", () => {
  const css = read("src/index.css");
  const block = css.match(/@media \(pointer: coarse\)\s*\{[\s\S]*?\n {2}\}/)[0];
  // They render no text and size off their own box; forcing 16px moves them.
  assert.ok(block.includes('input:not([type="checkbox"]):not([type="radio"])'),
    "checkbox/radio should be excluded from the font-size bump");
});

test("pinch-zoom is not disabled to work around the problem", () => {
  // maximum-scale / user-scalable=no would also stop the auto-zoom, but it
  // removes the user's ability to magnify anything — a WCAG 1.4.4 failure, and
  // this project publishes a WCAG posture in COMPLIANCE.md.
  const html = read("index.html");
  const viewport = html.match(/<meta name="viewport"[^>]*>/)?.[0] || "";
  assert.ok(viewport, "viewport meta missing");
  assert.ok(!/maximum-scale/.test(viewport), "must not cap zoom");
  assert.ok(!/user-scalable\s*=\s*no/.test(viewport), "must not disable zoom");
});
