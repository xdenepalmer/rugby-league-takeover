/* ━━━ Collapsible Guidelines ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

export default function CollapsibleGuidelines() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/30 bg-card/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/5 transition-colors"
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300">Community Guidelines</p>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-3 w-3 text-slate-200" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ul className="space-y-1.5 px-4 pb-4">
              {["Be respectful to fellow fans", "Keep discussions on-topic", "No spam or commercial posts", "Share tips, ask questions, have fun"].map((rule) => (
                <li key={rule} className="flex items-start gap-2.5 text-[11px] text-slate-200 font-medium py-0.5">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                  {rule}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
