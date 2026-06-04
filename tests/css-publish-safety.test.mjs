import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Guard against CSS that compiles locally (Vite) but BREAKS the Base44 publish
// step, shipping a broken/empty stylesheet → black screen on the live site.
// `outline-ring/50` (an invalid Tailwind utility) has caused this outage before
// (mass UI/UX overhaul, 5be0c14). Keep it out for good.
const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("index.css contains no invalid `outline-ring` utility", () => {
  assert.doesNotMatch(
    css,
    /outline-ring/,
    "`outline-ring/50` breaks the Base44 publish — use `outline-color: hsl(var(--ring) / 0.5)` instead",
  );
});

test("@apply does not use slash-opacity on the outline utility", () => {
  // e.g. `@apply outline-ring/50` or `@apply outline-foo/40` — invalid in the
  // Base44 publish pipeline even when Vite tolerates it.
  assert.doesNotMatch(css, /@apply[^;}]*\boutline-[a-z-]+\/[0-9]+/);
});
