import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Users as UsersIcon, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import AdminOverview from "../AdminOverview";

export default function OverviewPanel() {
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: () => base44.entities.StoreOrder.list("-created_date", 200) });
  const { data: registrations = [] } = useQuery({ queryKey: ["registrations"], queryFn: () => base44.entities.InterestRegistration.list("-created_date", 200) });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => base44.entities.Product.list("sort_order", 200) });
  const { data: news = [] } = useQuery({ queryKey: ["news"], queryFn: () => base44.entities.NewsArticle.list("-published_date", 50) });
  const { data: forumPosts = [] } = useQuery({ queryKey: ["forumPosts"], queryFn: () => base44.entities.ForumPost.list("-created_date", 200) });
  const { data: testimonials = [] } = useQuery({ queryKey: ["testimonials"], queryFn: () => base44.entities.Testimonial.list("sort_order", 200), retry: false, meta: { silent: true } });
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

  return (
    <div className="grid gap-5">
      <AdminOverview counts={counts} registrations={registrations} orders={orders} />

      {/* Additional stats row */}
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
    </div>
  );
}
