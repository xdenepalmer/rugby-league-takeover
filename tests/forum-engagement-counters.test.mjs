import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const forumPath = new URL("../src/pages/Forum.jsx", import.meta.url);

// Source guard: the clamp must stay present in getEngagement so a future edit
// can't silently reintroduce negative engagement rendering.
test("getEngagement clamps likes and views with Math.max(0, …)", () => {
  const source = fs.readFileSync(forumPath, "utf8");
  const fn = source.slice(source.indexOf("const getEngagement"), source.indexOf("const getEngagement") + 400);
  assert.match(fn, /const likes = Math\.max\(0,/, "likes must be clamped to 0");
  assert.match(fn, /const views = Math\.max\(0,/, "views must be clamped to 0");
});

// Behavioural replica of the clamped getEngagement rule (Forum.jsx is a JSX/alias
// module that can't be imported in a node test, so we mirror the formula — same
// precedent as tests/checkout-rules.mjs).
const engagement = (post) => ({
  likes: Math.max(0, Number(post.like_count ?? (Array.isArray(post.liked_by) ? post.liked_by.length : 0)) || 0),
  views: Math.max(0, Number(post.view_count || 0) || 0),
});

test("negative like_count and view_count clamp to 0", () => {
  const e = engagement({ like_count: -22, view_count: -11 });
  assert.equal(e.likes, 0);
  assert.equal(e.views, 0);
});

test("valid engagement values pass through unchanged", () => {
  const e = engagement({ like_count: 7, view_count: 130 });
  assert.equal(e.likes, 7);
  assert.equal(e.views, 130);
});

test("liked_by length fallback is preserved when like_count is absent", () => {
  const e = engagement({ liked_by: ["a", "b", "c"] });
  assert.equal(e.likes, 3);
});

test("missing or non-numeric counters resolve to 0", () => {
  assert.equal(engagement({}).likes, 0);
  assert.equal(engagement({}).views, 0);
  assert.equal(engagement({ view_count: "abc" }).views, 0);
});
