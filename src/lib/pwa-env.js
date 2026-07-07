/**
 * PWA Environment Configuration
 * 
 * Strategy:
 * - Public routes: Full PWA with service worker caching, offline support,
 *   and install prompts. Cached assets serve instantly on repeat visits.
 * - Admin routes (/admin/*): Always network-fresh. Service worker is disabled
 *   to ensure admin always sees real-time data. The web app manifest still
 *   includes an Admin shortcut for quick-launch from the home screen, but
 *   this does NOT imply offline support — it's a convenience shortcut only.
 * - Preview/development: PWA disabled to avoid stale cache issues during dev.
 */
import { isNativeApp } from "./native/native-env.js";

const PREVIEW_HOST_PATTERNS = [
  /(^|\.)base44\.app$/i,
  /preview/i,
  /^localhost$/i,
  /^127\.0\.0\.1$/i,
  /^\[?::1\]?$/i,
];

export function isPreviewLikeUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (url.searchParams.has("app_id") || url.searchParams.has("access_token")) return true;
    return PREVIEW_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname));
  } catch {
    return true;
  }
}

export function shouldEnablePwaForEnvironment({ href, mode, hasServiceWorker, isNative = false }) {
  // Inside the Capacitor native shell the app is served from local assets —
  // a service worker would only fight the native bridge. (The localhost
  // preview pattern above also catches capacitor://localhost, but the guard
  // must not depend on that coincidence.)
  if (isNative) return false;

  try {
    const url = new URL(href);
    if (url.pathname.startsWith("/admin")) return false;
  } catch {
    return false;
  }

  return mode === "production" && hasServiceWorker && !isPreviewLikeUrl(href);
}

export function shouldEnablePwa() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return shouldEnablePwaForEnvironment({
    href: window.location.href,
    mode: import.meta.env.MODE,
    hasServiceWorker: "serviceWorker" in navigator,
    isNative: isNativeApp(),
  });
}