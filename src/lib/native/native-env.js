/**
 * Native environment detection for the Capacitor iOS shell.
 *
 * The Capacitor bridge injects `window.Capacitor` before any page script runs
 * inside the native WebView. On the plain web/PWA nothing injects it, so every
 * helper safely reports "web". Pure logic is factored out so tests can inject
 * a fake bridge without a DOM (matching the pwa-env.js convention).
 */
export const CANONICAL_WEB_ORIGIN = "https://rugbyleaguetakeover.com";

export function detectNativePlatform(capacitorGlobal) {
  if (!capacitorGlobal || typeof capacitorGlobal.isNativePlatform !== "function") return false;
  try {
    return capacitorGlobal.isNativePlatform() === true;
  } catch {
    return false;
  }
}

export function detectPlatform(capacitorGlobal) {
  if (!detectNativePlatform(capacitorGlobal)) return "web";
  try {
    const platform = capacitorGlobal.getPlatform?.();
    return typeof platform === "string" && platform ? platform : "web";
  } catch {
    return "web";
  }
}

// Native-ness is fixed for the lifetime of a session: the WKWebView bridge is
// injected before any app JS and never disappears. We latch it on the first
// positive detection so every consumer — the layout seam, per-page native
// branches, bootstrap — reads one stable answer. Without this, a later reader
// could momentarily disagree with an earlier one (e.g. @capacitor/core
// re-initialising window.Capacitor between an eager and a lazily-loaded route),
// which would render a web page inside the native shell. We never latch "web":
// on a slow native boot window.Capacitor may not be ready on the very first
// call, so web stays recomputed until the bridge appears.
let latchedNative = false;
let latchedPlatform = null;

export function isNativeApp() {
  if (latchedNative) return true;
  if (typeof window === "undefined") return false;
  if (detectNativePlatform(window.Capacitor)) latchedNative = true;
  return latchedNative;
}

export function getPlatform() {
  if (latchedPlatform) return latchedPlatform;
  if (typeof window === "undefined") return "web";
  const platform = detectPlatform(window.Capacitor);
  if (platform !== "web") {
    latchedNative = true;
    latchedPlatform = platform;
  }
  return platform;
}

export function isIos() {
  return getPlatform() === "ios";
}

export function isWeb() {
  return !isNativeApp();
}
