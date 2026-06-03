import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp, DollarSign, Users, ShoppingCart, MessageSquare,
  ArrowUpRight, ArrowDownRight, Newspaper, Package,
  PackageCheck, ShieldAlert, ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";
import SystemStatusPanel from "./SystemStatusPanel";

// Lazy-loaded charts to exclude heavy Recharts package from initial admin panel paint
const AdminOverviewCharts = lazy(() => import("./AdminOverviewCharts"));

/* ─── Animated Counter Hook ─────────────────────────────── */
function useAnimatedCount(target, duration = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return val;
}

/* ─── KPI Card Component ────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, subtext, trend, trendLabel, color, delay = 0 }) {
  const displayVal = useAnimatedCount(typeof value === "number" ? value : 0);
  const isPositive = trend >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="group relative overflow-hidden border border-border bg-card/60 cmd-glass hover:border-primary/30 transition-all duration-300"
    >
      <div className={`h-[2px] w-full ${color}`} />
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
              {label}
            </p>
            <p className="font-display text-3xl tabular-nums leading-none text-foreground">
              {typeof value === "string" ? value : displayVal.toLocaleString()}
            </p>
          </div>
          <div className={`p-2 border border-border/50 bg-muted/30 transition-colors group-hover:border-primary/30`}>
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {trend !== undefined && (
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
              {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend)}%
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {trendLabel || subtext}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function PriorityTile({ to, icon: Icon, label, value, detail, tone = "primary" }) {
  const toneClass = tone === "accent"
    ? "border-accent/30 bg-accent/10 text-accent"
    : tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : "border-primary/30 bg-primary/10 text-primary";

  return (
    <Link
      to={to}
      className="admin-attention-card group flex min-h-[92px] items-center gap-3 border border-border/60 bg-background/25 p-3 transition-all hover:border-primary/30 hover:bg-card/60"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center border ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold uppercase tracking-[0.24em] text-muted-foreground/70">
          {label}
        </span>
        <span className="mt-1 block font-display text-2xl uppercase leading-none text-foreground">
          {value}
        </span>
        <span className="mt-1 block truncate text-[10px] text-muted-foreground">
          {detail}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </Link>
  );
}



/* ─── Main AdminOverview ────────────────────────────────── */
export default function AdminOverview({ counts, registrations = [], orders = [] }) {
  const paidOrders = useMemo(
    () => orders.filter((o) => o.status === "paid" || o.status === "completed" || o.status === "packing" || o.status === "shipped"),
    [orders]
  );
  const totalRevenue = useMemo(
    () => paidOrders.reduce((sum, o) => sum + Number(o.total_aud || 0), 0),
    [paidOrders]
  );

  const recentWindowStart = Date.now() - 86400000;
  const recentRegs = useMemo(
    () => registrations.filter((r) => r.created_date && new Date(r.created_date).getTime() > recentWindowStart).length,
    [registrations, recentWindowStart]
  );
  const recentOrders = useMemo(
    () => orders.filter((o) => o.created_date && new Date(o.created_date).getTime() > recentWindowStart).length,
    [orders, recentWindowStart]
  );
  const ordersToFulfil = useMemo(
    () => orders.filter((o) => o.status === "paid" || o.status === "packing").length,
    [orders]
  );
  const moderationCount = Number(counts.pendingPosts || 0) + Number(counts.pendingTestimonials || 0);
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }, []);

  // Registrations chart data (real data, 7-day default)
  const registrationsByDate = useMemo(() => registrations.reduce((acc, reg) => {
    if (!reg.created_date) return acc;
    const date = new Date(reg.created_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {}), [registrations]);

  const revenueByDate = useMemo(() => paidOrders.reduce((acc, order) => {
    if (!order.created_date) return acc;
    const date = new Date(order.created_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    acc[date] = (acc[date] || 0) + Number(order.total_aud || 0);
    return acc;
  }, {}), [paidOrders]);

  const regData = useMemo(() => {
    const rawData = Object.entries(registrationsByDate)
      .map(([date, count]) => ({ date, Signups: count }))
      .slice(-7);
    return rawData.length > 0 ? rawData : [
      { date: "Mon", Signups: 0 },
      { date: "Tue", Signups: 0 },
      { date: "Wed", Signups: 0 },
    ];
  }, [registrationsByDate]);

  const revData = useMemo(() => {
    const rawData = Object.entries(revenueByDate)
      .map(([date, amount]) => ({ date, Sales: Number(amount.toFixed(2)) }))
      .slice(-7);
    return rawData.length > 0 ? rawData : [
      { date: "Mon", Sales: 0 },
      { date: "Tue", Sales: 0 },
      { date: "Wed", Sales: 0 },
    ];
  }, [revenueByDate]);

  // Order status distribution for pie chart
  const statusCounts = useMemo(() => orders.reduce((acc, o) => {
    const s = o.status || "unknown";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {}), [orders]);

  const pieData = useMemo(() => Object.entries(statusCounts).map(([name, value]) => ({ name, value })), [statusCounts]);

  return (
    <div className="grid gap-5">
      {/* ── Section Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="admin-overview-hero relative overflow-hidden border border-border bg-card/60 cmd-glass"
      >
        <div className="cmd-accent-bar h-[2px] w-full" />
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.35fr] lg:items-stretch lg:p-6">
          <div className="flex flex-col justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-primary font-mono">
                  Operations Dashboard
                </p>
              </div>
              <h2 className="font-display text-4xl uppercase leading-none tracking-wide md:text-5xl">
                Today
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {greeting}. Your fastest admin routes are grouped by live work, so phone checks and desktop sessions start in the right place.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 border border-border/50 bg-background/25">
              <div className="border-r border-border/50 p-3">
                <p className="font-display text-2xl leading-none text-foreground tabular-nums">{recentRegs}</p>
                <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Signups today</p>
              </div>
              <div className="border-r border-border/50 p-3">
                <p className="font-display text-2xl leading-none text-foreground tabular-nums">{recentOrders}</p>
                <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Orders today</p>
              </div>
              <div className="p-3">
                <p className="font-display text-2xl leading-none text-foreground tabular-nums">{counts.posts}</p>
                <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Forum posts</p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:h-full">
            <PriorityTile
              to="/admin/store"
              icon={PackageCheck}
              label="Fulfilment"
              value={ordersToFulfil || "Clear"}
              detail={ordersToFulfil ? "Paid or packing orders" : "No orders waiting"}
              tone="accent"
            />
            <PriorityTile
              to="/admin/community"
              icon={ShieldAlert}
              label="Moderation"
              value={moderationCount || "Clear"}
              detail={moderationCount ? "Posts or testimonials to review" : "No queue items"}
              tone="primary"
            />
            <PriorityTile
              to="/admin/people"
              icon={Users}
              label="People"
              value={recentRegs || "Quiet"}
              detail={recentRegs ? "New travel interest today" : "No new signups today"}
              tone="emerald"
            />
          </div>
        </div>
      </motion.div>

      {/* ── Control Centre: quick actions, to-dos & status ── */}
      <SystemStatusPanel counts={counts} orders={orders} registrations={registrations} />

      {/* ── KPI Cards Grid ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={DollarSign}
          label="Total Revenue"
          value={`$${totalRevenue.toFixed(2)}`}
          subtext="AUD via Stripe"
          color="bg-gradient-to-r from-accent to-accent/60"
          delay={0.05}
        />
        <KpiCard
          icon={Users}
          label="Interest Signups"
          value={counts.registrations}
          subtext="Ticket drop registrations"
          color="bg-gradient-to-r from-primary to-primary/60"
          delay={0.1}
        />
        <KpiCard
          icon={ShoppingCart}
          label="Merch Orders"
          value={counts.orders}
          subtext={`${paidOrders.length} paid`}
          color="bg-gradient-to-r from-emerald-500 to-emerald-500/60"
          delay={0.15}
        />
        <KpiCard
          icon={MessageSquare}
          label="Community Posts"
          value={counts.posts}
          subtext="Active discussions"
          color="bg-gradient-to-r from-blue-500 to-blue-500/60"
          delay={0.2}
        />
      </div>

      {/* ── Secondary Stats ── */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-2">
        <KpiCard
          icon={Newspaper}
          label="News Articles"
          value={counts.news}
          subtext="Published content"
          color="bg-gradient-to-r from-violet-500 to-violet-500/60"
          delay={0.25}
        />
        <KpiCard
          icon={Package}
          label="Products"
          value={counts.products}
          subtext="Active in store"
          color="bg-gradient-to-r from-cyan-500 to-cyan-500/60"
          delay={0.3}
        />
      </div>

      <Suspense fallback={
        <div className="h-[300px] flex items-center justify-center bg-card/20 animate-pulse border border-border/50 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Loading Analytics Charts...
        </div>
      }>
        <AdminOverviewCharts
          regData={regData}
          revData={revData}
          pieData={pieData}
        />
      </Suspense>

          {/* Recent Orders Feed */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="border border-border bg-card/60 cmd-glass overflow-hidden"
          >
            <div className="h-[2px] w-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500" />
            <div className="p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-4">
                Recent Orders
              </h3>
              <div className="space-y-2 max-h-[220px] overflow-y-auto cmd-scrollbar">
                {orders.slice(0, 8).map((order, i) => (
                  <div
                    key={order.id || i}
                    className="flex items-center justify-between py-2.5 px-3 border border-border/40 bg-muted/10 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${
                        order.status === "paid" || order.status === "completed" ? "bg-emerald-400" :
                        order.status === "shipped" || order.status === "packing" ? "bg-accent" :
                        "bg-muted-foreground"
                      }`} />
                      <div>
                        <p className="text-xs font-bold text-foreground">
                           Order #{String(order.id || "").slice(-6).toUpperCase()}
                        </p>
                        <p className="text-[9px] font-mono text-muted-foreground">
                          {order.created_date
                            ? new Date(order.created_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-accent tabular-nums">
                        ${Number(order.total_aud || 0).toFixed(2)}
                      </p>
                      <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">
                        {order.status || "pending"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
    </div>
  );
}
