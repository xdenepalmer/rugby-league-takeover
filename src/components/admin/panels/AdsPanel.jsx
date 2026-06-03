import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone, Activity, Shield, Gauge, BarChart3, Eye,
  Building2, CalendarRange, DollarSign, LayoutTemplate,
} from "lucide-react";
import AdsManager from "../AdsManager";
import SponsorManager from "../SponsorManager";
import CampaignCalendar from "../CampaignCalendar";
import AdRevenueTracker from "../AdRevenueTracker";

/* ── localStorage helpers ── */
function readLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export default function AdsPanel() {
  const [activeTab, setActiveTab] = useState("ads");

  /* Read shared data for all tabs */
  const ads = readLS("rlt_ad_config", []);
  const sponsors = readLS("rlt_sponsors", []);
  const stats = readLS("rlt_ad_stats", {});

  const tabs = [
    { id: "ads",       label: "Ad Manager",      icon: LayoutTemplate },
    { id: "sponsors",  label: "Sponsors",         icon: Building2 },
    { id: "calendar",  label: "Campaign Calendar", icon: CalendarRange },
    { id: "revenue",   label: "Revenue & Reports", icon: DollarSign },
  ];

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
            <Megaphone className="h-4 w-4 text-primary" />
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-primary font-mono">
              Revenue Module
            </p>
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-primary/5 border border-primary/10">
              <Activity className="h-2.5 w-2.5 text-primary cmd-pulse" />
              <span className="text-[8px] font-bold uppercase tracking-wider text-primary">Plug &amp; Play</span>
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl uppercase leading-none tracking-wide">
            Advertising &amp; Sponsorship Platform
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Manage sponsors, create ad campaigns, schedule placements, track revenue,
            generate reports, and run A/B tests — your complete advertising command centre.
          </p>

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
        </div>
      </motion.div>

      {/* ── Tabs Navigation ── */}
      <div className="flex border-b border-border/60 overflow-x-auto cmd-scrollbar bg-secondary/15 backdrop-blur-sm p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors duration-200 shrink-0 select-none ${
                isActive ? "text-foreground font-extrabold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground/60"}`} />
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="ads-panel-tab-glow"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  style={{ boxShadow: "0 0 10px hsl(var(--primary)/0.6)" }}
                />
              )}
            </button>
          );
        })}
      </div>

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
