/**
 * Semantic haptic vocabulary for the native shell. Screens emit intent
 * ("cart.add", "save.success") instead of picking impact strengths, so the
 * whole app speaks one physical language and individual call sites can't
 * create haptic noise: every event carries a minimum re-fire interval and
 * emitHaptic() drops anything faster (scrolling, repeated renders, gesture
 * spam). All underlying calls are the fire-and-forget web-safe wrappers in
 * haptics.js — this module is a no-op outside the native shell too.
 */
import {
  lightImpact,
  mediumImpact,
  heavyImpact,
  successImpact,
  warningImpact,
  errorImpact,
  selectionChanged,
} from "./haptics.js";

const HANDLERS = {
  selection: selectionChanged,
  light: lightImpact,
  medium: mediumImpact,
  heavy: heavyImpact,
  success: successImpact,
  warning: warningImpact,
  error: errorImpact,
};

/** event → { handler, minIntervalMs }. Keep alphabetised within groups. */
export const HAPTIC_EVENTS = {
  // Navigation & chrome
  "tab.select": { handler: "selection", minIntervalMs: 120 },
  "sheet.snap": { handler: "light", minIntervalMs: 150 },
  "nav.back": { handler: "selection", minIntervalMs: 120 },
  // Primary actions
  "action.primary": { handler: "medium", minIntervalMs: 250 },
  "cart.add": { handler: "medium", minIntervalMs: 250 },
  "checkout.handoff": { handler: "medium", minIntervalMs: 800 },
  "forum.react": { handler: "light", minIntervalMs: 150 },
  "refresh.trigger": { handler: "light", minIntervalMs: 400 },
  // Outcomes
  "save.success": { handler: "success", minIntervalMs: 800 },
  "post.success": { handler: "success", minIntervalMs: 800 },
  "mutation.warning": { handler: "warning", minIntervalMs: 800 },
  "mutation.error": { handler: "error", minIntervalMs: 800 },
  // Casino personality
  "casino.win": { handler: "success", minIntervalMs: 800 },
  "casino.jackpot": { handler: "heavy", minIntervalMs: 1000 },
};

/**
 * Pure throttle decision so tests can exercise the policy without a device:
 * an event may fire when it has no record or its interval has elapsed.
 */
export function shouldEmitHaptic(event, now, lastEmittedAt) {
  const spec = HAPTIC_EVENTS[event];
  if (!spec) return false;
  const last = lastEmittedAt?.[event];
  if (typeof last !== "number") return true;
  return now - last >= spec.minIntervalMs;
}

const lastEmittedAt = {};

/** Emit a semantic haptic. Returns true when the event actually fired. */
export function emitHaptic(event) {
  const now = Date.now();
  if (!shouldEmitHaptic(event, now, lastEmittedAt)) return false;
  lastEmittedAt[event] = now;
  const spec = HAPTIC_EVENTS[event];
  HANDLERS[spec.handler]?.();
  return true;
}
