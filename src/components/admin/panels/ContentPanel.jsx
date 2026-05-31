import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Activity, Newspaper, Plane, Award } from "lucide-react";
import { base44 } from "@/api/base44Client";
import NewsManager from "../NewsManager";
import TravelPackagesManager from "../TravelPackagesManager";
import PartnersManager from "../PartnersManager";

export default function ContentPanel() {
  const [activeTab, setActiveTab] = useState("news");
  const { data: news = [] } = useQuery({ queryKey: ["news"], queryFn: () => base44.entities.NewsArticle.list("-published_date", 50) });
  const { data: packages = [] } = useQuery({ queryKey: ["packages"], queryFn: () => base44.entities.TravelPackage.list("sort_order", 200) });
  const { data: partners = [] } = useQuery({ queryKey: ["partners"], queryFn: () => base44.entities.Partner.list("sort_order", 200), retry: false, meta: { silent: true } });

  const tabs = [
    { id: "news", label: "News Articles", icon: Newspaper, count: news.length },
    { id: "packages", label: "Travel Packages", icon: Plane, count: packages.length },
    { id: "partners", label: "Partners & Sponsors", icon: Award, count: partners.length },
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
            <FileText className="h-4 w-4 text-primary" />
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-primary font-mono">
              Content Module
            </p>
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-primary/5 border border-primary/10">
              <Activity className="h-2.5 w-2.5 text-primary cmd-pulse" />
              <span className="text-[8px] font-bold uppercase tracking-wider text-primary">Live</span>
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl uppercase leading-none tracking-wide">
            Content Management
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Manage news articles, travel packages, and editorial content for the takeover.
            Published articles appear on the homepage and news feed.
          </p>
        </div>
      </motion.div>

      {/* Tabs navigation bar */}
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
              <span className={`text-[9px] font-mono px-1.5 py-0.25 ${isActive ? "bg-primary/20 text-primary border border-primary/25" : "bg-muted/30 text-muted-foreground border border-border/40"}`}>
                {tab.count}
              </span>
              {isActive && (
                <motion.div
                  layoutId="content-subtabs-glow"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  style={{ boxShadow: "0 0 10px hsl(var(--primary)/0.6)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Tab Panel */}
      <div className="min-h-[250px]">
        <AnimatePresence mode="wait">
          {activeTab === "news" && (
            <motion.div
              key="news-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <NewsManager articles={news} />
            </motion.div>
          )}

          {activeTab === "packages" && (
            <motion.div
              key="packages-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <TravelPackagesManager packages={packages} />
            </motion.div>
          )}

          {activeTab === "partners" && (
            <motion.div
              key="partners-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <PartnersManager partners={partners} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
