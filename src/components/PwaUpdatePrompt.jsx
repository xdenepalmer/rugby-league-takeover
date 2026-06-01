import React, { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { shouldEnablePwa } from "@/lib/pwa-env";

// Shows a friendly "new version available" prompt when a freshly published build
// is detected, and reloads into it on the user's say-so. Reliability notes:
//  - sw.js is byte-stamped per build (vite.config.js) so update() actually finds it.
//  - We only reload after the user accepts (avoids first-install reload loops).
//  - We poll for updates on an interval and whenever the app regains focus, so an
//    always-open installed PWA still notices a new publish.
export default function PwaUpdatePrompt() {
  const [waiting, setWaiting] = useState(null);
  const accepted = useRef(false);

  useEffect(() => {
    if (!shouldEnablePwa() || !("serviceWorker" in navigator)) return undefined;

    let registration;
    let interval;

    const onControllerChange = () => {
      // Only reload once the user has chosen to update.
      if (accepted.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const trackInstalling = (worker) => {
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        // "installed" + an existing controller ⇒ this is an update, not first run.
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setWaiting(registration.waiting || worker);
        }
      });
    };

    navigator.serviceWorker.ready
      .then((reg) => {
        registration = reg;
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => trackInstalling(reg.installing));

        const check = () => { reg.update().catch(() => {}); };
        interval = setInterval(check, 60 * 1000);
        const onVisible = () => { if (document.visibilityState === "visible") check(); };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", check);
        registration._cleanup = () => {
          document.removeEventListener("visibilitychange", onVisible);
          window.removeEventListener("focus", check);
        };
      })
      .catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (interval) clearInterval(interval);
      registration?._cleanup?.();
    };
  }, []);

  const update = () => {
    accepted.current = true;
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
      // Fallback in case controllerchange doesn't fire (rare).
      setTimeout(() => window.location.reload(), 2500);
    } else {
      window.location.reload();
    }
  };

  if (!waiting) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3 pb-[max(1rem,calc(1rem+var(--safe-bottom)))] lg:pb-4 pointer-events-none">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 border border-primary/40 bg-card/95 cmd-glass p-3 shadow-2xl shadow-black/40">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-primary/30 bg-primary/10 text-primary">
          <RefreshCw className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">A new version is available</p>
          <p className="text-xs text-muted-foreground">Update to get the latest features and fixes.</p>
        </div>
        <button
          type="button"
          onClick={update}
          className="shrink-0 rounded-none bg-primary px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary/90"
        >
          Update
        </button>
        <button
          type="button"
          onClick={() => setWaiting(null)}
          aria-label="Dismiss"
          className="shrink-0 p-1.5 text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
