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

// The platform cannot change mid-session, so the first answer is latched:
// the whole app (route-tree selection included) must never flip trees at
// runtime, even if something later redefines window.Capacitor (the
// @capacitor/core web runtime replaces a pre-set global when a plugin
// module first loads, which would otherwise re-answer "web").
let cachedIsNative = null;
let cachedPlatform = null;

export function isNativeApp() {
  if (cachedIsNative !== null) return cachedIsNative;
  if (typeof window === "undefined") return false;
  cachedIsNative = detectNativePlatform(window.Capacitor);
  if (cachedIsNative) cachedPlatform = detectPlatform(window.Capacitor);
  return cachedIsNative;
}

export function getPlatform() {
  if (cachedPlatform !== null) return cachedPlatform;
  if (typeof window === "undefined") return "web";
  const platform = detectPlatform(window.Capacitor);
  if (isNativeApp()) cachedPlatform = platform;
  return platform;
}

export function isIos() {
  return getPlatform() === "ios";
}

export function isWeb() {
  return !isNativeApp();
}
