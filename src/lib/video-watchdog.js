/* Freeze detection for the ambient background video.
 *
 * History matters here, because this is the third time the videos have "stopped
 * moving". The previous fix added a 5-second keep-alive that called
 * `video.load()` whenever `readyState < 2` or `currentTime` had not advanced.
 * That cure caused the disease: `load()` discards the buffer and restarts the
 * download from byte 0, so on a slow connection a large remote clip could never
 * reach a playable readyState before the next tick threw its progress away. The
 * watchdog meant to unfreeze the video is what pinned it to the poster.
 *
 * So the rules now are:
 *   - Buffering is not freezing. Below HAVE_FUTURE_DATA the element is doing
 *     exactly what it should, and a reload is at its most destructive.
 *   - Only a video that claims to be playing, has data to play, and whose clock
 *     has not moved for several consecutive checks counts as frozen.
 *   - Escalate cheap-to-expensive: play() first, load() only if that failed.
 *   - Reloads are rate-limited and capped, so a genuinely broken source degrades
 *     to the poster instead of hammering the network forever.
 *
 * Kept as a pure state machine (no DOM, no timers) so it is unit-testable and a
 * future rewrite of the component cannot quietly lose the rules.
 */

export const WATCHDOG_INTERVAL_MS = 2000;

// Consecutive no-progress checks before we call it frozen. At a 2s tick that is
// ~6s of a genuinely stuck picture: long enough to ride out decoder jitter,
// short enough to fix it before anyone notices and reports it again.
export const STUCK_CHECKS = 3;

// A reload restarts the download, so it is rate-limited and capped.
export const RELOAD_COOLDOWN_MS = 15000;
export const MAX_RELOADS = 4;

// Sustained healthy playback (~30s at a 2s tick) forgives the reload budget. A
// page left open for hours must not exhaust four reloads early on and then give
// up for the rest of the session.
export const HEALTHY_RESET_CHECKS = 15;

// HTMLMediaElement.readyState
export const HAVE_FUTURE_DATA = 3;

export function createWatchdogState() {
  return { lastTime: null, stuckChecks: 0, healthyChecks: 0, reloads: 0, lastReloadAt: null };
}

// Drop the progress baseline without touching the reload budget. Used whenever
// the clock is about to jump for a legitimate reason (source change, reload,
// return from a hidden tab) so the next check compares like with like.
function resetProgress(state) {
  return { ...state, lastTime: null, stuckChecks: 0 };
}

/**
 * Decide what to do with the video on this tick.
 *
 * @param sample {{hidden:boolean, paused:boolean, ended:boolean, currentTime:number, readyState:number}}
 * @param state  watchdog state from createWatchdogState()
 * @param now    epoch ms
 * @returns {{action: "none"|"play"|"reload", state: object}}
 */
export function decideVideoAction(sample, state, now) {
  // A backgrounded tab is legitimately not painting frames. Clearing the
  // baseline is the point: the old watchdog skipped the tick but kept `lastTime`
  // from before the tab was hidden, so the first check on return compared the
  // live clock against a reading from minutes ago.
  if (sample.hidden) return { action: "none", state: resetProgress(state) };

  // A finished clip is the playlist advancer's business, not ours.
  if (sample.ended) return { action: "none", state: resetProgress(state) };

  if (sample.paused) return { action: "play", state: resetProgress(state) };

  // Still fetching. Leave it alone — this is the branch the old watchdog got
  // wrong, and reloading here is what made a slow connection unrecoverable.
  if (sample.readyState < HAVE_FUTURE_DATA) return { action: "none", state: resetProgress(state) };

  const advanced = state.lastTime === null || sample.currentTime !== state.lastTime;
  const next = { ...state, lastTime: sample.currentTime };

  if (advanced) {
    next.stuckChecks = 0;
    next.healthyChecks = state.healthyChecks + 1;
    if (next.healthyChecks >= HEALTHY_RESET_CHECKS) {
      next.healthyChecks = 0;
      next.reloads = 0;
    }
    return { action: "none", state: next };
  }

  next.healthyChecks = 0;
  next.stuckChecks = state.stuckChecks + 1;

  if (next.stuckChecks < STUCK_CHECKS) return { action: "none", state: next };

  // Frozen: buffered, unpaused, and the clock has not moved. Cheap fix first.
  if (next.stuckChecks === STUCK_CHECKS) return { action: "play", state: next };

  // play() did not shift it. Reload the buffer, if the budget allows.
  const cooled = state.lastReloadAt === null || now - state.lastReloadAt >= RELOAD_COOLDOWN_MS;
  if (next.reloads < MAX_RELOADS && cooled) {
    return {
      action: "reload",
      state: { ...resetProgress(next), reloads: next.reloads + 1, lastReloadAt: now },
    };
  }

  return { action: "none", state: next };
}

// Shared by the event-driven recovery paths ("stalled", media errors) so every
// caller draws from the same reload budget as the watchdog.
export function claimReload(state, now) {
  const cooled = state.lastReloadAt === null || now - state.lastReloadAt >= RELOAD_COOLDOWN_MS;
  if (state.reloads >= MAX_RELOADS || !cooled) return { allowed: false, state };
  return {
    allowed: true,
    state: { ...resetProgress(state), reloads: state.reloads + 1, lastReloadAt: now },
  };
}
