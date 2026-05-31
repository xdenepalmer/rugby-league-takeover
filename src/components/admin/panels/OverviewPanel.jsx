import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Users as UsersIcon, ShieldAlert } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminOverview from "../AdminOverview";

export default function OverviewPanel() {
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: () => base44.entities.StoreOrder.list("-created_date", 200) });
  const { data: registrations = [] } = useQuery({ queryKey: ["registrations"], queryFn: () => base44.entities.InterestRegistration.list("-created_date", 200) });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => base44.entities.Product.list("sort_order", 200) });
  const { data: news = [] } = useQuery({ queryKey: ["news"], queryFn: () => base44.entities.NewsArticle.list("-published_date", 50) });
  const { data: forumPosts = [] } = useQuery({ queryKey: ["forumPosts"], queryFn: () => base44.entities.ForumPost.list("-created_date", 200) });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => base44.entities.User.list("-created_date", 200) });

  const counts = { news: news.length, products: products.length, orders: orders.length, registrations: registrations.length, posts: forumPosts.length };
  const pendingPosts = forumPosts.filter((p) => p.is_published !== true).length;

  return (
    <div className="grid gap-6">
      <AdminOverview counts={counts} registrations={registrations} orders={orders} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between border border-border bg-card/40 p-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Registered accounts</p>
            <p className="mt-1 font-display text-3xl text-foreground">{users.length}</p>
          </div>
          <UsersIcon className="h-8 w-8 stroke-1 text-primary" />
        </div>
        <div className="flex items-center justify-between border border-border bg-card/40 p-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Posts awaiting moderation</p>
            <p className="mt-1 font-display text-3xl text-foreground">{pendingPosts}</p>
          </div>
          <ShieldAlert className="h-8 w-8 stroke-1 text-accent" />
        </div>
      </div>
    </div>
  );
}
