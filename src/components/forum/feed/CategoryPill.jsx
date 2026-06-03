/* ━━━ Category Pill (Interactive) ━━━━━━━━━━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import React, { memo } from "react";
import { motion } from "framer-motion";
import { getCategoryMeta } from "./forumHelpers";

const CategoryPill = memo(function CategoryPill({ value, isActive, onClick, count }) {
  const meta = getCategoryMeta(value);
  const MetaIcon = meta.icon;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      className={`relative flex min-h-11 min-w-0 items-center justify-start gap-2 border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-250 shrink-0 whitespace-nowrap ${
        isActive
          ? `border-primary/40 bg-gradient-to-r ${meta.gradient} text-foreground shadow-[0_0_16px_hsl(var(--primary)/0.12),inset_0_1px_0_hsl(var(--primary)/0.1)]`
          : `border-border/50 bg-card/20 text-slate-300 hover:text-foreground hover:bg-card/40 hover:border-border`
      }`}
    >
      <MetaIcon className={`h-3 w-3 ${isActive ? meta.accent : "text-slate-400"}`} />
      <span className="truncate">{meta.label}</span>
      {count > 0 && (
        <span className={`ml-1 px-1.5 py-0 text-[8px] font-mono tabular-nums ${
          isActive ? "bg-primary/20 text-primary" : "bg-muted/30 text-slate-300"
        }`}>
          {count}
        </span>
      )}
      {isActive && (
        <motion.div
          layoutId="activeCatLine"
          className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-accent to-primary"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </motion.button>
  );
});

export default CategoryPill;
