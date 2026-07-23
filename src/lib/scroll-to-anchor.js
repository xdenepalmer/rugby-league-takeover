/**
 * Robust in-page anchor scrolling for the home page's lazy-loaded sections.
 *
 * The home page renders each section inside <LazySection>, which shows a short
 * fixed-height placeholder until the section scrolls near the viewport. A plain
 * `element.scrollIntoView({ behavior: "smooth" })` ANIMATES THROUGH those
 * placeholders on the way to a target lower down; as the smooth scroll passes
 * each one it hydrates, its real (much taller) content replaces the placeholder,
 * and the growing layout shoves the target further down — so the animation lands
 * short, parking the user on an earlier section. That is the reported
 * "About Us opens Travel Packages / Events opens Travel Packages" bug.
 *
 * This helper avoids the fly-through entirely: it JUMPS straight to the target
 * (so intermediate sections never hydrate mid-scroll) and then re-pins to the
 * target for a short window, absorbing any reflow from the one or two sections
 * within the lazy pre-load margin above it, until the position holds still.
 *
 * For a target that itself lives inside a lazy section (e.g.
 * "#travel-registration" inside TravelSection), pass `prescroll` with an anchor
 * that is always in the DOM (its wrapper, e.g. "#travel"); the helper jumps
 * there first so the section hydrates and the real target appears.
 */

const DEFAULT_OFFSET = 80; // matches the home section wrappers' scrollMarginTop
const WAIT_FOR_TARGET_MS = 4000; // element may not be mounted yet (route change / lazy)
const SETTLE_BUDGET_MS = 1600; // hard cap on the re-pin loop
const STABLE_FRAMES = 4; // consecutive still frames that count as "settled"

export function scrollToAnchor(hash, { offset = DEFAULT_OFFSET, prescroll = null, updateHistory = true } = {}) {
  if (typeof document === "undefined" || typeof hash !== "string" || !hash.startsWith("#")) return;

  const topFor = (selector) => {
    let el = null;
    try {
      el = document.querySelector(selector);
    } catch {
      return null; // malformed selector — treat as absent
    }
    if (!el) return null;
    return Math.max(0, window.scrollY + el.getBoundingClientRect().top - offset);
  };

  const waitStart = Date.now();
  let settleStart = 0;
  let lastTop = null;
  let stable = 0;
  let prescrolled = false;

  const frame = () => {
    const top = topFor(hash);

    // Target not in the DOM yet (route still mounting, or it lives in a lazy
    // section). Nudge the prescroll anchor into view once so its section
    // hydrates and the real target appears, then keep polling.
    if (top === null) {
      if (prescroll && !prescrolled) {
        const pTop = topFor(prescroll);
        if (pTop !== null) {
          window.scrollTo(0, pTop);
          prescrolled = true;
        }
      }
      if (Date.now() - waitStart < WAIT_FOR_TARGET_MS) requestAnimationFrame(frame);
      return;
    }

    if (!settleStart) settleStart = Date.now();
    window.scrollTo(0, top);

    if (lastTop !== null && Math.abs(top - lastTop) <= 1) stable += 1;
    else stable = 0;
    lastTop = top;

    // Done once the computed target holds still (the sections above have
    // finished reflowing), or after a hard time budget as a safety net.
    if (stable >= STABLE_FRAMES || Date.now() - settleStart > SETTLE_BUDGET_MS) {
      if (updateHistory) {
        try {
          window.history.replaceState(null, "", `/${hash}`);
        } catch {
          /* history may be unavailable in some embedded contexts */
        }
      }
      return;
    }
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}
