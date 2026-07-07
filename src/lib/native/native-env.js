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

export function isNativeApp() {
  if (typeof window === "undefined") return false;
  return detectNativePlatform(window.Capacitor);
}

export function getPlatform() {
  if (typeof window === "undefined") return "web";
  return detectPlatform(window.Capacitor);
}

export function isIos() {
  return getPlatform() === "ios";
}

export function isWeb() {
  return !isNativeApp();
}
