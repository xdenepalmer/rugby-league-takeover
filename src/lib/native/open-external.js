/**
 * External URL handoff. Inside the native shell an external https URL (Stripe
 * checkout, ticket links) must open in the system browser sheet, never
 * navigate the WebView away from the local app shell. On the web, behavior is
 * unchanged from the pre-native code paths.
 */
import { isNativeApp } from "./native-env.js";

/**
 * Classify an anchor href for the native link interceptor. Pure — testable
 * without a DOM or the Capacitor runtime.
 * @returns {"http" | "mailto" | "tel" | "sms" | "other"}
 */
export function classifyHref(href) {
  const value = String(href || "").trim();
  if (/^https?:\/\//i.test(value)) return "http";
  if (/^mailto:/i.test(value)) return "mailto";
  if (/^tel:/i.test(value)) return "tel";
  if (/^sms:/i.test(value)) return "sms";
  return "other";
}

/**
 * Open a non-http scheme (mailto:, tel:, sms:) with the OS handler. WKWebView
 * silently ignores these from in-page navigation, so the native shell must
 * route them through AppLauncher. On web this is a no-op (returns false) —
 * the browser's default anchor behavior already handles them.
 */
export async function openSystemUrl(url) {
  if (!url || !isNativeApp()) return false;
  try {
    const { AppLauncher } = await import("@capacitor/app-launcher");
    await AppLauncher.openUrl({ url });
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} url absolute http(s) URL
 * @param {{fallback?: "navigate" | "newtab"}} options web behavior:
 *   "navigate" replaces the current page (checkout-style redirects),
 *   "newtab" opens a new tab (default).
 */
export async function openExternalUrl(url, { fallback = "newtab" } = {}) {
  if (!url) return false;

  if (isNativeApp()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return true;
    } catch {
      // Fall through to the web behavior as a last resort.
    }
  }

  if (typeof window === "undefined") return false;
  if (fallback === "navigate") {
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return true;
}
