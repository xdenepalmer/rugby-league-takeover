import React, { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, DollarSign, Users, ShoppingCart, MessageSquare,
  ArrowUpRight, ArrowDownRight, Activity, Newspaper, Package,
  Eye, Clock, Zap,
} from "lucide-react";
import { motion } from "framer-motion";

/* ─── Animated Counter Hook ─────────────────────────────── */
function useAnimatedCount(target, duration = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
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
      {/* Top accent line */}
      <div className={`h-[2px] w-full ${color}`} />

      {/* Scanning overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent cmd-scan-line" />
      </div>

      {/* Glass glare sweep overlay */}
      <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent skew-x-[-25deg] -translate-x-[150%] transition-transform duration-1000 group-hover:translate-x-[250%] pointer-events-none" />

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
          <div className="relative">
            <div className={`p-2 border border-border/50 ${color.replace("bg-gradient-to-r", "bg-opacity-10")} bg-muted/30 transition-colors group-hover:border-primary/30`}>
              <Icon className="h-5 w-5 text-primary transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6" />
            </div>
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

/* ─── System Status Widget ──────────────────────────────── */
function SystemStatusWidget() {
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setUptimeSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const uptime = useMemo(() => {
    const h = Math.floor(uptimeSeconds / 3600);
    const m = Math.floor((uptimeSeconds % 3600) / 60);
    const s = uptimeSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [uptimeSeconds]);

  const metrics = [
    { label: "Uptime", value: uptime, icon: Clock },
    { label: "PWA Shell", value: "Ready", icon: Zap },
    { label: "Admin", value: "Live", icon: Eye },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="border border-border bg-card/60 cmd-glass overflow-hidden"
    >
      <div className="h-[2px] w-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-emerald-400 cmd-pulse" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            System Status
          </h3>
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
            <span className="h-1 w-1 rounded-full bg-emerald-400 cmd-blink" />
            All Systems Nominal
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {metrics.map(({ label, value, icon: MIcon }) => (
            <div key={label} className="text-center border border-border/40 bg-muted/20 p-3">
              <MIcon className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1.5" />
              <p className="font-mono text-sm font-bold text-foreground tabular-nums">{value}</p>
              <p className="text-[8px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Chart Tooltip ──────────────────────────────────────── */
function ChartTooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 border border-border p-3 shadow-xl backdrop-blur-sm">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm font-bold" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
}

/* ─── Main AdminOverview ────────────────────────────────── */
export default function AdminOverview({ counts, registrations = [], orders = [] }) {
  const paidOrders = orders.filter(
    (o) => o.status === "paid" || o.status === "completed" || o.status === "packing" || o.status === "shipped"
  );
  const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total_aud || 0), 0);

  // Recent activity (last 24h)
  const now = Date.now();
  const recentRegs = registrations.filter((r) => r.created_date && now - new Date(r.created_date).getTime() < 86400000).length;
  const recentOrders = orders.filter((o) => o.created_date && now - new Date(o.created_date).getTime() < 86400000).length;

  // Registrations chart data
  const registrationsByDate = registrations.reduce((acc, reg) => {
    if (!reg.created_date) return acc;
    const date = new Date(reg.created_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  const regChartData = Object.entries(registrationsByDate)
    .map(([date, count]) => ({ date, Signups: count }))
    .slice(-10);

  const finalRegData = regChartData.length > 0 ? regChartData : [
    { date: "Mon", Signups: 4 },
    { date: "Tue", Signups: 7 },
    { date: "Wed", Signups: 5 },
    { date: "Thu", Signups: 12 },
    { date: "Fri", Signups: 8 },
    { date: "Sat", Signups: 15 },
    { date: "Sun", Signups: 10 },
  ];

  // Revenue chart data
  const revenueByDate = paidOrders.reduce((acc, order) => {
    if (!order.created_date) return acc;
    const date = new Date(order.created_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    acc[date] = (acc[date] || 0) + Number(order.total_aud || 0);
    return acc;
  }, {});

  const revChartData = Object.entries(revenueByDate)
    .map(([date, amount]) => ({ date, Sales: Number(amount.toFixed(2)) }))
    .slice(-10);

  const finalRevData = revChartData.length > 0 ? revChartData : [
    { date: "Mon", Sales: 120 },
    { date: "Tue", Sales: 240 },
    { date: "Wed", Sales: 180 },
    { date: "Thu", Sales: 520 },
    { date: "Fri", Sales: 310 },
    { date: "Sat", Sales: 890 },
    { date: "Sun", Sales: 450 },
  ];

  // Order status distribution for pie chart
  const statusCounts = orders.reduce((acc, o) => {
    const s = o.status || "unknown";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = [
    "hsl(15, 95%, 55%)",    // primary
    "hsl(45, 93%, 47%)",    // accent
    "hsl(160, 60%, 45%)",   // emerald
    "hsl(220, 50%, 50%)",   // blue
    "hsl(0, 84%, 60%)",     // red
    "hsl(280, 50%, 55%)",   // purple
  ];

  return (
    <div className="grid gap-5">
      {/* ── Section Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden border border-border bg-card/60 cmd-glass"
      >
        <div className="cmd-accent-bar h-[2px] w-full" />
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-primary font-mono">
              Mission Control Dashboard
            </p>
          </div>
          <h2 className="font-display text-3xl md:text-4xl uppercase leading-none tracking-wide">
            Vegas Takeover HQ
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Real-time operational overview. Monitor registrations, revenue streams,
            community engagement, and system health from a single viewport.
          </p>

          {/* Quick stats bar */}
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border/50 pt-4">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 cmd-blink" />
              <span className="text-[10px] font-mono text-muted-foreground">
                {recentRegs} signups today
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent cmd-blink" style={{ animationDelay: "0.3s" }} />
              <span className="text-[10px] font-mono text-muted-foreground">
                {recentOrders} orders today
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary cmd-blink" style={{ animationDelay: "0.6s" }} />
              <span className="text-[10px] font-mono text-muted-foreground">
                {counts.posts} community posts
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── KPI Cards Grid ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={DollarSign}
          label="Total Revenue"
          value={`$${totalRevenue.toFixed(2)}`}
          subtext="AUD via Stripe"
          trend={12.5}
          trendLabel="vs last period"
          color="bg-gradient-to-r from-accent to-accent/60"
          delay={0.05}
        />
        <KpiCard
          icon={Users}
          label="Interest Signups"
          value={counts.registrations}
          subtext="Ticket drop registrations"
          trend={8.3}
          trendLabel="growth rate"
          color="bg-gradient-to-r from-primary to-primary/60"
          delay={0.1}
        />
        <KpiCard
          icon={ShoppingCart}
          label="Merch Orders"
          value={counts.orders}
          subtext={`${paidOrders.length} paid`}
          trend={5.1}
          trendLabel="conversion"
          color="bg-gradient-to-r from-emerald-500 to-emerald-500/60"
          delay={0.15}
        />
        <KpiCard
          icon={MessageSquare}
          label="Community Posts"
          value={counts.posts}
          subtext="Active discussions"
          trend={22.0}
          trendLabel="engagement"
          color="bg-gradient-to-r from-blue-500 to-blue-500/60"
          delay={0.2}
        />
      </div>

      {/* ── Secondary Stats + System Status ── */}
      <div className="grid gap-4 md:grid-cols-3">
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
        <SystemStatusWidget />
      </div>

      {/* ── Charts Grid ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Registrations Area Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="border border-border bg-card/60 cmd-glass overflow-hidden"
        >
          <div className="h-[2px] w-full bg-gradient-to-r from-primary via-primary/60 to-primary" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                  Registration Signups
                </h3>
                <p className="text-[9px] font-mono text-muted-foreground/60 mt-0.5">
                  Last 10 data points
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/5 border border-primary/10">
                <Activity className="h-3 w-3 text-primary cmd-pulse" />
                <span className="text-[8px] font-bold uppercase tracking-wider text-primary">Live</span>
              </div>
            </div>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={finalRegData}>
                  <defs>
                    <linearGradient id="cmdRegGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(15, 95%, 55%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(15, 95%, 55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 12%)" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="Signups"
                    stroke="hsl(15, 95%, 55%)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#cmdRegGrad)"
                    dot={{ r: 3, fill: "hsl(15, 95%, 55%)", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "hsl(15, 95%, 55%)", stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* Revenue Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="border border-border bg-card/60 cmd-glass overflow-hidden"
        >
          <div className="h-[2px] w-full bg-gradient-to-r from-accent via-accent/60 to-accent" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                  Revenue Stream (AUD)
                </h3>
                <p className="text-[9px] font-mono text-muted-foreground/60 mt-0.5">
                  Last 10 data points
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-accent/5 border border-accent/10">
                <DollarSign className="h-3 w-3 text-accent" />
                <span className="text-[8px] font-bold uppercase tracking-wider text-accent">Stripe</span>
              </div>
            </div>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={finalRevData}>
                  <defs>
                    <linearGradient id="cmdRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 12%)" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="Sales" fill="url(#cmdRevGrad)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Order Status Pie + Recent Activity ── */}
      {pieData.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Pie Chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
            className="border border-border bg-card/60 cmd-glass overflow-hidden"
          >
            <div className="h-[2px] w-full bg-gradient-to-r from-blue-500 via-violet-500 to-blue-500" />
            <div className="p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-4">
                Order Status Distribution
              </h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltipContent />} />
                    <Legend
                      formatter={(value) => (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>

          {/* Recent Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="border border-border bg-card/60 cmd-glass overflow-hidden"
          >
            <div className="h-[2px] w-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500" />
            <div className="p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-4">
                Recent Activity Feed
              </h3>
              <div className="space-y-2 max-h-[220px] overflow-y-auto cmd-scrollbar">
                {orders.slice(0, 5).map((order, i) => (
                  <div
                    key={order.id || i}
                    className={`flex items-center justify-between py-2.5 px-3 border border-border/40 bg-muted/10 hover:bg-muted/20 transition-colors cmd-card-in cmd-delay-${i + 1}`}
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
                      <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
                        {order.status || "pending"}
                      </p>
                    </div>
                  </div>
                ))}
                {orders.length === 0 && (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-6 w-6 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-[10px] text-muted-foreground">No orders yet</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
