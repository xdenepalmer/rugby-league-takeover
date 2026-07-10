import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { emitHaptic } from "@/lib/native/haptic-events";
import {
  THEME_ACCENTS,
  getStoredThemeAccent,
  requestThemeAccent,
} from "@/lib/theme-accents";
import { NATIVE_MORE_ITEMS } from "./native-tabs.js";
import { nativeIcon } from "../components/native-icons.js";

/**
 * The Takeover sheet — every secondary destination lives here so the tab
 * bar stays at exactly five fan tabs: trip planning, Gallery, FAQ, legal,
 * the accent-theme picker (dispatches the rlt_theme_change contract App.jsx
 * already listens for), and the Admin entry for authorized users only.
 */
export default function NativeMoreSheet({ open, onClose, onOpenPlan }) {
  const navigate = useNavigate();
  const { isAdmin, isAuthenticated } = useAuth();
  const sheetRef = useRef(null);
  const [accent, setAccent] = useState(getStoredThemeAccent);

  useEffect(() => {
    if (!open) return undefined;
    setAccent(getStoredThemeAccent());
    sheetRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const go = (to) => {
    emitHaptic("action.primary");
    onClose();
    navigate(to);
  };

  const items = NATIVE_MORE_ITEMS.filter((item) => !item.requiresAdmin || isAdmin);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Takeover menu">
          <motion.button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            ref={sheetRef}
            tabIndex={-1}
            className="ios-sheet absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto border-t border-border bg-card outline-none"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 380 }}
            onAnimationComplete={() => open && emitHaptic("sheet.snap")}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
            <div className="flex items-center justify-between px-5 pt-3">
              <h2 className="font-display text-lg font-bold uppercase tracking-widest">Takeover</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="ios-pressable flex h-11 w-11 items-center justify-center text-muted-foreground"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 px-5 pt-2">
              {items.map((item) => {
                const Icon = nativeIcon(item.icon);
                const isAdminEntry = item.id === "admin";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => (item.action === "plan" ? (onClose(), onOpenPlan()) : go(item.to))}
                    className={`ios-pressable flex min-h-14 items-center gap-3 border px-4 py-3 text-left text-sm font-bold uppercase tracking-wide ${
                      isAdminEntry
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-border bg-background/60"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="px-5 pb-3 pt-5">
              <p className="pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Accent theme
              </p>
              <div className="flex items-center gap-3" role="radiogroup" aria-label="Accent theme">
                {Object.entries(THEME_ACCENTS).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={accent === key}
                    aria-label={config.label}
                    onClick={() => {
                      if (requestThemeAccent(key)) {
                        setAccent(key);
                        emitHaptic("action.primary");
                      }
                    }}
                    className={`ios-pressable h-11 w-11 rounded-full border-2 transition-transform ${
                      accent === key ? "scale-110 border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: `hsl(${config.primary})` }}
                  />
                ))}
              </div>
            </div>

            {!isAuthenticated && (
              <div className="grid grid-cols-2 gap-2 px-5 pb-4">
                <button
                  type="button"
                  onClick={() => go("/login")}
                  className="ios-pressable flex min-h-12 items-center justify-center gap-2 bg-primary px-4 text-sm font-bold uppercase tracking-wide text-primary-foreground"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" /> Sign in
                </button>
                <button
                  type="button"
                  onClick={() => go("/register")}
                  className="ios-pressable flex min-h-12 items-center justify-center gap-2 border border-border px-4 text-sm font-bold uppercase tracking-wide"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" /> Join up
                </button>
              </div>
            )}

            <div className="pb-[max(1rem,var(--safe-bottom))]" />
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
