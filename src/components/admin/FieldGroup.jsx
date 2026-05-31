import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

export default function FieldGroup({ title, help, children, step, icon: Icon, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border/60 bg-background/30 overflow-hidden group/field transition-all duration-300 hover:border-border">
      {/* Accordion header */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer focus:outline-none transition-colors hover:bg-muted/20"
      >
        {/* Step indicator */}
        {step != null && (
          <div className="flex-none flex items-center justify-center h-6 w-6 border border-primary/30 bg-primary/10 text-primary">
            <span className="text-[10px] font-bold font-mono">{step}</span>
          </div>
        )}

        {/* Icon */}
        {Icon && (
          <div className="flex-none p-1 border border-border/40 bg-muted/20">
            <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover/field:text-primary transition-colors" />
          </div>
        )}

        {/* Title & help */}
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-foreground group-hover/field:text-primary transition-colors">
            {title}
          </h3>
          {help && (
            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground/70 truncate">
              {help}
            </p>
          )}
        </div>

        {/* Status dot — visual indicator that section has content */}
        <div className="flex-none flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20">
            <Check className="h-2.5 w-2.5 text-emerald-400" />
          </span>

          <motion.div
            animate={{ rotate: open ? 0 : -90 }}
            transition={{ duration: 0.2 }}
            className="p-0.5"
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground group-hover/field:text-primary transition-colors" />
          </motion.div>
        </div>
      </button>

      {/* Thin separator when open */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="fieldgroup-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {/* Subtle gradient divider */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

            <div className="p-4">
              <div className="grid gap-4 md:grid-cols-2">{children}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}