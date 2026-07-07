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
      listener = await App.addListener("appUrlOpen", ({ url }) => {
        const route = mapUrlToRoute(url);
        if (route) navigate(route);
      });

      // Cold start via a link: the event fires before listeners exist, so ask
      // for the launch URL explicitly.
      try {
        const launch = await App.getLaunchUrl();
        const route = mapUrlToRoute(launch?.url);
        if (route && route !== "/") navigate(route);
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
