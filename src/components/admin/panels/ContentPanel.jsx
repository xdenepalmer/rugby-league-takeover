import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileText, Activity } from "lucide-react";
import { base44 } from "@/api/base44Client";
import NewsManager from "../NewsManager";
import TravelPackagesManager from "../TravelPackagesManager";
import PartnersManager from "../PartnersManager";

export default function ContentPanel() {
  const { data: news = [] } = useQuery({ queryKey: ["news"], queryFn: () => base44.entities.NewsArticle.list("-published_date", 50) });
  const { data: packages = [] } = useQuery({ queryKey: ["packages"], queryFn: () => base44.entities.TravelPackage.list("sort_order", 200) });
  const { data: partners = [] } = useQuery({ queryKey: ["partners"], queryFn: () => base44.entities.Partner.list("sort_order", 200), retry: false, meta: { silent: true } });

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

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <NewsManager articles={news} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <TravelPackagesManager packages={packages} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <PartnersManager partners={partners} />
      </motion.div>
    </div>
  );
}
