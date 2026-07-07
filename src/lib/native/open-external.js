/**
 * External URL handoff. Inside the native shell an external https URL (Stripe
 * checkout, ticket links) must open in the system browser sheet, never
 * navigate the WebView away from the local app shell. On the web, behavior is
 * unchanged from the pre-native code paths.
 */
import { isNativeApp } from "./native-env.js";

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
