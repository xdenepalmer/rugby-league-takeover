/**
 * Native network-status bridge. Inside the Capacitor shell, `navigator.onLine`
 * is unreliable, so the Network plugin feeds the same boolean contract used by
 * useOnlineStatus. On the web this subscribes to nothing.
 */
import { isNativeApp } from "./native-env.js";

export function subscribeNativeNetwork(onChange) {
  if (!isNativeApp() || typeof onChange !== "function") return () => {};

  let listener = null;
  let cancelled = false;

  import("@capacitor/network")
    .then(async ({ Network }) => {
      if (cancelled) return;
      listener = await Network.addListener("networkStatusChange", (status) => {
        onChange(Boolean(status?.connected));
      });
      try {
        const status = await Network.getStatus();
        if (!cancelled) onChange(Boolean(status?.connected));
      } catch {
        // Keep whatever navigator.onLine said.
      }
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    if (listener) listener.remove().catch(() => {});
  };
}
