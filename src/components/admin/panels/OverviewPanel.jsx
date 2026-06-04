import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users as UsersIcon, ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import AdminOverview from "@/components/admin/AdminOverview";
import ActivityFeed from "@/components/admin/ActivityFeed";
import RevenueBreakdown from "@/components/admin/RevenueBreakdown";
import AdminNotepad from "@/components/admin/AdminNotepad";
import DataExporter from "@/components/admin/DataExporter";
import ActionQueue from "@/components/admin/ActionQueue";

/* Map ActionQueue panel names → admin routes */
const PANEL_ROUTE_MAP = {
  orders: "/admin/store",
  store: "/admin/store",
  products: "/admin/store",
  forum: "/admin/community",
  community: "/admin/community",
  registrations: "/admin/people",
  people: "/admin/people",
  news: "/admin/content",
  content: "/admin/content",
  events: "/admin/events",
  ads: "/admin/ads",
};

export default function OverviewPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showStats, setShowStats] = useState(true);

  const handleNavigate = useCallback(
    (panel) => {
      const route = PANEL_ROUTE_MAP[panel] || "/admin/overview";
      navigate(route);
    },
    [navigate],
  );

  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: () => base44.entities.StoreOrder.list("-created_date", 200), staleTime: 60_000 });
  const { data: registrations = [] } = useQuery({ queryKey: ["registrations"], queryFn: () => base44.entities.InterestRegistration.list("-created_date", 200), staleTime: 60_000 });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => base44.entities.Product.list("sort_order", 200), staleTime: 60_000 });
  const { data: news = [] } = useQuery({ queryKey: ["news"], queryFn: () => base44.entities.NewsArticle.list("-published_date", 50), staleTime: 60_000 });
  const { data: forumPosts = [] } = useQuery({ queryKey: ["forumPosts"], queryFn: () => base44.entities.ForumPost.list("-created_date", 200), staleTime: 60_000 });
  const { data: testimonials = [] } = useQuery({ queryKey: ["testimonials"], queryFn: () => base44.entities.Testimonial.list("sort_order", 200), staleTime: 60_000, retry: false, meta: { silent: true } });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await base44.functions.invoke("adminUsers", { action: "list" });
      return response?.data?.users || [];
    },
    retry: false,
    meta: { silent: true },
  });

  const pendingPosts = forumPosts.filter((p) => p.is_published !== true).length;
  const pendingTestimonials = testimonials.filter((t) => t.is_published === false).length;
  const counts = { news: news.length, products: products.length, orders: orders.length, registrations: registrations.length, posts: forumPosts.length, pendingPosts, pendingTestimonials };

  /* ── Stat overrides from SiteSettings ── */
  const { data: settingsRecords = [] } = useQuery({
    queryKey: ["siteSettings"],
    queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1),
    staleTime: 60_000,
  });
  const siteSettings = settingsRecords[0] || {};
  const statOverrides = (() => {
    try {
      if (typeof siteSettings.stat_overrides === "string") return JSON.parse(siteSettings.stat_overrides);
      if (typeof siteSettings.stat_overrides === "object" && siteSettings.stat_overrides) return siteSettings.stat_overrides;
    } catch {}
    return {};
  })();

  const overrideMutation = useMutation({
    mutationFn: async ({ key, value }) => {
      const current = { ...statOverrides };
      if (value === null || value === undefined) {
        delete current[key];
      } else {
        current[key] = value;
      }
      const payload = { stat_overrides: JSON.stringify(current) };
      if (siteSettings.id) {
        return base44.entities.SiteSettings.update(siteSettings.id, payload);
      } else {
        return base44.entities.SiteSettings.create(payload);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["siteSettings"] }),
  });

  const handleSaveOverride = useCallback((key, value) => {
    overrideMutation.mutate({ key, value });
  }, [overrideMutation]);

  return (
    <div className="grid gap-5">
      {/* ── Action Queue (what needs the owner now) ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <ActionQueue
          orders={orders}
          forumPosts={forumPosts}
          registrations={registrations}
          products={products}
          news={news}
          testimonials={testimonials}
          onNavigate={handleNavigate}
        />
      </motion.div>

      {/* ── Collapsible Quick Stats ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <button
          type="button"
          onClick={() => setShowStats((s) => !s)}
          className="w-full flex items-center justify-between px-4 py-3 border border-border bg-card/40 cmd-glass hover:bg-card/60 transition-colors"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            {showStats ? "Hide Stats" : "Show Stats"}
          </span>
          {showStats ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <AnimatePresence initial={false}>
          {showStats && (
            <motion.div
              key="stats-section"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="grid gap-5 pt-4">
              <AdminOverview counts={counts} registrations={registrations} orders={orders} statOverrides={statOverrides} onSaveOverride={handleSaveOverride} />

                {/* ── Additional Stats Row ── */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55, duration: 0.4 }}
                    className="group relative overflow-hidden border border-border bg-card/60 cmd-glass hover:border-primary/30 transition-all duration-300"
                  >
                    <div className="h-[2px] w-full bg-gradient-to-r from-violet-500 via-violet-400 to-violet-500" />
                    <div className="p-5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                          Registered accounts
                        </p>
                        <p className="mt-1 font-display text-3xl text-foreground">{users.length}</p>
                        <p className="text-[9px] font-mono text-muted-foreground mt-1">Platform users</p>
                      </div>
                      <div className="p-2 border border-border/50 bg-muted/30">
                        <UsersIcon className="h-5 w-5 text-violet-400" />
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    className="group relative overflow-hidden border border-border bg-card/60 cmd-glass hover:border-accent/30 transition-all duration-300"
                  >
                    <div className="h-[2px] w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />
                    <div className="p-5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                          Posts awaiting moderation
                        </p>
                        <p className="mt-1 font-display text-3xl text-foreground">{pendingPosts}</p>
                        <p className="text-[9px] font-mono text-muted-foreground mt-1">
                          {pendingPosts > 0 ? "Requires attention" : "All clear"}
                        </p>
                      </div>
                      <div className="p-2 border border-border/50 bg-muted/30">
                        <ShieldAlert className={`h-5 w-5 ${pendingPosts > 0 ? "text-amber-400 cmd-pulse" : "text-muted-foreground"}`} />
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* ── Revenue Analytics (moved into collapsible) ── */}
                <RevenueBreakdown orders={orders} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Activity Feed + Owner Notepad ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="grid gap-5 lg:grid-cols-2"
      >
        <ActivityFeed orders={orders} registrations={registrations} forumPosts={forumPosts} />
        <AdminNotepad />
      </motion.div>

      {/* ── Data Export Centre ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
      >
        <DataExporter registrations={registrations} orders={orders} forumPosts={forumPosts} />
      </motion.div>
    </div>
  );
}
