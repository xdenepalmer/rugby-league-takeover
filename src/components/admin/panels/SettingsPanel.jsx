import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Settings, HelpCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminPanelHeader from "../shared/AdminPanelHeader";
import SiteSettingsManager from "../SiteSettingsManager";
import FaqManager from "../FaqManager";

export default function SettingsPanel() {
  const { data: settingsRecords = [] } = useQuery({ queryKey: ["siteSettings"], queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1) });
  const { data: faqs = [] } = useQuery({ queryKey: ["faqs"], queryFn: () => base44.entities.Faq.list("sort_order", 200), retry: false, meta: { silent: true } });

  return (
    <div className="grid grid-cols-1 gap-5">
      <AdminPanelHeader
        icon={Settings}
        module="Configuration Module"
        title="Site Settings"
        description="Configure global site settings, homepage content, social links, and branding. Changes take effect immediately across the public-facing site."
        badge="System"
        tone="muted"
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <SiteSettingsManager settings={settingsRecords[0]} />
      </motion.div>

      <motion.div
        id="faq-management"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <div className="mb-3 flex items-center gap-2 border border-primary/25 bg-primary/[0.045] px-4 py-3">
          <HelpCircle className="h-4 w-4 text-primary" />
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-primary">FAQ Management</p>
            <p className="text-xs text-muted-foreground">Manage the questions and answers shown in the store FAQ section.</p>
          </div>
        </div>
        <FaqManager faqs={faqs} />
      </motion.div>
    </div>
  );
}