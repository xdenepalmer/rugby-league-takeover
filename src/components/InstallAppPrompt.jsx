import React, { useEffect, useMemo, useState } from "react";
import { Download, Plus, Share, Smartphone, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getInstallPromptMode, shouldShowInstallNudge } from "@/lib/install-prompt";
import { isNativeApp } from "@/lib/native/native-env";

const DISMISS_KEY = "rlt_install_prompt_dismissed_at";

export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissedAt, setDismissedAt] = useState(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(DISMISS_KEY);
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const mode = useMemo(() => {
    if (!ready || typeof window === "undefined") return "hidden";
    return getInstallPromptMode({
      userAgent: navigator.userAgent,
      displayModeStandalone: window.matchMedia?.("(display-mode: standalone)")?.matches,
      navigatorStandalone: navigator.standalone,
      hasBeforeInstallPrompt: Boolean(deferredPrompt),
      isNativeShell: isNativeApp(),
    });
  }, [deferredPrompt, ready]);

  const visible = mode !== "hidden" && shouldShowInstallNudge({ dismissedAt });

  const dismiss = () => {
    const now = String(Date.now());
    window.localStorage.setItem(DISMISS_KEY, now);
    setDismissedAt(now);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    setDeferredPrompt(null);
    dismiss();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          initial={{ y: 110, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 110, opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 360, damping: 34 }}
          className="fixed inset-x-3 bottom-[calc(0.85rem+var(--safe-bottom))] z-[60] mx-auto max-w-md border border-border/70 bg-background/92 shadow-2xl shadow-black/45 backdrop-blur lg:hidden"
          role="status"
        >
          <div className="cmd-accent-bar h-[2px] w-full" />
          <div className="flex items-start gap-3 p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-primary/25 bg-primary/10 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                Add RLT to your phone
              </p>
              {mode === "native" ? (
                <p className="mt-1 text-xs leading-5 text-slate-200 font-medium">
                  Install the app shell for faster admin access, offline fallback, and a cleaner mobile launch.
                </p>
              ) : (
                <p className="mt-1 text-xs leading-5 text-slate-200 font-medium">
                  On iPhone, tap Share, then Add to Home Screen for the closest native app feel.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="ios-pressable flex h-11 w-11 shrink-0 items-center justify-center text-slate-400 hover:text-foreground"
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 px-3 pb-3">
            {mode === "native" ? (
              <button
                type="button"
                onClick={install}
                className="ios-pressable flex min-h-11 items-center justify-center gap-2 border border-primary/35 bg-primary text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground"
              >
                <Download className="h-4 w-4" />
                Install
              </button>
            ) : (
              <div className="flex min-h-11 items-center justify-center gap-2 border border-border/60 bg-card/50 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">
                <Share className="h-4 w-4 text-primary" />
                Share
                <Plus className="h-4 w-4 text-accent" />
              </div>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="ios-pressable flex min-h-11 items-center justify-center border border-border/60 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300"
            >
              Later
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
