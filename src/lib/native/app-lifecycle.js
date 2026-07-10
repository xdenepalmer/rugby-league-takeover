/**
 * Foreground-resume freshness for the native shell. When the app returns to
 * the foreground, a small set of freshness-critical queries is invalidated
 * (marked stale — active screens refetch, inactive ones refetch on next
 * mount). Deliberately NOT a blanket refetch-everything: public content
 * keeps its staleTime.
 */
import { isNativeApp } from "./native-env.js";

/** Key roots re-validated on foreground. */
export const FOREGROUND_REFRESH_KEYS = [["notifications"], ["forumPosts"], ["adminAttention"]];

export function initNativeLifecycle(queryClient) {
  if (!isNativeApp()) return () => {};
  let listener = null;
  let cancelled = false;

  import("@capacitor/app")
    .then(async ({ App }) => {
      if (cancelled) return;
      listener = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) return;
        for (const key of FOREGROUND_REFRESH_KEYS) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      });
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    listener?.remove?.().catch?.(() => {});
  };
}
