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

test("keep-alive self-heals a FROZEN video, not just a paused one (desktop 'never returns')", () => {
  // The bug: desktop pauses OR silently freezes the bg video (tab throttle,
  // power saving, network stall). A frozen video is not `paused`, and play()
  // alone can't fix a broken buffer. Guard the frozen-detection + reload recovery
  // so a future auto-sync rewrite can't reintroduce the "never comes back" bug.
  // The rules themselves now live in src/lib/video-watchdog.js and are tested
  // behaviourally in background-video-watchdog.test.mjs.
  assert.match(src, /decideVideoAction/, "keep-alive must delegate to the watchdog state machine");
  assert.match(src, /const recover = \(\) =>/, "must have a full recover() helper");
  // recover must re-load the media buffer, not merely call play().
  const recoverBlock = src.slice(src.indexOf("const recover = () =>"), src.indexOf("const recover = () =>") + 160);
  assert.match(recoverBlock, /video\.load\(\)/, "recover() must re-load the source buffer");
  assert.match(src, /addEventListener\("stalled"/, "must recover on media 'stalled' events");
});

test("every reload path is budgeted — no unlimited load() on a timer", () => {
  // The third outage's cause: an unbudgeted video.load() on a 5s interval, which
  // restarted the download before a large clip could become playable. Any future
  // recovery path must claim from the shared budget.
  assert.match(src, /claimReload/, "event-driven recovery must share the reload budget");

  // A low readyState means "still fetching", and may only ever trigger the cheap
  // playVideo() nudge — never a reload, which throws the download away.
  for (const line of src.split("\n")) {
    if (!line.includes("readyState")) continue;
    assert.ok(
      !/recover\s*\(/.test(line) && !/\.load\s*\(/.test(line),
      `a buffering video must not trigger a reload: ${line.trim()}`,
    );
  }
});

test("the play/pause control is always reachable, even when the environment blocks playback", () => {
  // It used to be hidden whenever data-saver or reduced-motion suppressed the
  // video — removing the only control that could start it in exactly the case
  // where the user is looking at a still image and asking why.
  assert.doesNotMatch(src, /\{!envBlocked && \(/, "the control must not be conditionally hidden");
  assert.match(src, /aria-label=\{shouldPlayVideo \? "Pause/, "label must track actual playback");
});
