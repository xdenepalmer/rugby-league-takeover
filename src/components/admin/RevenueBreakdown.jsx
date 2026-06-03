import React, { useMemo, useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { DollarSign, TrendingUp, Trophy, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

/* ─── Animated Counter Hook ─────────────────────────────── */
function useAnimatedCount(target, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return val;
}

/* ─── Chart Tooltip ──────────────────────────────────────── */
function ChartTooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-none bg-card/95 border border-border p-3 shadow-xl backdrop-blur-sm">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm font-bold" style={{ color: entry.color }}>
          {entry.name}: ${typeof entry.value === "number" ? entry.value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : entry.value}
        </p>
      ))}
    </div>
  );
}

/* ─── Big Stat Card ──────────────────────────────────────── */
function BigStatCard({ icon: Icon, label, value, prefix = "", suffix = "", delay = 0, color }) {
  const displayVal = useAnimatedCount(typeof value === "number" ? value : 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -4, transition: { duration: 0.25, ease: "easeOut" } }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-none border border-border bg-card/60 cmd-glass hover:border-primary/30 transition-all duration-300"
    >
      {/* Top accent line */}
      <div className={`h-[2px] w-full ${color}`} />

      {/* Scanning overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent cmd-scan-line" />
      </div>

      {/* Glass glare sweep */}
      <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent skew-x-[-25deg] -translate-x-[150%] transition-transform duration-1000 group-hover:translate-x-[250%] pointer-events-none" />

      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
              {label}
            </p>
            <p className="font-display text-3xl tabular-nums leading-none text-foreground counter-glow">
              {prefix}{displayVal.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{suffix}
            </p>
          </div>
          <motion.div
            className="relative"
            whileHover={{ scale: 1.15, transition: { type: "spring", stiffness: 400, damping: 15 } }}
          >
            <div className="rounded-none p-2 border border-border/50 bg-muted/30 transition-colors group-hover:border-primary/30">
              <Icon className="h-5 w-5 text-primary transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6" />
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Status Colors Map ──────────────────────────────────── */
const STATUS_CONFIG = {
  pending:   { label: "Pending",   bg: "bg-slate-500",   text: "text-slate-300" },
  paid:      { label: "Paid",      bg: "bg-emerald-500", text: "text-emerald-300" },
  packing:   { label: "Packing",   bg: "bg-amber-500",   text: "text-amber-300" },
  shipped:   { label: "Shipped",   bg: "bg-blue-500",    text: "text-blue-300" },
  completed: { label: "Completed", bg: "bg-green-500",   text: "text-green-300" },
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* ═══════════════════════════════════════════════════════════
   Revenue Breakdown — detailed financial analytics panel
   ═══════════════════════════════════════════════════════════ */
export default function RevenueBreakdown({ orders }) {
  const safeOrders = orders || [];

  // ─── Core calculations ───
  const paidStatuses = ["paid", "completed", "shipped", "packing"];
  const revenueOrders = useMemo(
    () => safeOrders.filter((o) => paidStatuses.includes(o.status)),
    [safeOrders]
  );

  const totalRevenue = useMemo(
    () => revenueOrders.reduce((sum, o) => sum + Number(o.total_aud || 0), 0),
    [revenueOrders]
  );

  const avgOrderValue = useMemo(
    () => (revenueOrders.length > 0 ? totalRevenue / revenueOrders.length : 0),
    [totalRevenue, revenueOrders]
  );

  const highestOrder = useMemo(
    () => revenueOrders.reduce((max, o) => Math.max(max, Number(o.total_aud || 0)), 0),
    [revenueOrders]
  );

  // ─── Status breakdown ───
  const statusBreakdown = useMemo(() => {
    const counts = {};
    for (const o of safeOrders) {
      const s = o.status || "unknown";
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [safeOrders]);

  const totalOrderCount = safeOrders.length;

  // ─── Revenue by day of week ───
  const revenueByDay = useMemo(() => {
    const buckets = DAY_NAMES.map((name) => ({ day: name.slice(0, 3), Revenue: 0 }));
    for (const o of revenueOrders) {
      if (!o.created_date) continue;
      const dayIndex = new Date(o.created_date).getDay();
      buckets[dayIndex].Revenue += Number(o.total_aud || 0);
    }
    // Round to 2dp
    return buckets.map((b) => ({ ...b, Revenue: Math.round(b.Revenue * 100) / 100 }));
  }, [revenueOrders]);

  // ─── Conversion funnel ───
  const funnel = useMemo(() => {
    const total = safeOrders.length;
    if (total === 0) return { total: 0, paid: 0, shipped: 0, completed: 0, paidPct: 0, shippedPct: 0, completedPct: 0 };
    const paid = safeOrders.filter((o) => paidStatuses.includes(o.status)).length;
    const shipped = safeOrders.filter((o) => o.status === "shipped" || o.status === "completed").length;
    const completed = safeOrders.filter((o) => o.status === "completed").length;
    return {
      total,
      paid,
      shipped,
      completed,
      paidPct: Math.round((paid / total) * 100),
      shippedPct: Math.round((shipped / total) * 100),
      completedPct: Math.round((completed / total) * 100),
    };
  }, [safeOrders]);

  // ─── Status pipeline bar segments ───
  const pipelineSegments = useMemo(() => {
    if (totalOrderCount === 0) return [];
    const order = ["pending", "paid", "packing", "shipped", "completed"];
    return order
      .filter((s) => statusBreakdown[s] > 0)
      .map((s) => ({
        status: s,
        count: statusBreakdown[s],
        pct: Math.round((statusBreakdown[s] / totalOrderCount) * 100),
        ...STATUS_CONFIG[s],
      }));
  }, [statusBreakdown, totalOrderCount]);

  return (
    <div className="grid gap-5">
      {/* ── Top Row: 3 Big Stat Cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <BigStatCard
          icon={DollarSign}
          label="Total Revenue"
          value={totalRevenue}
          prefix="$"
          color="bg-gradient-to-r from-accent to-accent/60"
          delay={0.05}
        />
        <BigStatCard
          icon={TrendingUp}
          label="Avg Order Value"
          value={avgOrderValue}
          prefix="$"
          color="bg-gradient-to-r from-primary to-primary/60"
          delay={0.1}
        />
        <BigStatCard
          icon={Trophy}
          label="Best Order"
          value={highestOrder}
          prefix="$"
          color="bg-gradient-to-r from-emerald-500 to-emerald-500/60"
          delay={0.15}
        />
      </div>

      {/* ── Middle: Status Pipeline Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="rounded-none border border-border bg-card/60 cmd-glass overflow-hidden"
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-primary via-primary/60 to-primary" />
        <div className="p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-200 mb-1">
            Order Status Pipeline
          </h3>
          <p className="text-[9px] font-mono text-slate-400 mb-4">
            {totalOrderCount} total orders across all statuses
          </p>

          {totalOrderCount === 0 ? (
            <div className="rounded-none border border-border/40 bg-muted/10 py-8 text-center">
              <p className="text-xs text-muted-foreground">No orders yet</p>
            </div>
          ) : (
            <>
              {/* The horizontal bar */}
              <div className="flex h-8 w-full overflow-hidden rounded-none border border-border/30">
                {pipelineSegments.map((seg, i) => (
                  <motion.div
                    key={seg.status}
                    initial={{ width: 0 }}
                    animate={{ width: `${seg.pct}%` }}
                    transition={{ delay: 0.3 + i * 0.08, duration: 0.6, ease: "easeOut" }}
                    className={`${seg.bg} relative flex items-center justify-center min-w-[28px] transition-all`}
                    title={`${seg.label}: ${seg.count} (${seg.pct}%)`}
                  >
                    <span className="text-[9px] font-bold text-white drop-shadow-sm tracking-wider">
                      {seg.pct}%
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-3 flex flex-wrap items-center gap-4">
                {pipelineSegments.map((seg) => (
                  <div key={seg.status} className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-none ${seg.bg}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${seg.text}`}>
                      {seg.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      ({seg.count})
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* ── Conversion Funnel ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="rounded-none border border-border bg-card/60 cmd-glass overflow-hidden"
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500" />
        <div className="p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-200 mb-4">
            Conversion Funnel
          </h3>

          <div className="flex flex-wrap items-center gap-3">
            {[
              { label: "Total Orders", value: funnel.total, pct: 100 },
              { label: "Paid", value: funnel.paid, pct: funnel.paidPct },
              { label: "Shipped", value: funnel.shipped, pct: funnel.shippedPct },
              { label: "Completed", value: funnel.completed, pct: funnel.completedPct },
            ].map((step, i, arr) => (
              <React.Fragment key={step.label}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.35 }}
                  className="rounded-none border border-border/50 bg-muted/20 px-4 py-3 text-center min-w-[100px]"
                >
                  <p className="font-display text-xl tabular-nums text-foreground leading-none">
                    {step.value}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                    {step.label}
                  </p>
                  <p className="text-[10px] font-mono text-primary mt-0.5 tabular-nums">
                    {step.pct}%
                  </p>
                </motion.div>
                {i < arr.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-border shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Bottom: Revenue by Day Bar Chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="rounded-none border border-border bg-card/60 cmd-glass overflow-hidden"
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-accent via-accent/60 to-accent" />
        <div className="p-5">
          <div className="mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-200">
              Revenue by Day of Week
            </h3>
            <p className="text-[9px] font-mono text-slate-400 mt-0.5">
              Aggregate AUD revenue across all qualifying orders
            </p>
          </div>

          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByDay} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="revenueBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(15, 95%, 55%)" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="hsl(15, 95%, 55%)" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(217, 33%, 12%)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)", fontFamily: "monospace" }}
                  axisLine={{ stroke: "hsl(217, 33%, 17%)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)", fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(217, 33%, 12%)", opacity: 0.5 }} />
                <Bar
                  dataKey="Revenue"
                  fill="url(#revenueBarGradient)"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
