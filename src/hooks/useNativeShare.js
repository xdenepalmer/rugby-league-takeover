import { useState, useCallback } from 'react';
import { isNativeApp } from '@/lib/native/native-env.js';
import { lightImpact } from '@/lib/native/haptics.js';
import { canonicalizeShareUrl } from '@/lib/native/share.js';

// Re-exported for component call sites that import it from this hook module.
export { canonicalizeShareUrl };

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
