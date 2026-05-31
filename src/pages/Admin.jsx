import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import AdminShell from "@/components/admin/AdminShell";
import NewsManager from "@/components/admin/NewsManager";
import EventsManager from "@/components/admin/EventsManager";
import RegistrationsTable from "@/components/admin/RegistrationsTable";
import ProductsManager from "@/components/admin/ProductsManager";
import OrdersManager from "@/components/admin/OrdersManager";
import ForumManager from "@/components/admin/ForumManager";
import AdminOverview from "@/components/admin/AdminOverview";
import SiteSettingsManager from "@/components/admin/SiteSettingsManager";
import TravelPackagesManager from "@/components/admin/TravelPackagesManager";
import LivePreviewPanel from "@/components/admin/LivePreviewPanel";
import QuickLinks from "@/components/admin/QuickLinks";
import UserInviteManager from "@/components/admin/UserInviteManager";

export default function Admin() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    base44.auth.isAuthenticated().then(async (authed) => {
      if (authed) setUser(await base44.auth.me());
      setLoadingUser(false);
    });
  }, []);

  const { data: settingsRecords = [] } = useQuery({ queryKey: ["siteSettings"], queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1), enabled: user?.role === "admin" });
  const { data: news = [] } = useQuery({ queryKey: ["news"], queryFn: () => base44.entities.NewsArticle.list("-published_date", 50), enabled: user?.role === "admin" });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.EventContent.list("-updated_date", 5), enabled: user?.role === "admin" });
  const { data: packages = [] } = useQuery({ queryKey: ["packages"], queryFn: () => base44.entities.TravelPackage.list("sort_order", 200), enabled: user?.role === "admin" });
  const { data: registrations = [] } = useQuery({ queryKey: ["registrations"], queryFn: () => base44.entities.InterestRegistration.list("-created_date", 200), enabled: user?.role === "admin" });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => base44.entities.Product.list("sort_order", 200), enabled: user?.role === "admin" });
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: () => base44.entities.StoreOrder.list("-created_date", 200), enabled: user?.role === "admin" });
  const { data: forumPosts = [] } = useQuery({ queryKey: ["forumPosts"], queryFn: () => base44.entities.ForumPost.list("-created_date", 200), enabled: user?.role === "admin" });

  if (loadingUser) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Loading admin…</div>;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 text-center text-foreground">
        <div className="max-w-md border border-border bg-card p-8">
          <h1 className="font-display text-4xl uppercase">Admin login required</h1>
          <p className="mt-4 text-muted-foreground">Please log in to manage the Rugby League Takeover website.</p>
          <Button className="mt-6 rounded-none bg-primary hover:bg-primary/90" onClick={() => base44.auth.redirectToLogin(window.location.href)}>Log In</Button>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return <div className="flex min-h-screen items-center justify-center bg-background px-5 text-center text-foreground">Admin access only.</div>;
  }

  return (
    <AdminShell user={user}>
      <QuickLinks />
      <div className="grid gap-8 pt-8">
        <AdminOverview counts={{ news: news.length, products: products.length, orders: orders.length, registrations: registrations.length, posts: forumPosts.length }} />
        <UserInviteManager />
        <SiteSettingsManager settings={settingsRecords[0]} />
        <ProductsManager products={products} />
        <OrdersManager orders={orders} />
        <TravelPackagesManager packages={packages} />
        <NewsManager articles={news} />
        <EventsManager event={events[0]} />
        <RegistrationsTable registrations={registrations} />
        <ForumManager posts={forumPosts} />
        <LivePreviewPanel />
      </div>
    </AdminShell>
  );
}