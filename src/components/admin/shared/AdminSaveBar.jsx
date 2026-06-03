/* ━━━ AdminSaveBar ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Sticky bottom bar that appears when a form has unsaved changes.
 * Fixed to bottom, safe-area aware.
 *
 * Usage:
 *   <AdminSaveBar
 *     show={isDirty}
 *     onSave={handleSave}
 *     onDiscard={handleDiscard}
 *     saving={mutation.isPending}
 *   />
 */
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminSaveBar({
  show = false,
  onSave,
  onDiscard,
  saving = false,
  saveLabel = "Save changes",
  discardLabel = "Discard",
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 300 }}
          className="fixed bottom-0 inset-x-0 z-[100] border-t border-border bg-card/95 backdrop-blur-md pb-[var(--safe-bottom,0px)]"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 max-w-5xl mx-auto">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary hidden sm:block">
              Unsaved changes
            </p>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="ghost"
                onClick={onDiscard}
                disabled={saving}
                className="min-h-[44px] rounded-none text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                {discardLabel}
              </Button>
              <Button
                onClick={onSave}
                disabled={saving}
                className="min-h-[44px] rounded-none bg-primary hover:bg-primary/90 text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_hsl(var(--primary)/0.2)]"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? "Saving…" : saveLabel}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
