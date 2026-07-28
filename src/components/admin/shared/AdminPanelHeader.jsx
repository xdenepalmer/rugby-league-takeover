/* ━━━ AdminPanelHeader ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Command-deck header block at the top of every admin panel: module eyebrow,
 * status badge, display title and blurb. `tone` switches the accent colour
 * ("primary" for live modules, "accent" for the store, "muted" for config).
 */
import React from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";

const TONES = {
  primary: {
    text: "text-primary",
    badge: "bg-primary/5 border-primary/10",
    pulse: "cmd-pulse",
  },
  accent: {
    text: "text-accent",
    badge: "bg-accent/5 border-accent/10",
    pulse: "cmd-pulse",
  },
  muted: {
    text: "text-muted-foreground",
    badge: "bg-muted/20 border-border",
    pulse: "",
  },
};

export default function AdminPanelHeader({
  icon: Icon,
  module,
  title,
  description,
  badge = "Live",
  tone = "primary",
  children,
}) {
  const { text, badge: badgeClass, pulse } = TONES[tone] || TONES.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden border border-border bg-card/60 cmd-glass"
    >
      <div className="cmd-accent-bar h-[2px] w-full" />
      <div className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${text}`} />
          <p className={`text-[9px] font-bold uppercase tracking-[0.35em] font-mono ${text}`}>
            {module}
          </p>
          <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 border ${badgeClass}`}>
            <Activity className={`h-2.5 w-2.5 ${text} ${pulse}`} />
            <span className={`text-[8px] font-bold uppercase tracking-wider ${text}`}>{badge}</span>
          </span>
        </div>
        <h2 className="font-display text-3xl md:text-4xl uppercase leading-none tracking-wide">
          {title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {children}
      </div>
    </motion.div>
  );
}
