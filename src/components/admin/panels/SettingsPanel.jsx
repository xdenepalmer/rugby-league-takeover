import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Settings, Activity } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SiteSettingsManager from "../SiteSettingsManager";

export default function SettingsPanel() {
  const { data: settingsRecords = [] } = useQuery({ queryKey: ["siteSettings"], queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1) });

  return (
    <div className="grid gap-5">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden border border-border bg-card/60 cmd-glass"
      >
        <div className="cmd-accent-bar h-[2px] w-full" />
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-muted-foreground font-mono">
              Configuration Module
            </p>
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-muted/20 border border-border">
              <Activity className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">System</span>
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl uppercase leading-none tracking-wide">
            Site Settings
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Configure global site settings, homepage content, social links, and branding.
            Changes take effect immediately across the public-facing site.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <SiteSettingsManager settings={settingsRecords[0]} />
      </motion.div>
    </div>
  );
}
