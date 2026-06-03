import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(
  new URL("../src/components/public/BackgroundVideo.jsx", import.meta.url),
  "utf8",
);

/* These are source guards: a Base44 auto-sync / builder regen has twice stripped
 * the format-priority sort and re-introduced a blanket mobile-disable, breaking
 * homepage autoplay. Keep these assertions so a silent regression fails CI. */

test("autoplay is NOT gated purely on a mobile viewport", () => {
  // The old regression disabled video whenever max-width:767px matched.
  assert.doesNotMatch(
    src,
    /max-width:\s*767px/,
    "background video must not be disabled purely because the viewport is mobile",
  );
});

test("data-saver and reduced-motion gating is preserved", () => {
  assert.match(src, /saveData/, "must still respect navigator.connection.saveData");
  assert.match(src, /prefers-reduced-motion/, "must still respect prefers-reduced-motion");
});

test("video element keeps autoplay-friendly attributes", () => {
  for (const attr of ["autoPlay", "muted", "loop", "playsInline"]) {
    assert.match(src, new RegExp(`\\b${attr}\\b`), `<video> must keep ${attr}`);
  }
});

test("poster fallback is preserved", () => {
  assert.match(src, /poster/, "poster fallback must remain");
});

test("sources are ordered so mp4 wins over mov (QuickTime unplayable in most browsers)", () => {
  // Source guard: the FORMAT_RANK priority sort must stay present.
  assert.match(src, /FORMAT_RANK/, "FORMAT_RANK source-priority map must exist");
  assert.match(src, /\.sort\(/, "sources must be sorted by format priority");

  // Behavioural replica of the ranking rule (the component is JSX and can't be
  // imported in a node test — same precedent as forum-engagement-counters).
  const FORMAT_RANK = { mp4: 0, webm: 1, ogg: 2, mov: 9 };
  const extOf = (url) => String(url).split("?")[0].split(".").pop()?.toLowerCase();
  const rank = (url) => FORMAT_RANK[extOf(url)] ?? 5;
  const input = [
    "https://media.example.com/a/clip.mov",
    "https://media.example.com/a/clip.mp4",
  ];
  const ordered = [...input].sort((a, b) => rank(a) - rank(b));
  assert.equal(extOf(ordered[0]), "mp4", "mp4 must be the first source");
  assert.equal(extOf(ordered[1]), "mov", "mov must be ranked last");
});
