import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  ShieldCheck, 
  User, 
  ShoppingBag, 
  MessageSquare, 
  Heart, 
  Shield, 
  Sparkles,
  Calendar
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FanHubTab from "@/components/account/FanHubTab";
import ProfileTab from "@/components/account/ProfileTab";
import OrdersTab from "@/components/account/OrdersTab";
import PostsTab from "@/components/account/PostsTab";
import InterestTab from "@/components/account/InterestTab";
import SecurityTab from "@/components/account/SecurityTab";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

/* ── Count Up Number Component ── */
function AnimatedNumber({ value }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseInt(value, 10) || 0;
    if (end === 0) {
      setDisplayValue(0);
      return;
    }
    const duration = 1200; // ms
    const increment = end / (duration / 16); // 60fps approx
    
    let timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        clearInterval(timer);
        setDisplayValue(end);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{displayValue}</span>;
}

/* ── Metric Stats Card Component ── */
function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="relative overflow-hidden border border-border bg-card/40 cmd-glass p-5 flex items-center justify-between shadow-sm">
      <div className="space-y-1.5 z-10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">{label}</p>
        <p className="text-3xl font-display uppercase leading-none text-foreground font-mono">
          <AnimatedNumber value={value} />
        </p>
      </div>
      <div className={`p-3 bg-muted/10 border border-border/30 rounded-none z-10 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="absolute right-[-10px] bottom-[-10px] pointer-events-none opacity-5 blur-[1px]">
        <Icon className="h-20 w-20 text-foreground" />
      </div>
    </div>
  );
}

export default function Account() {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("fanhub");
  const displayName = user?.full_name || user?.email?.split("@")[0] || "User";
  const avatarLetter = displayName.slice(0, 1).toUpperCase();

  // Queries to fetch actual statistics dynamically
  const { data: orders = [] } = useQuery({
    queryKey: ["myOrdersCount", user?.email],
    queryFn: () => base44.entities.StoreOrder.filter({ user_email: user.email }, "-created_date", 100),
    enabled: Boolean(user?.email),
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["myPostsCount", user?.email],
    queryFn: () => base44.entities.ForumPost.filter({ user_email: user.email }, "-created_date", 100),
    enabled: Boolean(user?.email),
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["myInterestCount", user?.email],
    queryFn: () => base44.entities.InterestRegistration.filter({ user_email: user.email }, "-created_date", 100),
    enabled: Boolean(user?.email),
  });

  // Calculate membership duration
  const memberDays = useMemo(() => {
    if (!user?.created_date) return 1;
    const start = new Date(user.created_date);
    const today = new Date();
    const diffTime = Math.abs(today - start);
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }, [user?.created_date]);

  // Tab definitions
  const tabsList = [
    { value: "fanhub", label: "Fan Hub", icon: Sparkles, count: null },
    { value: "profile", label: "Profile", icon: User, count: null },
    { value: "orders", label: "My Orders", icon: ShoppingBag, count: orders.length },
    { value: "posts", label: "My Posts", icon: MessageSquare, count: posts.length },
    { value: "interest", label: "My Interest", icon: Heart, count: registrations.length },
    { value: "security", label: "Security", icon: Shield, count: null },
  ];

  return (
    <main className="relative min-h-dvh bg-background px-5 pb-[calc(7rem+var(--safe-bottom))] pt-[calc(7.25rem+env(safe-area-inset-top,0px))] text-foreground md:px-8 overflow-hidden">
      {/* Visual Background Grids */}
      <div className="absolute inset-0 cmd-grid-bg opacity-35 z-0 pointer-events-none" />
      <div className="absolute top-12 left-12 w-96 h-96 rounded-full bg-primary/5 blur-3xl z-0 pointer-events-none" />
      <div className="absolute bottom-12 right-12 w-96 h-96 rounded-full bg-accent/5 blur-3xl z-0 pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-5xl space-y-8">
        
        {/* ── SECTION 1: ACCOUNT HERO ── */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="border border-border bg-card/60 cmd-glass p-6 md:p-8 relative overflow-hidden"
        >
          {/* Neon background light */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-primary/5 via-accent/5 to-transparent opacity-80" />
          <div className="absolute top-0 left-0 right-0 h-[2px] cmd-accent-bar" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            {/* User Profile Card block */}
            <div className="flex items-center gap-5">
              {/* Profile Avatar with radial glowing shadow */}
              <div className="relative flex-shrink-0">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={displayName}
                    className="h-20 w-20 rounded-none border border-white/20 object-cover shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-none bg-gradient-to-tr from-primary via-accent to-primary flex items-center justify-center font-display text-4xl text-white font-bold shadow-[0_0_20px_rgba(249,115,22,0.3)]">
                    {avatarLetter}
                  </div>
                )}
                <div className="absolute inset-0 border border-white/20 pointer-events-none" />
              </div>
              
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-3xl uppercase tracking-wide leading-none">{displayName}</h1>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-accent/10 border border-accent/30 text-accent shadow-[0_0_8px_rgba(217,119,6,0.3)]">
                      <ShieldCheck className="h-3 w-3" /> Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 font-mono font-medium">{user?.email}</p>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-primary" /> Member Since:{" "}
                  <span className="text-foreground">
                    {user?.created_date ? format(new Date(user.created_date), "MMM yyyy") : "June 2026"}
                  </span>
                </p>
              </div>
            </div>

            {/* Quick Action Navigation Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              {isAdmin && (
                <Button asChild variant="outline" className="h-10 rounded-none bg-card hover:bg-card/85 text-xs font-bold uppercase tracking-wider border-accent/40 text-accent hover:text-accent shadow-[0_0_10px_rgba(217,119,6,0.15)]">
                  <Link to="/admin"><ShieldCheck className="mr-1.5 h-4 w-4" /> Admin Center</Link>
                </Button>
              )}
              <Button asChild variant="outline" className="h-10 rounded-none bg-card hover:bg-card/85 text-xs font-bold uppercase tracking-wider border-border">
                <Link to="/store">Store</Link>
              </Button>
              <Button asChild variant="outline" className="h-10 rounded-none bg-card hover:bg-card/85 text-xs font-bold uppercase tracking-wider border-border">
                <Link to="/forum">Forum</Link>
              </Button>
              <Button asChild variant="outline" className="h-10 rounded-none bg-card hover:bg-card/85 text-xs font-bold uppercase tracking-wider border-border">
                <Link to="/"><ArrowLeft className="mr-1.5 h-4 w-4" /> Exit</Link>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ── SECTION 2: STATS BAR ── */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <StatCard label="Total Orders" value={orders.length} icon={ShoppingBag} color="text-primary" />
          <StatCard label="Forum Posts" value={posts.length} icon={MessageSquare} color="text-accent" />
          <StatCard label="Package Registrations" value={registrations.length} icon={Heart} color="text-red-500" />
          <StatCard label="Membership Days" value={memberDays} icon={Sparkles} color="text-emerald-400" />
        </motion.div>

        {/* ── SECTION 3: TABS WRAPPER ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <Tabs defaultValue="fanhub" className="w-full" onValueChange={setActiveTab}>
            
            {/* Pill Trigger list with custom motion underlines */}
            <TabsList className="w-full flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0 rounded-none select-none overflow-x-auto cmd-scrollbar pb-2">
              {tabsList.map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeTab === tab.value;

                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="relative rounded-none border border-border bg-card/20 backdrop-blur-sm px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 transition-all duration-300 hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground"
                  >
                    <div className="flex items-center gap-2 relative z-10">
                      <IconComponent className={`h-4 w-4 ${isActive ? "text-primary" : "text-slate-400"}`} />
                      <span>{tab.label}</span>
                      {Number.isFinite(tab.count) && tab.count > 0 && (
                        <span className="px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/30 text-[9px] font-mono font-bold leading-none">
                          {tab.count}
                        </span>
                      )}
                    </div>

                    {/* Sliding framer motion background indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="activeTabGlow"
                        className="absolute inset-0 bg-card/60 border border-primary z-0 pointer-events-none"
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      />
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Tab content inside glassmorphic panels */}
            <div className="mt-6 border border-border bg-card/40 cmd-glass p-6 shadow-sm">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  <TabsContent value="fanhub" className="m-0 focus-visible:outline-none"><FanHubTab /></TabsContent>
                  <TabsContent value="profile" className="m-0 focus-visible:outline-none"><ProfileTab /></TabsContent>
                  <TabsContent value="orders" className="m-0 focus-visible:outline-none"><OrdersTab /></TabsContent>
                  <TabsContent value="posts" className="m-0 focus-visible:outline-none"><PostsTab /></TabsContent>
                  <TabsContent value="interest" className="m-0 focus-visible:outline-none"><InterestTab /></TabsContent>
                  <TabsContent value="security" className="m-0 focus-visible:outline-none"><SecurityTab /></TabsContent>
                </motion.div>
              </AnimatePresence>
            </div>
            
          </Tabs>
        </motion.div>

      </div>
    </main>
  );
}