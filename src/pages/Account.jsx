import React, { lazy, Suspense, useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  Calendar,
  Plane,
  Trophy,
  ArrowRight,
  Package,
  Clock
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

const FanHubTab = lazy(() => import("@/components/account/FanHubTab"));
const AchievementsTab = lazy(() => import("@/components/account/AchievementsTab"));
const ProfileTab = lazy(() => import("@/components/account/ProfileTab"));
const OrdersTab = lazy(() => import("@/components/account/OrdersTab"));
const PostsTab = lazy(() => import("@/components/account/PostsTab"));
const InterestTab = lazy(() => import("@/components/account/InterestTab"));
const SecurityTab = lazy(() => import("@/components/account/SecurityTab"));

function AccountTabFallback() {
  return (
    <div className="grid gap-3">
      <div className="h-10 animate-pulse border border-border/40 bg-muted/10" />
      <div className="h-28 animate-pulse border border-border/40 bg-muted/10" />
    </div>
  );
}

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

const VALID_TABS = ["fanhub", "profile", "orders", "posts", "interest", "security"];

export default function Account() {
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = VALID_TABS.includes(searchParams.get("tab")) ? searchParams.get("tab") : "fanhub";
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });
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
    { value: "achievements", label: "Achievements", icon: Trophy, count: null },
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
                    loading="lazy"
                    decoding="async"
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
                  <h1 className="font-display text-3xl uppercase tracking-wide leading-none">My Takeover</h1>
                  <span className="text-xs font-mono text-muted-foreground hidden md:inline">{displayName}</span>
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

        {/* ── SECTION 2: MY JOURNEY ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {/* Travel registration CTA */}
          {registrations.length === 0 ? (
            <Link to="/" className="group border border-primary/20 bg-primary/[0.03] p-4 hover:bg-primary/[0.08] transition-all block">
              <div className="flex items-center gap-3">
                <div className="p-2 border border-primary/30 bg-background/50 text-primary">
                  <Plane className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-primary">Next Step</p>
                  <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">Register for Vegas</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground">
                <span>Travel interest registration</span>
                <ArrowRight className="h-3 w-3 text-primary" />
              </div>
            </Link>
          ) : (
            <div className="border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 border border-emerald-500/30 bg-background/50 text-emerald-400">
                  <Plane className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400">Registered</p>
                  <p className="text-xs font-bold text-foreground truncate">Vegas trip interest logged</p>
                </div>
              </div>
            </div>
          )}

          {/* Latest order status */}
          {orders.length > 0 ? (
            <button onClick={() => setActiveTab("orders")} className="group border border-accent/20 bg-accent/[0.03] p-4 hover:bg-accent/[0.08] transition-all text-left cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 border border-accent/30 bg-background/50 text-accent">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-accent">Latest Order</p>
                  <p className="text-xs font-bold text-foreground truncate capitalize">{orders[0]?.status || "pending"}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Track your order</span>
                <ArrowRight className="h-3 w-3 text-accent" />
              </div>
            </button>
          ) : (
            <Link to="/store" className="group border border-border/60 bg-muted/5 p-4 hover:border-primary/30 hover:bg-muted/10 transition-all block">
              <div className="flex items-center gap-3">
                <div className="p-2 border border-border bg-background/50 text-muted-foreground">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Next Step</p>
                  <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">Browse merch store</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground">
                <span>Exclusive 2026 collection</span>
                <ArrowRight className="h-3 w-3 text-primary" />
              </div>
            </Link>
          )}

          {/* Forum activity */}
          {posts.length > 0 ? (
            <button onClick={() => setActiveTab("posts")} className="group border border-border/60 bg-muted/5 p-4 hover:border-primary/30 hover:bg-muted/10 transition-all text-left cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 border border-border bg-background/50 text-primary">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Forum</p>
                  <p className="text-xs font-bold text-foreground truncate">{posts.length} post{posts.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground">
                <span>View your threads</span>
                <ArrowRight className="h-3 w-3 text-primary" />
              </div>
            </button>
          ) : (
            <Link to="/forum" className="group border border-border/60 bg-muted/5 p-4 hover:border-primary/30 hover:bg-muted/10 transition-all block">
              <div className="flex items-center gap-3">
                <div className="p-2 border border-border bg-background/50 text-muted-foreground">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Next Step</p>
                  <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">Join the conversation</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground">
                <span>Fan forum community</span>
                <ArrowRight className="h-3 w-3 text-primary" />
              </div>
            </Link>
          )}

          {/* Badges / gamification summary */}
          <div className="border border-border/60 bg-muted/5 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 border border-border bg-background/50 text-amber-400">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Member</p>
                <p className="text-xs font-bold text-foreground truncate">{memberDays} day{memberDays !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="mt-2 text-[9px] text-muted-foreground">
              {user?.badges?.length > 0 ? `${user.badges.length} badge${user.badges.length !== 1 ? "s" : ""} earned` : "Keep engaging to earn badges"}
            </div>
          </div>
        </motion.div>

        {/* ── SECTION 3: STATS BAR ── */}
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
          <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Account console</p>
                <p className="mt-1 text-xs text-muted-foreground">Manage your orders, posts, profile, travel interest, and security.</p>
              </div>
              <span className="hidden border border-border/50 bg-background/45 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground sm:inline-flex">
                {tabsList.find((tab) => tab.value === activeTab)?.label}
              </span>
            </div>
            
            {/* Pill Trigger list with custom motion underlines */}
            <TabsList className="account-tab-rail -mx-5 flex h-auto w-[calc(100%+2.5rem)] flex-nowrap justify-start gap-2 overflow-x-auto rounded-none bg-transparent px-5 pb-2 md:mx-0 md:w-full md:flex-wrap md:px-0">
              {tabsList.map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeTab === tab.value;

                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="relative min-h-11 shrink-0 rounded-none border border-border bg-card/20 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 backdrop-blur-sm transition-all duration-300 hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground sm:px-5"
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
            <div className="mt-6 border border-border bg-card/40 p-4 shadow-sm cmd-glass sm:p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  <Suspense fallback={<AccountTabFallback />}>
                    <TabsContent value="fanhub" className="m-0 focus-visible:outline-none"><FanHubTab /></TabsContent>
                    <TabsContent value="achievements" className="m-0 focus-visible:outline-none"><AchievementsTab /></TabsContent>
                    <TabsContent value="profile" className="m-0 focus-visible:outline-none"><ProfileTab /></TabsContent>
                    <TabsContent value="orders" className="m-0 focus-visible:outline-none"><OrdersTab /></TabsContent>
                    <TabsContent value="posts" className="m-0 focus-visible:outline-none"><PostsTab /></TabsContent>
                    <TabsContent value="interest" className="m-0 focus-visible:outline-none"><InterestTab /></TabsContent>
                    <TabsContent value="security" className="m-0 focus-visible:outline-none"><SecurityTab /></TabsContent>
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </div>
            
          </Tabs>
        </motion.div>

      </div>
    </main>
  );
}
