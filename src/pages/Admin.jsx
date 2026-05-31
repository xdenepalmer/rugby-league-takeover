import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  Settings, 
  ShoppingBag, 
  CreditCard, 
  Map, 
  Newspaper,
  MessageSquare,
  Users,
  Calendar
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
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
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!appParams.hasBase44Config) {
      setLoadingUser(false);
      return;
    }
    base44.auth.isAuthenticated().then(async (authed) => {
      if (authed) setUser(await base44.auth.me());
      setLoadingUser(false);
    }).catch(() => setLoadingUser(false));
  }, []);

  const adminQueriesEnabled = appParams.hasBase44Config && user?.role === "admin";
  const { data: settingsRecords = [] } = useQuery({ queryKey: ["siteSettings"], queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1), enabled: adminQueriesEnabled });
  const { data: news = [] } = useQuery({ queryKey: ["news"], queryFn: () => base44.entities.NewsArticle.list("-published_date", 50), enabled: adminQueriesEnabled });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.EventContent.list("-updated_date", 5), enabled: adminQueriesEnabled });
  const { data: packages = [] } = useQuery({ queryKey: ["packages"], queryFn: () => base44.entities.TravelPackage.list("sort_order", 200), enabled: adminQueriesEnabled });
  const { data: registrations = [] } = useQuery({ queryKey: ["registrations"], queryFn: () => base44.entities.InterestRegistration.list("-created_date", 200), enabled: adminQueriesEnabled });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => base44.entities.Product.list("sort_order", 200), enabled: adminQueriesEnabled });
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: () => base44.entities.StoreOrder.list("-created_date", 200), enabled: adminQueriesEnabled });
  const { data: forumPosts = [] } = useQuery({ queryKey: ["forumPosts"], queryFn: () => base44.entities.ForumPost.list("-created_date", 200), enabled: adminQueriesEnabled });

  if (loadingUser) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Loading admin…</div>;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 text-center text-foreground">
        <div className="max-w-md border border-border bg-card p-8">
          <h1 className="font-display text-4xl uppercase">Admin login required</h1>
          <p className="mt-4 text-muted-foreground">Please log in to manage the Rugby League Takeover website.</p>
          <button className="mt-6 h-12 px-6 bg-primary font-bold uppercase tracking-wider hover:bg-primary/90 text-white" onClick={() => base44.auth.redirectToLogin(window.location.href)}>Log In</button>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return <div className="flex min-h-screen items-center justify-center bg-background px-5 text-center text-foreground">Admin access only.</div>;
  }

  const menuItems = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "settings", label: "Site Settings", icon: Settings },
    { id: "products", label: "Merch Products", icon: ShoppingBag },
    { id: "orders", label: "Orders Admin", icon: CreditCard },
    { id: "packages", label: "Travel Packages", icon: Map },
    { id: "registrations", label: "Registrations", icon: Users },
    { id: "news", label: "News Articles", icon: Newspaper },
    { id: "events", label: "Events Manager", icon: Calendar },
    { id: "forum", label: "Forum posts", icon: MessageSquare },
  ];

  return (
    <AdminShell user={user}>
      <div className="grid gap-8 lg:grid-cols-[240px_1fr] items-start pt-4">
        
        {/* Sidebar Nav */}
        <aside className="grid gap-1.5 border border-border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 mb-2">Management</p>
          <nav className="grid gap-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border ${
                    isActive 
                      ? "bg-accent border-accent text-accent-foreground" 
                      : "bg-transparent border-transparent text-muted-foreground hover:text-white hover:bg-background/40"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Tab Contents Panel */}
        <div className="grid gap-8">
          {activeTab === "overview" && (
            <>
              <AdminOverview 
                counts={{ 
                  news: news.length, 
                  products: products.length, 
                  orders: orders.length, 
                  registrations: registrations.length, 
                  posts: forumPosts.length 
                }} 
                registrations={registrations}
                orders={orders}
              />
              <QuickLinks />
              <UserInviteManager />
            </>
          )}

          {activeTab === "settings" && (
            <>
              <SiteSettingsManager settings={settingsRecords[0]} />
              <LivePreviewPanel />
            </>
          )}

          {activeTab === "products" && (
            <ProductsManager products={products} />
          )}

          {activeTab === "orders" && (
            <OrdersManager orders={orders} />
          )}

          {activeTab === "packages" && (
            <TravelPackagesManager packages={packages} />
          )}

          {activeTab === "registrations" && (
            <RegistrationsTable registrations={registrations} />
          )}

          {activeTab === "news" && (
            <NewsManager articles={news} />
          )}

          {activeTab === "events" && (
            <EventsManager event={events[0]} />
          )}

          {activeTab === "forum" && (
            <ForumManager posts={forumPosts} />
          )}
        </div>

      </div>
    </AdminShell>
  );
}
