import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { queryClientInstance } from "@/lib/query-client";
import { initNativeLifecycle } from "@/lib/native/app-lifecycle";
import { addPushListeners } from "@/lib/native/push";
import { resolvePushRoute } from "@/lib/native/push-routing";

/**
 * Mounted once inside the native route tree: query-cache persistence
 * (dynamic import so the persist packages stay out of web chunks),
 * foreground-resume freshness, and notification-tap routing into the
 * exact screen a notification is about.
 */
export default function NativeRuntime() {
  // Under BrowserRouter, `navigate` changes identity on every navigation;
  // Capacitor listeners must register once per mount, so handlers read the
  // latest navigate via a ref instead of re-registering on every nav.
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    let persistence = null;
    let cancelled = false;
    import("@/lib/native/query-persistence.js")
      .then((mod) => {
        if (cancelled) return;
        persistence = mod.initNativeQueryPersistence(queryClientInstance);
      })
      .catch(() => {});
    const stopLifecycle = initNativeLifecycle(queryClientInstance);
    return () => {
      cancelled = true;
      persistence?.cleanup?.();
      stopLifecycle();
    };
  }, []);

  useEffect(() => {
    const removePushListeners = addPushListeners({
      onActioned: (action) => {
        const route = resolvePushRoute(action?.notification?.data);
        navigateRef.current(route);
      },
    });
    return removePushListeners;
  }, []);

  return null;
}
