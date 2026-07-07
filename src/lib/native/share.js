/**
 * Share helpers: native share sheet inside the Capacitor shell, Web Share API
 * or clipboard fallback on the web. Share links are always canonicalized to
 * the public https origin — a `capacitor://localhost/...` URL would be
 * unopenable for the recipient.
 */
import { CANONICAL_WEB_ORIGIN, isNativeApp } from "./native-env.js";
import { lightImpact } from "./haptics.js";

export function canonicalizeShareUrl(urlString, { canonicalOrigin = CANONICAL_WEB_ORIGIN } = {}) {
  if (!urlString) return canonicalOrigin;
  try {
    const url = new URL(urlString, canonicalOrigin);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    return `${canonicalOrigin}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return canonicalOrigin;
  }
}

/**
 * Returns "shared" | "copied" | "dismissed" | "failed".
 */
export async function shareUrl({ title, text, url } = {}) {
  const shareTarget = canonicalizeShareUrl(url);

  if (isNativeApp()) {
    try {
      const { Share } = await import("@capacitor/share");
      lightImpact();
      await Share.share({ title, text, url: shareTarget });
      return "shared";
    } catch (error) {
      // The user closing the share sheet rejects with a cancellation message —
      // that is a normal outcome, not a failure to report.
      if (/cancel/i.test(String(error?.message || error))) return "dismissed";
      // Fall through to the web-style fallbacks below.
    }
  }

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url: shareTarget });
      return "shared";
    } catch {
      return "dismissed";
    }
  }

  try {
    await navigator.clipboard.writeText(shareTarget);
    return "copied";
  } catch {
    return "failed";
  }
}

export function shareArticle(article) {
  return shareUrl({
    title: article?.title || "Rugby League Takeover",
    text: article?.title,
    url: article?.link || "/news",
  });
}

export function shareThread(thread) {
  return shareUrl({
    title: thread?.title || "RLT Forum",
    text: thread?.title,
    url: thread?.id ? `/forum?thread=${encodeURIComponent(thread.id)}` : "/forum",
  });
}

export function shareProduct(product) {
  return shareUrl({
    title: product?.name || "RLT Store",
    text: product?.name,
    url: "/store",
  });
}

export function shareGalleryItem(item) {
  return shareUrl({
    title: item?.title || "RLT Gallery",
    text: item?.title,
    url: "/gallery",
  });
}
