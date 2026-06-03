/* ━━━ Better Empty State ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import React from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FORUM_CATEGORIES } from "@/lib/public-forms";
import { getCategoryMeta } from "./forumHelpers";

export default function EmptyState({ onClearFilters, onSelectCategory }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border/30 bg-card/20 p-16 text-center"
    >
      <motion.div
        className="inline-flex p-5 bg-gradient-to-br from-primary/10 to-accent/5 border border-border/30 mb-5"
        animate={{
          y: [0, -8, 0],
          rotate: [0, 3, -3, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Search className="h-10 w-10 text-primary" />
      </motion.div>
      <p className="font-display text-2xl uppercase text-slate-200 tracking-wide">
        No discussions found
      </p>
      <p className="text-sm text-slate-300 mt-2 max-w-sm mx-auto leading-relaxed">
        Try adjusting your filters, or be the first to spark a conversation in one of these categories:
      </p>
      <div className="flex flex-wrap justify-center gap-2 mt-6">
        {FORUM_CATEGORIES.slice(0, 3).map((cat) => {
          const m = getCategoryMeta(cat);
          const CatIcon = m.icon;
          return (
            <motion.button
              key={cat}
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelectCategory(cat)}
              className={`flex min-h-11 items-center gap-2 px-4 py-2.5 border border-border/30 bg-gradient-to-r ${m.gradient} text-[10px] font-bold uppercase tracking-wider text-foreground hover:border-primary/30 transition-all`}
            >
              <CatIcon className={`h-3.5 w-3.5 ${m.accent}`} />
              {m.label}
            </motion.button>
          );
        })}
      </div>
      <Button
        onClick={onClearFilters}
        variant="outline"
        size="mobile"
        className="mt-5 rounded-none text-[10px] font-bold uppercase tracking-wider border-border/30"
      >
        Clear all filters
      </Button>
    </motion.div>
  );
}
