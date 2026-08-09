import test from "node:test";
import assert from "node:assert/strict";
import {
  HEALTHY_RESET_CHECKS,
  MAX_RELOADS,
  RELOAD_COOLDOWN_MS,
  STUCK_CHECKS,
  claimReload,
  createWatchdogState,
  decideVideoAction,
} from "../src/lib/video-watchdog.js";

/* "The background videos have stopped moving" has been reported three times.
 * The third cause was the watchdog written to fix the second: a 5s timer that
 * called video.load() whenever readyState < 2, which restarted the download
 * from scratch before a large remote clip could ever become playable. These
 * tests pin the distinction between buffering and freezing so that cure can
 * never come back. */

const PLAYING = { hidden: false, paused: false, ended: false, currentTime: 10, readyState: 4 };

// Run n ticks with a fixed sample, collecting the actions taken and when.
const run = (samples, { start = createWatchdogState(), t0 = 0, step = 2000 } = {}) => {
  let state = start;
  const actions = [];
  const reloadTimes = [];
  samples.forEach((sample, i) => {
    const now = t0 + i * step;
    const result = decideVideoAction(sample, state, now);
    state = result.state;
    actions.push(result.action);
    if (result.action === "reload") reloadTimes.push(now);
  });
  return { actions, reloadTimes, state };
};

// The first tick only establishes a baseline, so no-progress counting starts on
// the second: play() lands on tick STUCK_CHECKS, reload on the one after.
const FIRST_PLAY_TICK = STUCK_CHECKS;
const FIRST_RELOAD_TICK = STUCK_CHECKS + 1;

// ── buffering is not freezing ────────────────────────────────────────────
test("a buffering video is left alone, no matter how long it buffers", () => {
  // The exact regression: readyState below HAVE_FUTURE_DATA on a slow link.
  // Reloading here is what made the freeze permanent.
  const buffering = { ...PLAYING, readyState: 2, currentTime: 0 };
  const { actions } = run(Array(30).fill(buffering));
  assert.ok(
    actions.every((a) => a === "none"),
    "must never reload or restart a video that is still fetching data",
  );
});

test("a video that buffers and then plays is never reloaded", () => {
  const buffering = { ...PLAYING, readyState: 1, currentTime: 0 };
  const playing = (t) => ({ ...PLAYING, currentTime: t });
  const { actions } = run([
    ...Array(10).fill(buffering),
    ...[1, 2, 3, 4, 5].map((t) => playing(t)),
  ]);
  assert.ok(actions.every((a) => a === "none"), `expected no intervention, got ${actions.join()}`);
});

// ── a real freeze is still healed ────────────────────────────────────────
test("a genuinely frozen video escalates play() then reload()", () => {
  // Buffered, unpaused, and the clock has not moved: that is a real freeze.
  const { actions } = run(Array(FIRST_RELOAD_TICK + 1).fill(PLAYING));
  assert.equal(actions[FIRST_PLAY_TICK], "play", "cheap fix first");
  assert.equal(actions[FIRST_RELOAD_TICK], "reload", "then reload the buffer");
});

test("a frozen video is not reloaded before the first no-progress threshold", () => {
  const { actions } = run(Array(FIRST_PLAY_TICK).fill(PLAYING));
  assert.ok(!actions.includes("reload"), "must ride out short stalls without a reload");
});

test("a paused video is played again, cheaply", () => {
  const { actions } = run([{ ...PLAYING, paused: true }]);
  assert.deepEqual(actions, ["play"], "paused needs play(), never a reload");
});

test("advancing playback is left untouched", () => {
  const { actions } = run([1, 2, 3, 4, 5, 6, 7, 8].map((t) => ({ ...PLAYING, currentTime: t })));
  assert.ok(actions.every((a) => a === "none"));
});

// ── reload budget ────────────────────────────────────────────────────────
test("reloads are rate-limited by a cooldown", () => {
  // Permanently frozen source: without a cooldown this hammers the network on
  // every tick, restarting the download before it can ever finish.
  const { reloadTimes } = run(Array(20).fill(PLAYING), { step: 2000 });
  assert.ok(reloadTimes.length >= 1, "a permanent freeze must still be acted on");
  for (let i = 1; i < reloadTimes.length; i += 1) {
    assert.ok(
      reloadTimes[i] - reloadTimes[i - 1] >= RELOAD_COOLDOWN_MS,
      `reloads ${reloadTimes[i - 1]} and ${reloadTimes[i]} are closer than the cooldown`,
    );
  }
});

test("reloads are capped so a broken source degrades to the poster", () => {
  // Far apart in time, so the cooldown never blocks — only the cap can.
  const { actions } = run(Array(60).fill(PLAYING), { step: RELOAD_COOLDOWN_MS + 1000 });
  const reloads = actions.filter((a) => a === "reload").length;
  assert.equal(reloads, MAX_RELOADS, `must stop after ${MAX_RELOADS} reloads`);
});

test("sustained healthy playback forgives the reload budget", () => {
  // A page open for hours must not exhaust its reloads early and give up.
  let state = createWatchdogState();
  ({ state } = run(Array(60).fill(PLAYING), { start: state, step: RELOAD_COOLDOWN_MS + 1000 }));
  assert.equal(state.reloads, MAX_RELOADS, "budget spent");

  const healthy = Array.from({ length: HEALTHY_RESET_CHECKS }, (_, i) => ({
    ...PLAYING,
    currentTime: 100 + i,
  }));
  ({ state } = run(healthy, { start: state }));
  assert.equal(state.reloads, 0, "half a minute of real playback restores the budget");
});

test("event-driven recovery draws from the same budget as the watchdog", () => {
  // Otherwise a 'stalled' storm bypasses every limit the watchdog enforces.
  let state = createWatchdogState();
  const first = claimReload(state, 0);
  assert.equal(first.allowed, true);
  state = first.state;

  const tooSoon = claimReload(state, RELOAD_COOLDOWN_MS - 1);
  assert.equal(tooSoon.allowed, false, "cooldown applies to stall-driven reloads too");

  const later = claimReload(state, RELOAD_COOLDOWN_MS);
  assert.equal(later.allowed, true);
});

// ── hidden tabs ──────────────────────────────────────────────────────────
test("a hidden tab is never touched, and its stale clock never counts as frozen", () => {
  // The old watchdog skipped hidden ticks but kept the pre-hidden timestamp, so
  // the first check after returning compared against a reading from minutes ago.
  let state = createWatchdogState();
  ({ state } = run([{ ...PLAYING, currentTime: 42 }], { start: state }));
  assert.equal(state.lastTime, 42);

  const hidden = run([{ ...PLAYING, hidden: true, currentTime: 42 }], { start: state });
  assert.deepEqual(hidden.actions, ["none"], "must not act on a backgrounded tab");
  assert.equal(hidden.state.lastTime, null, "baseline must be dropped while hidden");

  // Back in the foreground at the same currentTime: this is the first reading,
  // not evidence of a freeze.
  const back = run([{ ...PLAYING, currentTime: 42 }], { start: hidden.state });
  assert.deepEqual(back.actions, ["none"]);
});

test("an ended video is left to the playlist advancer", () => {
  const { actions } = run(Array(6).fill({ ...PLAYING, ended: true }));
  assert.ok(actions.every((a) => a === "none"), "advancing sources is not the watchdog's job");
});
