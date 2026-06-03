/* ━━━ AdminActionSheet ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Multi-action bottom sheet for overflow menus.
 * Slides up on mobile, dropdown on desktop.
 *
 * Usage:
 *   <AdminActionSheet
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     actions={[
 *       { icon: Pencil, label: "Edit", onClick: handleEdit },
 *       { icon: Trash2, label: "Delete", onClick: handleDelete, variant: "destructive" },
 *     ]}
 *   />
 */
import React from "react";
import { AnimatePresence, motion } from "framer-motion";

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

export default function AdminActionSheet({ open = false, onClose, actions = [], title }) {
  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="action-backdrop"
          variants={backdrop}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-[200] flex items-end"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          <motion.div
            variants={sheet}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full border-t border-border bg-card pb-[var(--safe-bottom,0px)]"
          >
            <div className="mx-auto mt-3 mb-2 h-1 w-10 bg-muted-foreground/20 rounded-full" />

            {title && (
              <p className="px-5 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">{title}</p>
            )}

            <div className="divide-y divide-border/30">
              {actions.map((action, i) => {
                const Icon = action.icon;
                const isDestructive = action.variant === "destructive";
                return (
                  <button
                    key={i}
                    onClick={() => { action.onClick?.(); onClose(); }}
                    disabled={action.disabled}
                    className={`flex w-full items-center gap-3 px-5 py-4 min-h-[52px] text-left transition-colors active:bg-muted/10 disabled:opacity-40 ${
                      isDestructive ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {Icon && <Icon className="h-5 w-5 shrink-0" />}
                    <span className="text-sm font-medium">{action.label}</span>
                    {action.badge && (
                      <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{action.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Cancel */}
            <div className="border-t border-border p-3">
              <button
                onClick={onClose}
                className="w-full min-h-[48px] text-sm font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
