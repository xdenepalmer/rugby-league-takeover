import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, FileText, CalendarDays, ShoppingBag,
  MessagesSquare, Users, Settings, ExternalLink, LogOut,
  Menu, X, Activity, Radio, ChevronLeft, ChevronRight,
  Shield, Zap, Download, Keyboard, MoreHorizontal, Megaphone,
  PackageCheck, ShieldAlert, Gauge, Search, RefreshCw,
} from "lucide-react";
import { queryClientInstance } from "@/lib/query-client";
import AdminPullToRefresh from "./AdminPullToRefresh";

const AdminCommandPalette = lazy(() => import("./AdminCommandPalette"));
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import AdminOfflineBanner from "./AdminOfflineBanner";
import {
  getActiveMobileAdminTab,
  getAdminSectionLabel,
  mobileMoreAdminItems,
  mobilePrimaryAdminTabs,
} from "@/lib/admin-mobile-nav";

const navItems = [
  { to: "/admin/overview",  label: "Overview",  icon: LayoutDashboard, shortcut: "⌘1", key: "1" },
  { to: "/admin/content",   label: "Content",   icon: FileText,        shortcut: "⌘2", key: "2" },
  { to: "/admin/events",    label: "Events",     icon: CalendarDays,    shortcut: "⌘3", key: "3" },
  { to: "/admin/store",     label: "Store",      icon: ShoppingBag,     shortcut: "⌘4", key: "4", badgeKey: "store" },
  { to: "/admin/community", label: "Community",  icon: MessagesSquare,  shortcut: "⌘5", key: "5", badgeKey: "community" },
  { to: "/admin/people",    label: "People",     icon: Users,           shortcut: "⌘6", key: "6" },
  { to: "/admin/settings",  label: "Settings",   icon: Settings,        shortcut: "⌘7", key: "7" },
  { to: "/admin/ads",       label: "Ads",        icon: Megaphone,       shortcut: "⌘8", key: "8" },
];

const sectionMeta = {
  Overview: {
    eyebrow: "Operations",
    title: "Mission Control",
    description: "A live owner view of orders, moderation, signups, publishing and revenue.",
  },
  Content: {
    eyebrow: "Publishing",
    title: "Content Desk",
    description: "Update news, travel packages, partners and testimonials before they go public.",
  },
  Events: {
    eyebrow: "Schedule",
    title: "Event Control",
    description: "Keep matchups, teams and fan events accurate for the Vegas trip.",
  },
  Store: {
    eyebrow: "Merchandise",
    title: "Store Fulfilment",
    description: "Manage products, payments, shipping status, tracking and customer order history.",
  },
  Community: {
    eyebrow: "Moderation",
    title: "Community Watch",
    description: "Review posts, pin useful threads, handle bans and keep the forum moving.",
  },
  People: {
    eyebrow: "Access",
    title: "People Directory",
    description: "Manage users, registrations, invites, handover notes and access controls.",
  },
  Settings: {
    eyebrow: "System",
    title: "Site Settings",
    description: "Tune public copy, brand assets, homepage controls and operational defaults.",
  },
  Ads: {
    eyebrow: "Sponsors",
    title: "Ad Revenue",
    description: "Manage campaigns, sponsors, placements, reports and ad performance.",
  },
  Dashboard: {
    eyebrow: "Admin",
    title: "Command Centre",
    description: "Pick a section from the admin navigation to manage the site.",
  },
};

const mobileIconMap = {
  LayoutDashboard,
  FileText,
  CalendarDays,
  ShoppingBag,
  MessagesSquare,
  Users,
  Settings,
  ExternalLink,
  Download,
  MoreHorizontal,
  Megaphone,
  PackageCheck,
  ShieldAlert,
  Gauge,
  RefreshCw,
  LogOut,
};

/* ── Live clock hook ─────────────────────────────────────────── */
function useLiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function LiveClock({ compact = false }) {
  const clock = useLiveClock();
  const timeStr = clock.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dateStr = clock.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (compact) {
    return (
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
        {timeStr}
      </span>
    );
  }

  return (
    <div className="text-center">
      <p className="font-mono text-xl font-bold tracking-widest text-foreground tabular-nums">
        {timeStr}
      </p>
      <p className="text-[9px] font-mono uppercase tracking-wider text-slate-300">
        {dateStr}
      </p>
    </div>
  );
}

function useSystemStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return [
    { label: "NET", ok: online },
    { label: "API", ok: true },
    { label: "APP", ok: true },
  ];
}

/* ── Badge counts hook (derive from data when available) ──── */
function useBadgeCounts() {
  const [counts, setCounts] = useState({ community: 0, store: 0 });
  useEffect(() => {
    // Try to derive pending counts from the base44 API
    let cancelled = false;
    async function fetchCounts() {
      try {
        // Optimised: filter by pending status and only fetch the 'id' field to avoid pulling down full entities
        const [posts, orders] = await Promise.allSettled([
          base44.entities?.ForumPost?.filter?.({ is_published: false }, undefined, 100, 0, ["id"]) || Promise.resolve([]),
          base44.entities?.StoreOrder?.filter?.({ status: ["pending", "new"] }, undefined, 100, 0, ["id"]) || Promise.resolve([]),
        ]);
        if (cancelled) return;
        const pendingPosts = (posts.status === "fulfilled" ? posts.value : []).length;
        const pendingOrders = (orders.status === "fulfilled" ? orders.value : []).length;
        setCounts({ community: pendingPosts, store: pendingOrders });
      } catch {
        // Silently fail — badges simply won't show
      }
    }
    fetchCounts();
    const id = setInterval(fetchCounts, 60000); // refresh every minute
    // PWA resume: refresh badges immediately when the app returns to foreground
    const onVisible = () => { if (!document.hidden) fetchCounts(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  return counts;
}

/* ── Animated status dot ─────────────────────────────────────── */
function StatusDot({ ok, label }) {
  return (
    <div className="flex items-center gap-1.5" title={`${label}: ${ok ? "Operational" : "Degraded"}`}>
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full cmd-pulse ${ok ? "bg-emerald-400 text-emerald-400" : "bg-red-500 text-red-500"}`}
      />
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

/* ── Badge pill ──────────────────────────────────────────────── */
function NavBadge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-sm bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground"
    >
      {count > 99 ? "99+" : count}
    </motion.span>
  );
}

function AttentionCard({ to, icon: Icon, label, count, clearLabel, tone = "primary" }) {
  const toneClass = tone === "accent"
    ? "border-accent/30 bg-accent/10 text-accent"
    : tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : "border-primary/30 bg-primary/10 text-primary";
  const hasWork = Number(count || 0) > 0;

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `admin-attention-card group flex min-h-[54px] items-center gap-3 border px-3 text-left transition-all ${
          isActive
            ? "border-primary/50 bg-primary/15 text-foreground"
            : "border-border/50 bg-card/30 text-muted-foreground hover:border-primary/30 hover:bg-card/60 hover:text-foreground"
        }`
      }
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center border ${hasWork ? toneClass : "border-border/50 bg-muted/15 text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground/70">
          {label}
        </span>
        <span className={`mt-0.5 block text-sm font-bold ${hasWork ? "text-foreground" : "text-muted-foreground"}`}>
          {hasWork ? `${count} needs review` : clearLabel}
        </span>
      </span>
      {hasWork && (
        <span className={`flex h-7 min-w-7 items-center justify-center border px-2 text-xs font-bold tabular-nums ${toneClass}`}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </NavLink>
  );
}

/* ════════════════════════════════════════════════════════════════
   AdminLayout
   ════════════════════════════════════════════════════════════════ */
export default function AdminLayout({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const statuses = useSystemStatus();
  const badgeCounts = useBadgeCounts();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  /* Get current section name */
  const currentSection = getAdminSectionLabel(location.pathname);
  const activeMobileTab = getActiveMobileAdminTab(location.pathname);
  const activeNavItem = navItems.find((item) => location.pathname.startsWith(item.to)) || navItems[0];
  const activeMeta = sectionMeta[currentSection] || sectionMeta.Dashboard;
  const ActiveIcon = activeNavItem?.icon || LayoutDashboard;
  const totalAttention = Number(badgeCounts.store || 0) + Number(badgeCounts.community || 0);
  const attentionItems = [
    {
      to: "/admin/store",
      icon: PackageCheck,
      label: "Orders",
      count: badgeCounts.store,
      clearLabel: "Fulfilment clear",
      tone: "accent",
    },
    {
      to: "/admin/community",
      icon: ShieldAlert,
      label: "Moderation",
      count: badgeCounts.community,
      clearLabel: "Queue clear",
      tone: "primary",
    },
  ];

  /* ── Keyboard shortcuts (Ctrl+1-8) ─────────────────────────── */
  const handleKeyboard = useCallback(
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
        return;
      }
      const item = navItems.find((n) => n.key === e.key);
      if (item) {
        e.preventDefault();
        navigate(item.to);
      }
    },
    [navigate]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [handleKeyboard]);

  useEffect(() => {
    setMobileMoreOpen(false);
    // Always start a panel at the top — PWA tab switches keep stale scroll otherwise
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  const triggerExport = () => {
    window.dispatchEvent(new CustomEvent("admin:export-data"));
  };

  const handleMobileAction = (action) => {
    if (action === "export") triggerExport();
    else if (action === "refresh") queryClientInstance.invalidateQueries();
    else if (action === "logout") { base44.auth.logout("/"); return; }
    setMobileMoreOpen(false);
  };

  return (
    <div className="min-h-dvh bg-background text-foreground cmd-grid-bg">
      {/* ── Top Accent Bar ── */}
      <div className="cmd-accent-bar h-[2px] w-full" />

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-border cmd-glass pt-[env(safe-area-inset-top,0px)] relative">
        <div className="px-4 py-3 md:px-6">
          <div className="flex items-center justify-between">
            {/* Left: Branding + Mobile Toggle */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="mobileIcon"
                className="rounded-none lg:hidden"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={mobileOpen ? "Close admin navigation" : "Open admin navigation"}
              >
                {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>

              <div className="flex items-center gap-3">
                {/* Shield icon with glow */}
                <div className="relative">
                  <Shield className="h-7 w-7 text-primary" />
                  <div className="absolute inset-0 h-7 w-7 rounded-full bg-primary/20 cmd-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-primary font-mono">
                      Command Centre
                    </p>
                    <span className="hidden md:inline-flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/20">
                      <Zap className="h-2.5 w-2.5" /> Live
                    </span>
                  </div>
                  <h1 className="font-display text-lg uppercase leading-none md:text-xl tracking-wide">
                    Rugby League Takeover
                  </h1>
                </div>
              </div>
            </div>

            {/* Center: Live Clock + Status (hidden on mobile) */}
            <div className="hidden md:flex items-center gap-6">
              {/* Clock */}
              <LiveClock />

              {/* System Status Indicators */}
              <div className="flex items-center gap-3 border-l border-border pl-5">
                {statuses.map((s) => (
                  <StatusDot key={s.label} ok={s.ok} label={s.label} />
                ))}
              </div>
            </div>

            {/* Right: User + Actions */}
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-2 mr-2">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name || user.email}
                    className="h-7 w-7 rounded-sm object-cover border border-primary/20"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-primary">
                      {(user?.email || "A")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-mono text-slate-200 leading-none">
                    {user?.email}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-primary font-bold">
                    Administrator
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="mobileIcon"
                className="rounded-none text-muted-foreground hover:text-foreground"
                onClick={() => setCommandPaletteOpen(true)}
                aria-label="Open command palette"
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                asChild
                variant="outline"
                size="mobile"
                className="hidden rounded-none text-[10px] font-bold uppercase tracking-wider sm:inline-flex md:h-7 md:px-2"
              >
                <Link to="/">
                  <ExternalLink className="mr-1.5 h-3 w-3" /> Site
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="mobile"
                className="hidden rounded-none text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-destructive sm:inline-flex md:h-7 md:px-2"
                onClick={() => base44.auth.logout("/")}
              >
                <LogOut className="mr-1.5 h-3 w-3" /> Exit
              </Button>
            </div>
          </div>
        </div>

        {/* Animated gradient border at bottom of header */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] cmd-accent-bar opacity-40" />
      </header>
      <AdminOfflineBanner />

      {/* ── Body ── */}
      <div className="flex">
        {/* ── Desktop Sidebar ── */}
        <aside
          className={`hidden lg:flex flex-col border-r border-border bg-card/30 transition-all duration-300 ease-out ${
            collapsed ? "w-16" : "w-56"
          }`}
          style={{ minHeight: "calc(100dvh - 54px)" }}
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between px-3 py-3 border-b border-border/50">
            {!collapsed && (
              <div>
                <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                  Navigation
                </span>
                <p className="mt-0.5 text-[9px] font-mono uppercase tracking-wider text-primary/80">
                  {totalAttention > 0 ? `${totalAttention} priority` : "All clear"}
                </p>
              </div>
            )}
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="flex h-8 w-8 items-center justify-center border border-border/50 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
              aria-label={collapsed ? "Expand admin navigation" : "Collapse admin navigation"}
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {!collapsed ? (
            <div className="mx-2 mt-2 border border-border/50 bg-background/30 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-primary">Ops Pulse</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Fastest routes to live work.</p>
                </div>
                <Gauge className="h-4 w-4 text-accent" />
              </div>
              <div className="grid gap-2">
                {attentionItems.map((item) => (
                  <AttentionCard key={item.label} {...item} />
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-2 mt-2 grid gap-2">
              {attentionItems.map(({ to, icon: Icon, count, label, tone }) => (
                <NavLink
                  key={label}
                  to={to}
                  className={({ isActive }) =>
                    `relative flex h-11 items-center justify-center border transition-colors ${
                      isActive ? "border-primary/50 bg-primary/15 text-primary" : "border-border/50 bg-background/30 text-muted-foreground hover:text-foreground"
                    }`
                  }
                  title={label}
                >
                  <Icon className="h-4 w-4" />
                  {count > 0 && (
                    <span className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center px-1 text-[9px] font-bold text-white ${tone === "accent" ? "bg-accent text-black" : "bg-primary"}`}>
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          )}

          {/* Nav Items */}
          <nav className="flex-1 py-2 px-2 space-y-1 cmd-scrollbar overflow-y-auto">
            {navItems.map(({ to, label, icon: Icon, shortcut, badgeKey }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => {
                  const base = `group relative flex min-h-11 items-center gap-3 overflow-hidden border px-3 text-xs font-bold uppercase tracking-wider transition-all duration-200`;
                  const active = isActive
                    ? "border-primary/40 bg-primary/[0.12] text-foreground shadow-[inset_3px_0_0_hsl(var(--primary))]"
                    : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/30 hover:text-foreground";
                  return `${base} ${active}`;
                }}
                onMouseEnter={() => setHoveredNav(to)}
                onMouseLeave={() => setHoveredNav(null)}
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1">{label}</span>
                        {/* Badge count */}
                        {badgeKey && badgeCounts[badgeKey] > 0 && (
                          <NavBadge count={badgeCounts[badgeKey]} />
                        )}
                        {/* Shortcut (hide when badge is showing) */}
                        {!(badgeKey && badgeCounts[badgeKey] > 0) && (
                          <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-200 transition-colors">
                            {shortcut}
                          </span>
                        )}
                      </>
                    )}
                    {/* Collapsed badge dot */}
                    {collapsed && badgeKey && badgeCounts[badgeKey] > 0 && (
                      <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary cmd-pulse" />
                    )}
                    {/* Active glow effect */}
                    {isActive && (
                      <motion.div
                        layoutId="nav-glow"
                        className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/[0.16] via-primary/5 to-transparent"
                        style={{ boxShadow: "inset 3px 0 18px -5px hsl(var(--primary) / 0.55)" }}
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    {/* Tooltip for collapsed mode */}
                    {collapsed && hoveredNav === to && (
                      <div className="absolute left-full ml-2 z-50 px-2.5 py-1.5 bg-card border border-border shadow-lg">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground whitespace-nowrap">
                          {label}
                        </span>
                        {badgeKey && badgeCounts[badgeKey] > 0 && (
                          <span className="ml-2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-sm bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground">
                            {badgeCounts[badgeKey]}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* ── Quick Actions ── */}
          {!collapsed && (
            <div className="border-t border-border/50 px-3 py-2.5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                Quick Actions
              </p>
              <div className="flex items-center gap-1.5">
                <Link
                  to="/"
                  className="flex items-center gap-1.5 border border-border/50 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground
                             transition-all hover:border-primary/40 hover:text-foreground hover:bg-primary/5"
                >
                  <ExternalLink className="h-3 w-3" /> View Site
                </Link>
                <button
                  onClick={triggerExport}
                  className="flex items-center gap-1.5 border border-border/50 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground
                             transition-all hover:border-primary/40 hover:text-foreground hover:bg-primary/5"
                >
                  <Download className="h-3 w-3" /> Export
                </button>
              </div>
            </div>
          )}

          {/* ── Sidebar Footer ── */}
          <div className="border-t border-border/50 px-3 py-3">
            {!collapsed ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Activity className="h-3 w-3 text-emerald-400 cmd-pulse" />
                  <span className="text-[9px] font-mono text-muted-foreground">
                    System Operational
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Radio className="h-3 w-3 text-primary cmd-blink" />
                  <span className="text-[9px] font-mono text-muted-foreground">
                    Live Data Feed
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/40">
                  <Keyboard className="h-3 w-3" />
                  <span>Ctrl+1-8 to navigate</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Activity className="h-3 w-3 text-emerald-400 cmd-pulse" />
                <Radio className="h-3 w-3 text-primary cmd-blink" />
              </div>
            )}
          </div>
        </aside>

        {/* ── Mobile Sidebar Overlay ── */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[45] bg-black/65 lg:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="ios-scroll fixed left-0 top-0 z-[46] h-dvh w-72 max-w-[86vw] border-r border-border bg-background cmd-scrollbar overflow-y-auto pb-safe pt-safe lg:hidden"
              >
                <div className="flex items-center justify-between px-4 py-4 border-b border-border">
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
                    Navigation
                  </span>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="touch-target flex items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label="Close admin navigation"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <nav className="py-2 px-2 space-y-0.5">
                  {navItems.map(({ to, label, icon: Icon, badgeKey }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `touch-target flex items-center gap-3 px-3 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                          isActive
                            ? "bg-primary/10 text-foreground border-l-2 border-primary"
                            : "text-muted-foreground hover:text-foreground border-l-2 border-transparent"
                        }`
                      }
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{label}</span>
                      {badgeKey && badgeCounts[badgeKey] > 0 && (
                        <NavBadge count={badgeCounts[badgeKey]} />
                      )}
                    </NavLink>
                  ))}
                </nav>

                {/* Mobile quick actions */}
                <div className="mx-2 mt-2 border-t border-border/50 px-3 py-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                    Quick Actions
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Link
                      to="/"
                      onClick={() => setMobileOpen(false)}
                      className="flex min-h-11 items-center justify-center gap-1.5 border border-border/50 px-2.5 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground
                                 transition-all hover:border-primary/40 hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" /> View Site
                    </Link>
                    <button
                      onClick={triggerExport}
                      className="flex min-h-11 items-center justify-center gap-1.5 border border-border/50 px-2.5 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground
                                 transition-all hover:border-primary/40 hover:text-foreground"
                    >
                      <Download className="h-3 w-3" /> Export
                    </button>
                  </div>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ── Main Content Area ── */}
        <main className="flex-1 min-w-0">
          {/* Section Breadcrumb Bar */}
          <div className="border-b border-border/50 px-5 py-2 md:px-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60">
                admin
              </span>
              <span className="text-[9px] text-muted-foreground/40">/</span>
              <span className="text-[9px] font-mono uppercase tracking-wider text-primary font-bold">
                {currentSection}
              </span>
            </div>
            <div className="flex items-center gap-3 md:hidden">
              {/* Mobile clock */}
              <LiveClock compact />
              {/* Mobile status dots */}
              <div className="flex gap-1">
                {statuses.map((s) => (
                  <span
                    key={s.label}
                    className={`h-1.5 w-1.5 rounded-full ${
                      s.ok ? "bg-emerald-400" : "bg-red-500"
                    } cmd-pulse`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="px-4 pt-4 md:px-8">
            <section className="admin-route-banner relative overflow-hidden border border-border/70 bg-card/40 cmd-glass">
              <div className="h-[2px] w-full cmd-accent-bar" />
              <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center md:p-5">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-primary/30 bg-primary/10 text-primary shadow-[0_0_24px_hsl(var(--primary)/0.08)]">
                    <ActiveIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-primary">
                        {activeMeta.eyebrow}
                      </p>
                      <span className="border border-border/60 bg-background/30 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        {location.pathname.replace("/admin/", "") || "overview"}
                      </span>
                    </div>
                    <h2 className="mt-1 font-display text-2xl uppercase leading-none tracking-wide md:text-3xl">
                      {activeMeta.title}
                    </h2>
                    <p className="mt-1.5 hidden max-w-2xl text-sm leading-6 text-muted-foreground sm:block">
                      {activeMeta.description}
                    </p>
                  </div>
                </div>

                <div className="hidden gap-2 md:grid md:w-[360px] md:grid-cols-2">
                  {attentionItems.map((item) => (
                    <AttentionCard key={item.label} {...item} />
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Page Content — instant native-style switch with a quick fade-in */}
          <AdminPullToRefresh>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="px-4 pb-[calc(7.75rem+var(--safe-bottom))] pt-4 md:px-8 md:pb-8 md:pt-6"
            >
              {children}
            </motion.div>
          </AdminPullToRefresh>
        </main>
      </div>

      <AnimatePresence>
        {mobileMoreOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close admin controls"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/65 lg:hidden"
              onClick={() => setMobileMoreOpen(false)}
            />
            <motion.section
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="ios-sheet ios-scroll fixed inset-x-0 bottom-0 z-50 max-h-[78dvh] overflow-y-auto border border-border/70 px-4 pb-[calc(1rem+var(--safe-bottom))] pt-3 lg:hidden"
            >
              <div className="mx-auto ios-home-indicator" />
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-primary">Admin Controls</p>
                  <h2 className="mt-1 font-display text-2xl uppercase leading-none tracking-wide">Manage on phone</h2>
                </div>
                <button
                  type="button"
                  className="ios-pressable flex h-11 w-11 items-center justify-center border border-border/70 text-muted-foreground"
                  onClick={() => setMobileMoreOpen(false)}
                  aria-label="Close admin controls"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {attentionItems.map((item) => (
                  <AttentionCard key={item.label} {...item} />
                ))}
              </div>

              <div className="mt-4 grid gap-2">
                {mobileMoreAdminItems.map((item) => {
                  const Icon = mobileIconMap[item.icon] || MoreHorizontal;
                  const itemClass = "ios-pressable flex min-h-[58px] items-center gap-3 border border-border/60 bg-card/40 px-4 text-left text-sm font-bold text-foreground";

                  if (item.kind === "link") {
                    return (
                      <Link key={item.label} to={item.to} className={itemClass} onClick={() => setMobileMoreOpen(false)}>
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="flex-1">{item.label}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </Link>
                    );
                  }

                  if (item.kind === "action") {
                    return (
                      <button
                        key={item.label}
                        type="button"
                        className={itemClass}
                        onClick={() => handleMobileAction(item.action)}
                      >
                        <Icon className="h-4 w-4 text-accent" />
                        <span className="flex-1">{item.label}</span>
                      </button>
                    );
                  }

                  return (
                    <NavLink key={item.label} to={item.to} className={itemClass} onClick={() => setMobileMoreOpen(false)}>
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="flex-1">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </motion.section>
          </>
        )}
      </AnimatePresence>

      <nav className="ios-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-border/70 lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 pt-2">
          {mobilePrimaryAdminTabs.map((item) => {
            const Icon = mobileIconMap[item.icon] || MoreHorizontal;
            const isActive = activeMobileTab === item.label || (item.kind === "more" && mobileMoreOpen);
            const content = (
              <>
                <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                <span className="max-w-full truncate">{item.label}</span>
                {isActive && (
                  <span className="absolute left-1/2 top-1 -translate-x-1/2 h-[3px] w-6 bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.7)]" />
                )}
                {item.badgeKey && badgeCounts[item.badgeKey] > 0 && (
                  <span className="absolute right-3 top-1 flex h-4 min-w-[16px] items-center justify-center bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {badgeCounts[item.badgeKey] > 9 ? "9+" : badgeCounts[item.badgeKey]}
                  </span>
                )}
              </>
            );

            if (item.kind === "more") {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setMobileMoreOpen((open) => !open)}
                  className={`ios-tabbar-item relative flex flex-col items-center justify-center gap-1 px-1 text-[9px] font-bold uppercase tracking-wide ${
                    isActive ? "border border-primary/25 bg-primary/10 text-foreground" : "text-muted-foreground"
                  }`}
                  aria-expanded={mobileMoreOpen}
                  aria-label="Open admin controls"
                >
                  {content}
                </button>
              );
            }

            return (
              <NavLink
                key={item.label}
                to={item.to}
                className={`ios-tabbar-item relative flex flex-col items-center justify-center gap-1 px-1 text-[9px] font-bold uppercase tracking-wide ${
                  isActive ? "border border-primary/25 bg-primary/10 text-foreground" : "text-muted-foreground"
                }`}
              >
                {content}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* ── Command Palette ── */}
      <Suspense fallback={null}>
        <AdminCommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
        />
      </Suspense>
    </div>
  );
}