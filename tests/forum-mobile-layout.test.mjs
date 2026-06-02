import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const forumPath = new URL("../src/pages/Forum.jsx", import.meta.url);
const cssPath = new URL("../src/index.css", import.meta.url);

test("forum page uses mobile-first layout hooks that prevent horizontal clipping", () => {
  const source = fs.readFileSync(forumPath, "utf8");

  for (const token of [
    "forum-mobile-hero",
    "forum-mobile-content",
    "forum-filter-rail",
    "forum-post-card",
    "forum-engagement-bar",
    "forum-sort-tabs",
    "forum-action-button",
    "forum-compose-fab",
  ]) {
    assert.ok(source.includes(token), `Forum.jsx missing ${token}`);
  }

  assert.ok(!source.includes("forum-filter-rail -mx-3"), "forum filters must not use negative mobile margins");
  assert.ok(!source.includes("forum-filter-rail") || !source.includes("overflow-x-auto"), "forum filters must fit inside the viewport instead of hiding overflow");
  assert.ok(source.includes("pb-[calc(7rem+var(--safe-bottom))]"), "forum feed needs bottom browser/FAB breathing room");
});

test("forum mobile CSS defines clipping and readability safeguards", () => {
  const css = fs.readFileSync(cssPath, "utf8");

  for (const token of [
    ".forum-mobile-hero",
    ".forum-mobile-content",
    ".forum-filter-rail",
    ".forum-post-card",
    ".forum-engagement-bar",
    ".forum-sort-tabs",
    ".forum-action-button",
    ".forum-compose-fab",
  ]) {
    assert.ok(css.includes(token), `index.css missing ${token}`);
  }

  assert.match(css, /max-width:\s*100%/);
  assert.match(css, /overflow-x:\s*hidden/);
});

test("forum mobile controls fit inside the viewport instead of hiding overflow", () => {
  const css = fs.readFileSync(cssPath, "utf8");

  assert.match(css, /\.forum-mobile-content[\s\S]*width:\s*min\(100%,\s*calc\(100vw - 1rem\)\)/);
  assert.match(css, /\.forum-post-card[\s\S]*width:\s*min\(100%,\s*calc\(100vw - 1rem\)\)/);
  assert.match(css, /\.forum-filter-rail[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.forum-filter-rail[\s\S]*overflow-x:\s*hidden/);
  assert.match(css, /\.forum-engagement-bar[\s\S]*flex-wrap:\s*wrap/);
  assert.ok(!/\.forum-engagement-bar[\s\S]*grid-template-columns:\s*repeat\(4/.test(css), "engagement buttons must not be forced into a four-column grid");
  assert.match(css, /\.forum-action-button[\s\S]*flex:\s*0 0 auto/);
});
