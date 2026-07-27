/**
 * Canonicalize a share URL to the public https origin. A `capacitor://localhost`
 * URL would be unopenable for the recipient, so rewrite it to the public domain.
 * Pure (no React) so it can be unit-tested and imported from anywhere — the
 * useNativeShare hook re-exports it for component call sites.
 */
import { CANONICAL_WEB_ORIGIN } from "./native-env.js";

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
