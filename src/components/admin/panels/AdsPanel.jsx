import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone, Shield, Gauge, BarChart3, Eye,
  Building2, CalendarRange, DollarSign, LayoutTemplate,
} from "lucide-react";
import { readJson } from "@/lib/local-storage";
import AdminPanelHeader from "../shared/AdminPanelHeader";
import AdminPanelTabs from "../shared/AdminPanelTabs";
import AdsManager from "../AdsManager";
import SponsorManager from "../SponsorManager";
import CampaignCalendar from "../CampaignCalendar";
import AdRevenueTracker from "../AdRevenueTracker";

export default function AdsPanel() {
  const [activeTab, setActiveTab] = useState("ads");

  /* Read shared data for all tabs */
  const ads = readJson("rlt_ad_config", []);
  const sponsors = readJson("rlt_sponsors", []);
  const stats = readJson("rlt_ad_stats", {});

  const tabs = [
    { id: "ads",       label: "Ad Manager",      icon: LayoutTemplate },
    { id: "sponsors",  label: "Sponsors",         icon: Building2 },
    { id: "calendar",  label: "Campaign Calendar", icon: CalendarRange },
    { id: "revenue",   label: "Revenue & Reports", icon: DollarSign },
  ];

  return (
    <div className="grid grid-cols-1 gap-5">
      <AdminPanelHeader
        icon={Megaphone}
        module="Revenue Module"
        badge="Plug & Play"
        title="Advertising & Sponsorship Platform"
        description="Manage sponsors, create ad campaigns, schedule placements, track revenue, generate reports, and run A/B tests — your complete advertising command centre."
      >
        {/* Feature highlights */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { icon: Eye,          label: "Viewability",      desc: "50% visible for 1s" },
            { icon: Gauge,        label: "Smart Rotation",   desc: "Weighted by views" },
            { icon: Shield,       label: "Fraud Protection", desc: "Rate-limited clicks" },
            { icon: BarChart3,    label: "Analytics",        desc: "Impressions & CTR" },
            { icon: Building2,    label: "Sponsors",         desc: "Advertiser profiles" },
            { icon: CalendarRange,label: "Calendar",         desc: "Campaign timeline" },
            { icon: DollarSign,   label: "Revenue",          desc: "Financial tracking" },
            { icon: Megaphone,    label: "A/B Testing",      desc: "Creative comparison" },
          ].map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-start gap-2 border border-border/30 bg-muted/5 px-3 py-2"
            >
              <Icon className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-foreground/80">{label}</p>
                <p className="text-[8px] text-muted-foreground/60 font-mono">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </AdminPanelHeader>

      <AdminPanelTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        layoutId="ads-panel-tab-glow"
        ariaLabel="Advertising tabs"
      />

      {/* ── Active Tab Content ── */}
      <AnimatePresence mode="wait">
        {activeTab === "ads" && (
          <motion.div
            key="ads-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <AdsManager />
          </motion.div>
        )}

        {activeTab === "sponsors" && (
          <motion.div
            key="sponsors-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <SponsorManager />
          </motion.div>
        )}

        {activeTab === "calendar" && (
          <motion.div
            key="calendar-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <CampaignCalendar ads={ads} sponsors={sponsors} />
          </motion.div>
        )}

        {activeTab === "revenue" && (
          <motion.div
            key="revenue-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <AdRevenueTracker ads={ads} sponsors={sponsors} stats={stats} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
