/**
 * Deep-link handling for the native shell: universal links
 * (https://rugbyleaguetakeover.com/...) and shell-origin URLs are mapped into
 * React Router navigations. `mapUrlToRoute` is pure so tests can cover the
 * routing table without a Capacitor runtime.
 */
import { CANONICAL_WEB_ORIGIN, isNativeApp } from "./native-env.js";

const CANONICAL_HOSTS = new Set(["rugbyleaguetakeover.com", "www.rugbyleaguetakeover.com", "localhost"]);

export function mapUrlToRoute(urlString, { canonicalOrigin = CANONICAL_WEB_ORIGIN } = {}) {
  if (!urlString) return null;
  try {
    const url = new URL(urlString, canonicalOrigin);
    if (!CANONICAL_HOSTS.has(url.hostname.toLowerCase())) return null;
    const path = url.pathname || "/";
    return `${path}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

// getLaunchUrl() returns the same last-launch URL for the whole NATIVE
// PROCESS lifetime (it is never cleared), so it must be consumed AT MOST
// ONCE per process. Without this latch, any re-init of the deep-link wiring
// would navigate back to the launch route — e.g. re-landing on the checkout
// return screen on every tab press after a universal-link open. The module
// variable covers re-inits within one JS context; the sessionStorage marker
// covers WKWebView page reloads (memory-pressure recovery), where a fresh
// JS context would otherwise re-consume the same process-scoped launch URL.
const LAUNCH_URL_CONSUMED_KEY = "rlt_launch_url_consumed";
let launchUrlConsumed = false;

// Checks the PRIOR-context marker only (the module latch guards the current
// context and is deliberately set before this runs).
function launchUrlConsumedInPriorContext(url) {
  try {
    return sessionStorage.getItem(LAUNCH_URL_CONSUMED_KEY) === url;
  } catch {
    return false;
  }
}

function markLaunchUrlConsumed(url) {
  launchUrlConsumed = true;
  try {
    sessionStorage.setItem(LAUNCH_URL_CONSUMED_KEY, url);
  } catch {
    // best-effort — the module latch still covers this JS context
  }
}

/** Test-only escape hatch. */
export function resetLaunchUrlLatchForTests() {
  launchUrlConsumed = false;
  try {
    sessionStorage.removeItem(LAUNCH_URL_CONSUMED_KEY);
  } catch {
    // ignore
  }
}

/**
 * Wire up appUrlOpen (universal links / custom-scheme opens) to the router.
 * Returns a cleanup function; a no-op on the web.
 */
export function initDeepLinks(navigate) {
  if (!isNativeApp() || typeof navigate !== "function") return () => {};

  let listener = null;
  let cancelled = false;

  import("@capacitor/app")
    .then(async ({ App }) => {
      if (cancelled) return;
      const handle = await App.addListener("appUrlOpen", ({ url }) => {
        const route = mapUrlToRoute(url);
        if (route) navigate(route);
      });
      if (cancelled) {
        // Cleanup ran while addListener was in flight — don't orphan it.
        handle.remove().catch(() => {});
        return;
      }
      listener = handle;

      // Cold start via a link: the event fires before listeners exist, so ask
      // for the launch URL explicitly — once per process (see latch above).
      if (launchUrlConsumed) return;
      launchUrlConsumed = true;
      try {
        const launch = await App.getLaunchUrl();
        const url = launch?.url || "";
        if (!url || launchUrlConsumedInPriorContext(url)) return;
        markLaunchUrlConsumed(url);
        const route = mapUrlToRoute(url);
        if (route && route !== "/" && !cancelled) navigate(route);
      } catch {
        // No launch URL — normal app-icon start.
      }
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    if (listener) listener.remove().catch(() => {});
  };
}
