/* ━━━ AdminConfirmSheet ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * App-native confirmation dialog replacing window.confirm().
 * Bottom-sheet on mobile, centered dialog on desktop.
 */
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const backdrop = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const sheet = {
  hidden: { y: "100%", opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 28, stiffness: 300 } },
  exit: { y: "100%", opacity: 0, transition: { duration: 0.2 } },
};

const dialog = {
  hidden: { scale: 0.92, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { type: "spring", damping: 24, stiffness: 350 } },
  exit: { scale: 0.92, opacity: 0, transition: { duration: 0.15 } },
};

export default function AdminConfirmSheet({
  open = false,
  title = "Are you sure?",
  description = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default", // "default" | "destructive"
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const isDestructive = variant === "destructive";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="confirm-backdrop"
          variants={backdrop}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-[200] flex items-end lg:items-center lg:justify-center"
          onClick={onCancel}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Mobile: bottom sheet */}
          <motion.div
            variants={sheet}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full border-t border-border bg-card p-6 pb-[calc(1.5rem+var(--safe-bottom,0px))] lg:hidden"
          >
            <div className="mx-auto mb-4 h-1 w-10 bg-muted-foreground/20 rounded-full" />
            <div className="flex items-start gap-3">
              <div className={`p-2 shrink-0 ${isDestructive ? "bg-destructive/10 border border-destructive/20" : "bg-primary/10 border border-primary/20"}`}>
                <AlertTriangle className={`h-5 w-5 ${isDestructive ? "text-destructive" : "text-primary"}`} />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-lg uppercase tracking-wide">{title}</h3>
                {description && <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>}
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={loading}
                className="min-h-[48px] rounded-none text-xs font-bold uppercase tracking-widest"
              >
                {cancelLabel}
              </Button>
              <Button
                onClick={onConfirm}
                disabled={loading}
                className={`min-h-[48px] rounded-none text-xs font-bold uppercase tracking-widest ${
                  isDestructive
                    ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    : "bg-primary hover:bg-primary/90"
                }`}
              >
                {loading ? "Processing…" : confirmLabel}
              </Button>
            </div>
          </motion.div>

          {/* Desktop: centered dialog */}
          <motion.div
            variants={dialog}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 hidden lg:block w-full max-w-md border border-border bg-card p-6"
          >
            <button onClick={onCancel} className="absolute right-3 top-3 p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className={`p-2 shrink-0 ${isDestructive ? "bg-destructive/10 border border-destructive/20" : "bg-primary/10 border border-primary/20"}`}>
                <AlertTriangle className={`h-5 w-5 ${isDestructive ? "text-destructive" : "text-primary"}`} />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-lg uppercase tracking-wide">{title}</h3>
                {description && <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={loading}
                className="min-h-[44px] rounded-none text-xs font-bold uppercase tracking-widest"
              >
                {cancelLabel}
              </Button>
              <Button
                onClick={onConfirm}
                disabled={loading}
                className={`min-h-[44px] rounded-none text-xs font-bold uppercase tracking-widest ${
                  isDestructive
                    ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    : "bg-primary hover:bg-primary/90"
                }`}
              >
                {loading ? "Processing…" : confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
