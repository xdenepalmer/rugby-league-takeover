import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const forumPath = new URL("../src/pages/Forum.jsx", import.meta.url);
const cssPath = new URL("../src/index.css", import.meta.url);

test("forum page uses mobile-first layout hooks that prevent horizontal clipping", () => {
  const source = fs.readFileSync(forumPath, "utf8");

  for (const token of [
    "forum-mobile-hero",
    "forum-filter-rail",
    "forum-post-card",
    "forum-engagement-bar",
    "forum-compose-fab",
  ]) {
    assert.ok(source.includes(token), `Forum.jsx missing ${token}`);
  }

  assert.ok(source.includes("overflow-x-auto"), "forum filters need horizontal scroll instead of viewport overflow");
  assert.ok(source.includes("pb-[calc(7rem+var(--safe-bottom))]"), "forum feed needs bottom browser/FAB breathing room");
});

test("forum mobile CSS defines clipping and readability safeguards", () => {
  const css = fs.readFileSync(cssPath, "utf8");

  for (const token of [
    ".forum-mobile-hero",
    ".forum-filter-rail",
    ".forum-post-card",
    ".forum-engagement-bar",
    ".forum-compose-fab",
  ]) {
    assert.ok(css.includes(token), `index.css missing ${token}`);
  }

  assert.match(css, /max-width:\s*100%/);
  assert.match(css, /overflow-x:\s*hidden/);
});
