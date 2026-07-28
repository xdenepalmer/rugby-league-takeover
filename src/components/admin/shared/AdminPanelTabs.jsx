/* ━━━ AdminPanelTabs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Sub-tab bar used by the admin panels. Each tab is { id, label, icon, count? };
 * the count chip is only rendered when a numeric count is supplied. `layoutId`
 * must be unique per panel so the framer underline animates within one bar.
 */
import React from "react";
import { motion } from "framer-motion";

const TONES = {
  primary: {
    icon: "text-primary",
    chip: "bg-primary/20 text-primary border-primary/25",
    underline: "bg-primary",
    glow: "0 0 10px hsl(var(--primary)/0.6)",
  },
  accent: {
    icon: "text-accent",
    chip: "bg-accent/20 text-accent border-accent/25",
    underline: "bg-accent",
    glow: "0 0 10px hsl(var(--accent)/0.6)",
  },
};

export default function AdminPanelTabs({ tabs, activeTab, onChange, layoutId, ariaLabel, tone = "primary" }) {
  const toneClasses = TONES[tone] || TONES.primary;

  return (
    <div
      className="flex border-b border-border/60 overflow-x-auto cmd-scrollbar bg-secondary/15 backdrop-blur-sm p-1"
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            role="tab"
            aria-selected={isActive}
            className={`relative flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors duration-200 shrink-0 select-none ${
              isActive ? "text-foreground font-extrabold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className={`h-4 w-4 ${isActive ? toneClasses.icon : "text-muted-foreground/60"}`} />
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span className={`text-[9px] font-mono px-1.5 py-0.25 border ${isActive ? toneClasses.chip : "bg-muted/30 text-muted-foreground border-border/40"}`}>
                {tab.count}
              </span>
            )}
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className={`absolute bottom-0 left-0 right-0 h-0.5 ${toneClasses.underline}`}
                style={{ boxShadow: toneClasses.glow }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
