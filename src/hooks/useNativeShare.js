import { useState, useCallback } from 'react';
import { isNativeApp, CANONICAL_WEB_ORIGIN } from '@/lib/native/native-env.js';
import { lightImpact } from '@/lib/native/haptics.js';

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

export function useNativeShare() {
  const [isSharing, setIsSharing] = useState(false);

  const share = useCallback(async ({ title, text, url } = {}) => {
    const shareTarget = canonicalizeShareUrl(url);
    setIsSharing(true);

    try {
      if (isNativeApp()) {
        try {
          const { Share } = await import("@capacitor/share");
          lightImpact();
          await Share.share({ title, text, url: shareTarget });
          return "shared";
        } catch (error) {
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
    } finally {
      setIsSharing(false);
    }
  }, []);

  return { share, isSharing };
}
