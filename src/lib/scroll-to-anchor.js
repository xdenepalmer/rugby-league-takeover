/**
 * Smooth-scroll to an anchor and KEEP it correct while the page reflows.
 *
 * The homepage lazy-mounts every section behind a fixed-height placeholder
 * (LazySection height={…}). Those heights are guesses, so when you jump to a
 * section far down the page the browser computes its destination from the
 * placeholder layout, then the sections you scroll past mount their real
 * content and the document reflows underneath the in-flight scroll. The
 * original destination is now stale and you land on the wrong section —
 * "About Us" quietly dropping you at Events.
 *
 * A one-shot scrollIntoView cannot survive that. This re-asserts the position
 * until the anchor actually settles where it belongs, and gets out of the way
 * the moment the user scrolls themselves.
 */

const DEFAULT_OFFSET = 80; // sticky header height, when the target sets none
const DRIFT_TOLERANCE = 4; // px — below this we treat the position as correct
const STABLE_TICKS = 2; // consecutive in-place checks before we stop
const CHECK_INTERVAL = 250; // ms — slower than a smooth scroll so we don't fight it
const FIRST_CHECK_DELAY = 350;

export function scrollToAnchor(target, { maxWaitMs = 2500 } = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (!el) return false;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const behavior = prefersReduced ? "auto" : "smooth";

  // Honour the element's own scroll-margin-top (set per section for the
  // sticky header) rather than hardcoding one offset for the whole site.
  const desiredTop = () => {
    const declared = parseFloat(window.getComputedStyle(el).scrollMarginTop);
    return Number.isFinite(declared) && declared > 0 ? declared : DEFAULT_OFFSET;
  };

  const nudge = () => {
    const drift = el.getBoundingClientRect().top - desiredTop();
    if (Math.abs(drift) > DRIFT_TOLERANCE) window.scrollBy({ top: drift, behavior });
  };

  nudge();

  let cancelled = false;
  let stable = 0;
  const startedAt = Date.now();
  const userEvents = ["wheel", "touchstart", "keydown"];

  const cleanup = () => userEvents.forEach((evt) => window.removeEventListener(evt, onUserScroll));
  // If the reader takes over, stop yanking the page around.
  function onUserScroll() {
    cancelled = true;
    cleanup();
  }
  userEvents.forEach((evt) => window.addEventListener(evt, onUserScroll, { passive: true, once: true }));

  const tick = () => {
    if (cancelled) return;
    const drift = Math.abs(el.getBoundingClientRect().top - desiredTop());
    if (drift <= DRIFT_TOLERANCE) {
      stable += 1;
    } else {
      stable = 0;
      nudge();
    }
    if (stable >= STABLE_TICKS || Date.now() - startedAt > maxWaitMs) {
      cleanup();
      return;
    }
    window.setTimeout(tick, CHECK_INTERVAL);
  };
  window.setTimeout(tick, FIRST_CHECK_DELAY);

  return true;
}

/**
 * Resolve an anchor that may not exist yet (cross-page navigation mounts the
 * target a tick later), then hand off to scrollToAnchor.
 */
export function scrollToAnchorWhenReady(hash, { attempts = 8, delay = 150 } = {}) {
  if (typeof document === "undefined") return;
  const attempt = (remaining) => {
    if (scrollToAnchor(hash)) return;
    if (remaining > 0) window.setTimeout(() => attempt(remaining - 1), delay);
  };
  attempt(attempts);
}
