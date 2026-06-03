/* ━━━ AdminEmptyState ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Consistent empty state component for admin managers.
 *
 * Usage:
 *   <AdminEmptyState
 *     icon={Package}
 *     title="No orders yet"
 *     description="Orders will appear here once customers place them."
 *     action={{ label: "View store", onClick: () => navigate("/store") }}
 *   />
 */
import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function AdminEmptyState({
  icon: Icon,
  title = "Nothing here yet",
  description = "",
  action,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      {Icon && (
        <div className="mb-4 p-4 border border-border/40 bg-card/30">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="font-display text-xl uppercase tracking-wide text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">{description}</p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          className="mt-6 min-h-[44px] rounded-none bg-primary hover:bg-primary/90 text-xs font-bold uppercase tracking-widest"
        >
          {action.icon && <action.icon className="mr-2 h-4 w-4" />}
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}
