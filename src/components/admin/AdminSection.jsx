import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Activity } from "lucide-react";

export default function AdminSection({ id, eyebrow, title, description, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="scroll-mt-28 relative overflow-hidden border border-border bg-card/60 cmd-glass"
    >
      {/* Gradient accent bar */}
      <div className="cmd-accent-bar h-[2px] w-full" />

      {/* Scanning overlay on hover */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-0 hover:opacity-100 transition-opacity">
        <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent cmd-scan-line" />
      </div>

      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full text-left p-6 pb-0 group cursor-pointer focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Eyebrow row */}
            <div className="flex items-center gap-2 mb-2">
              {Icon && (
                <div className="p-1.5 border border-border/50 bg-muted/30">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              {!Icon && <Activity className="h-3 w-3 text-primary/60" />}
              <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-primary font-mono">
                {eyebrow}
              </p>
              <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 bg-primary/5 border border-primary/10">
                <span className="h-1 w-1 rounded-full bg-primary cmd-blink" />
                <span className="text-[7px] font-bold uppercase tracking-wider text-primary/70">Active</span>
              </span>
            </div>

            {/* Title */}
            <h2 className="font-display text-3xl md:text-4xl uppercase leading-none tracking-wide text-foreground">
              {title}
            </h2>

            {description && (
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            )}
          </div>

          {/* Collapse toggle */}
          <motion.div
            animate={{ rotate: open ? 0 : -90 }}
            transition={{ duration: 0.25 }}
            className="mt-1 p-2 border border-border/40 bg-muted/20 group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors"
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </motion.div>
        </div>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}