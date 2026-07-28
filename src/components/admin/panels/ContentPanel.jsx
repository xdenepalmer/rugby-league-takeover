import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Newspaper, Plane, Award, Quote, HelpCircle, Images } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminPanelHeader from "../shared/AdminPanelHeader";
import AdminPanelTabs from "../shared/AdminPanelTabs";
import NewsManager from "../NewsManager";
import TravelPackagesManager from "../TravelPackagesManager";
import PartnersManager from "../PartnersManager";
import TestimonialsManager from "../TestimonialsManager";
import FaqManager from "../FaqManager";
import GalleryManager from "../GalleryManager";

export default function ContentPanel() {
  const [activeTab, setActiveTab] = useState("news");
  const { data: news = [] } = useQuery({ queryKey: ["news"], queryFn: () => base44.entities.NewsArticle.list("-published_date", 50) });
  const { data: packages = [] } = useQuery({ queryKey: ["packages"], queryFn: () => base44.entities.TravelPackage.list("sort_order", 200) });
  const { data: partners = [] } = useQuery({ queryKey: ["partners"], queryFn: () => base44.entities.Partner.list("sort_order", 200), retry: false, meta: { silent: true } });
  const { data: testimonials = [] } = useQuery({ queryKey: ["testimonials"], queryFn: () => base44.entities.Testimonial.list("sort_order", 200), retry: false, meta: { silent: true } });
  const { data: faqs = [] } = useQuery({ queryKey: ["faqs"], queryFn: () => base44.entities.Faq.list("sort_order", 200), retry: false, meta: { silent: true } });
  const { data: gallery = [] } = useQuery({ queryKey: ["gallery"], queryFn: () => base44.entities.GalleryItem.list("sort_order", 200), retry: false, meta: { silent: true } });

  const tabs = [
    { id: "news", label: "News Articles", icon: Newspaper, count: news.length },
    { id: "packages", label: "Travel Packages", icon: Plane, count: packages.length },
    { id: "partners", label: "Partners & Sponsors", icon: Award, count: partners.length },
    { id: "testimonials", label: "Testimonials", icon: Quote, count: testimonials.length },
    { id: "faqs", label: "FAQs", icon: HelpCircle, count: faqs.length },
    { id: "gallery", label: "Gallery", icon: Images, count: gallery.length },
  ];

  return (
    <div className="grid grid-cols-1 gap-5">
      <AdminPanelHeader
        icon={FileText}
        module="Content Module"
        title="Content Management"
        description="Manage news articles, travel packages, and editorial content for the takeover. Published articles appear on the homepage and news feed."
      />

      <AdminPanelTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        layoutId="content-subtabs-glow"
        ariaLabel="Content tabs"
      />

      {/* Active Tab Panel */}
      <div className="min-h-[250px]" role="tabpanel">
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

          {activeTab === "testimonials" && (
            <motion.div
              key="testimonials-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <TestimonialsManager testimonials={testimonials} />
            </motion.div>
          )}

          {activeTab === "faqs" && (
            <motion.div
              key="faqs-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <FaqManager faqs={faqs} category="general" />
            </motion.div>
          )}

          {activeTab === "gallery" && (
            <motion.div
              key="gallery-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <GalleryManager items={gallery} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}