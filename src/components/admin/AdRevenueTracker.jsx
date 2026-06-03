import React, { useMemo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign, TrendingUp, Download, Trophy, BarChart3,
  MousePointerClick, ChevronDown, ChevronUp, FileText,
  Loader2, CheckCircle2, PieChart as PieChartIcon,
  Users, Layers,
  ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";
import { Button } from "@/components/ui/button";

/* ═══════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════ */
const POSITIONS = [
  { key: "banner-top",    label: "Banner Top" },
  { key: "banner-bottom", label: "Banner Bottom" },
  { key: "sidebar",       label: "Sidebar" },
  { key: "in-feed",       label: "In-Feed" },
  { key: "footer",        label: "Footer" },
];

const POSITION_COLORS = [
  "hsl(15, 95%, 55%)",
  "hsl(200, 80%, 55%)",
  "hsl(130, 60%, 50%)",
  "hsl(45, 95%, 55%)",
  "hsl(270, 60%, 60%)",
];

const TIER_BADGE = {
  gold:     "bg-amber-500/15 border-amber-500/30 text-amber-400",
  silver:   "bg-slate-400/15 border-slate-400/30 text-slate-300",
  bronze:   "bg-orange-600/15 border-orange-600/30 text-orange-400",
  platinum: "bg-cyan-400/15 border-cyan-400/30 text-cyan-300",
  default:  "bg-muted/20 border-border text-muted-foreground",
};

/* ═══════════════════════════════════════════════════════════
   Animated Counter Hook (matching RevenueBreakdown pattern)
   ═══════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */
function fmtCurrency(n) {
  return "$" + Number(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ctrColor(ctr) {
  if (ctr >= 2) return "text-emerald-400";
  if (ctr >= 0.5) return "text-amber-400";
  return "text-red-400";
}

function ctrBg(ctr) {
  if (ctr >= 2) return "bg-emerald-500/10 border-emerald-500/20";
  if (ctr >= 0.5) return "bg-amber-500/10 border-amber-500/20";
  return "bg-red-500/10 border-red-500/20";
}

function getAdStats(stats, ad) {
  const key = `${ad.position}__${ad.id}`;
  return stats?.[key] || { impressions: 0, clicks: 0 };
}

function calcCtr(impressions, clicks) {
  return impressions > 0 ? ((clicks / impressions) * 100) : 0;
}

/* ═══════════════════════════════════════════════════════════
   Chart Tooltip (matching existing dark-theme pattern)
   ═══════════════════════════════════════════════════════════ */
function ChartTooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-none bg-card/95 border border-border p-3 shadow-xl backdrop-blur-sm">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm font-bold" style={{ color: entry.color }}>
          {entry.name}: {entry.name.toLowerCase().includes("revenue")
            ? fmtCurrency(entry.value)
            : typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Big Stat Card (replicates RevenueBreakdown aesthetic)
   ═══════════════════════════════════════════════════════════ */
function StatCard({ icon: Icon, label, value, prefix = "", suffix = "", delay = 0, color, isCurrency = false }) {
  const displayVal = useAnimatedCount(typeof value === "number" ? value : 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -4, transition: { duration: 0.25, ease: "easeOut" } }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-none border border-border bg-card/60 cmd-glass hover:border-primary/30 transition-all duration-300"
    >
      <div className={`h-[2px] w-full ${color}`} />
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent cmd-scan-line" />
      </div>
      <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent skew-x-[-25deg] -translate-x-[150%] transition-transform duration-1000 group-hover:translate-x-[250%] pointer-events-none" />

      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
              {label}
            </p>
            <p className="font-display text-3xl tabular-nums leading-none text-foreground counter-glow">
              {prefix}
              {isCurrency
                ? displayVal.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : Math.round(displayVal).toLocaleString()}
              {suffix}
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

/* ═══════════════════════════════════════════════════════════
   Section wrapper
   ═══════════════════════════════════════════════════════════ */
function Section({ title, subtitle, accentColor = "bg-gradient-to-r from-primary via-primary/60 to-primary", delay = 0, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-none border border-border bg-card/60 cmd-glass overflow-hidden"
    >
      <div className={`h-[2px] w-full ${accentColor}`} />
      <div className="p-5">
        {title && (
          <div className="mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-200">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[9px] font-mono text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function AdRevenueTracker({ ads, sponsors, stats }) {
  const safeAds = ads || [];
  const safeSponsors = sponsors || [];
  const safeStats = stats || {};

  /* ── Sort state for sponsor table ── */
  const [sortCol, setSortCol] = useState("revenue");
  const [sortDir, setSortDir] = useState("desc");

  /* ── Report generator state ── */
  const [selectedSponsor, setSelectedSponsor] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  /* ════════════════════════════════════════════════════════
     1. REVENUE COMPUTATIONS
     ════════════════════════════════════════════════════════ */
  const activeAds = useMemo(
    () => safeAds.filter((a) => a.is_active !== false),
    [safeAds]
  );

  const totalMonthlyRevenue = useMemo(
    () => activeAds.reduce((sum, ad) => sum + Number(ad.price_per_month || 0), 0),
    [activeAds]
  );

  const cpmRevenue = useMemo(() => {
    return safeAds.reduce((sum, ad) => {
      if (!ad.cpm_rate) return sum;
      const adStat = getAdStats(safeStats, ad);
      return sum + ((adStat.impressions / 1000) * Number(ad.cpm_rate));
    }, 0);
  }, [safeAds, safeStats]);

  const projectedAnnual = totalMonthlyRevenue * 12;
  const avgRevenuePerSlot = activeAds.length > 0 ? totalMonthlyRevenue / activeAds.length : 0;

  /* ── Revenue by Sponsor ── */
  const revenueBySponsor = useMemo(() => {
    const map = {};
    for (const ad of safeAds) {
      const sid = ad.sponsor_id || "unassigned";
      if (!map[sid]) map[sid] = { revenue: 0, name: "Unassigned" };
      map[sid].revenue += Number(ad.price_per_month || 0);
    }
    for (const sp of safeSponsors) {
      if (map[sp.id]) {
        map[sp.id].name = sp.company || sp.name || sp.id;
      }
    }
    return Object.entries(map)
      .map(([id, data]) => ({ id, name: data.name, Revenue: Math.round(data.revenue * 100) / 100 }))
      .sort((a, b) => b.Revenue - a.Revenue);
  }, [safeAds, safeSponsors]);

  /* ── Revenue by Position ── */
  const revenueByPosition = useMemo(() => {
    const map = {};
    POSITIONS.forEach((p) => { map[p.key] = 0; });
    for (const ad of activeAds) {
      if (map[ad.position] !== undefined) {
        map[ad.position] += Number(ad.price_per_month || 0);
      }
    }
    return POSITIONS.map((p, i) => ({
      position: p.label,
      Revenue: Math.round(map[p.key] * 100) / 100,
      fill: POSITION_COLORS[i],
    }));
  }, [activeAds]);

  /* ════════════════════════════════════════════════════════
     2. SPONSOR PERFORMANCE TABLE DATA
     ════════════════════════════════════════════════════════ */
  const sponsorPerformance = useMemo(() => {
    const map = {};
    for (const ad of safeAds) {
      const sid = ad.sponsor_id || "unassigned";
      if (!map[sid]) {
        const sp = safeSponsors.find((s) => s.id === sid);
        map[sid] = {
          id: sid,
          name: sp?.company || sp?.name || "Unassigned",
          tier: sp?.tier || "default",
          impressions: 0,
          clicks: 0,
          revenue: 0,
          adCount: 0,
        };
      }
      const adStat = getAdStats(safeStats, ad);
      map[sid].impressions += adStat.impressions || 0;
      map[sid].clicks += adStat.clicks || 0;
      map[sid].revenue += Number(ad.price_per_month || 0);
      map[sid].adCount += 1;
    }
    return Object.values(map).map((row) => ({
      ...row,
      ctr: calcCtr(row.impressions, row.clicks),
    }));
  }, [safeAds, safeSponsors, safeStats]);

  /* Sort logic */
  const sortedSponsors = useMemo(() => {
    const copy = [...sponsorPerformance];
    copy.sort((a, b) => {
      const aVal = a[sortCol] ?? 0;
      const bVal = b[sortCol] ?? 0;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return copy;
  }, [sponsorPerformance, sortCol, sortDir]);

  const handleSort = useCallback((col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }, [sortCol]);

  function SortIcon({ col }) {
    if (sortCol !== col) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-primary" />
      : <ChevronDown className="h-3 w-3 text-primary" />;
  }

  /* ════════════════════════════════════════════════════════
     3. REPORT GENERATOR
     ════════════════════════════════════════════════════════ */
  const generateCSV = useCallback(() => {
    setGenerating(true);
    setGenerated(false);

    // Simulate brief processing delay for UX feel
    setTimeout(() => {
      const sponsorAds = selectedSponsor
        ? safeAds.filter((a) => a.sponsor_id === selectedSponsor)
        : safeAds;

      const sponsor = safeSponsors.find((s) => s.id === selectedSponsor);
      const companyName = (sponsor?.company || sponsor?.name || "all-sponsors")
        .toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      const today = new Date().toISOString().split("T")[0];
      const headers = ["Ad Title", "Position", "Impressions", "Clicks", "CTR (%)", "Monthly Revenue (AUD)", "Device Target", "Date Generated"];

      const rows = sponsorAds.map((ad) => {
        const adStat = getAdStats(safeStats, ad);
        const ctr = calcCtr(adStat.impressions, adStat.clicks);
        const pos = POSITIONS.find((p) => p.key === ad.position);
        return [
          `"${(ad.title || "Untitled").replace(/"/g, '""')}"`,
          pos?.label || ad.position,
          adStat.impressions,
          adStat.clicks,
          ctr.toFixed(2),
          Number(ad.price_per_month || 0).toFixed(2),
          ad.device_target || "all",
          today,
        ].join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rlt-sponsor-report-${companyName}-${today}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      setGenerating(false);
      setGenerated(true);
      setTimeout(() => setGenerated(false), 3000);
    }, 800);
  }, [selectedSponsor, safeAds, safeSponsors, safeStats]);

  /* ════════════════════════════════════════════════════════
     4. A/B TEST DATA
     ════════════════════════════════════════════════════════ */
  const abTestAds = useMemo(
    () => safeAds.filter((ad) => ad.ab_variants && ad.ab_variants.length >= 2),
    [safeAds]
  );

  /* ═══════════════════════════════════════════════════════════
     Pie chart data for revenue by position (non-zero only)
     ═══════════════════════════════════════════════════════════ */
  const pieData = useMemo(
    () => revenueByPosition.filter((d) => d.Revenue > 0),
    [revenueByPosition]
  );

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div className="grid gap-5">

      {/* ════════════════════════════════════════════════════
          SECTION 1: REVENUE DASHBOARD
          ════════════════════════════════════════════════════ */}

      {/* KPI Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={DollarSign}
          label="Total Monthly Revenue"
          value={totalMonthlyRevenue}
          prefix="$"
          isCurrency
          color="bg-gradient-to-r from-accent to-accent/60"
          delay={0.05}
        />
        <StatCard
          icon={TrendingUp}
          label="Projected Annual"
          value={projectedAnnual}
          prefix="$"
          isCurrency
          color="bg-gradient-to-r from-primary to-primary/60"
          delay={0.1}
        />
        <StatCard
          icon={BarChart3}
          label="Avg Revenue Per Slot"
          value={avgRevenuePerSlot}
          prefix="$"
          isCurrency
          color="bg-gradient-to-r from-emerald-500 to-emerald-500/60"
          delay={0.15}
        />
      </div>

      {/* CPM Revenue + Slot Count */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={MousePointerClick}
          label="CPM Revenue (Estimated)"
          value={cpmRevenue}
          prefix="$"
          isCurrency
          color="bg-gradient-to-r from-blue-500 to-blue-500/60"
          delay={0.2}
        />
        <StatCard
          icon={Layers}
          label="Active Ad Slots"
          value={activeAds.length}
          color="bg-gradient-to-r from-amber-500 to-amber-500/60"
          delay={0.25}
        />
      </div>

      {/* Revenue by Sponsor — Bar Chart */}
      {revenueBySponsor.length > 0 && (
        <Section
          title="Revenue by Sponsor"
          subtitle={`${revenueBySponsor.length} sponsor${revenueBySponsor.length !== 1 ? "s" : ""} contributing to ad revenue`}
          accentColor="bg-gradient-to-r from-accent via-accent/60 to-accent"
          delay={0.3}
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueBySponsor} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="sponsorBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(15, 95%, 55%)" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="hsl(15, 95%, 55%)" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 12%)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)", fontFamily: "monospace" }}
                  axisLine={{ stroke: "hsl(217, 33%, 17%)" }}
                  tickLine={false}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)", fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(217, 33%, 12%)", opacity: 0.5 }} />
                <Bar dataKey="Revenue" fill="url(#sponsorBarGradient)" radius={[0, 0, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* Revenue by Position — Pie + Bar Combo */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Revenue by Position"
          subtitle="Monthly revenue distribution across ad placements"
          accentColor="bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500"
          delay={0.35}
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByPosition} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 12%)" vertical={false} />
                <XAxis
                  dataKey="position"
                  tick={{ fontSize: 9, fill: "hsl(215, 20%, 55%)", fontFamily: "monospace" }}
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
                <Bar dataKey="Revenue" radius={[0, 0, 0, 0]} maxBarSize={48}>
                  {revenueByPosition.map((entry, idx) => (
                    <Cell key={entry.position} fill={POSITION_COLORS[idx % POSITION_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {pieData.length > 0 && (
          <Section
            title="Position Share"
            subtitle="Revenue percentage breakdown"
            accentColor="bg-gradient-to-r from-purple-500 via-purple-400 to-purple-500"
            delay={0.4}
          >
            <div className="h-[260px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="Revenue"
                    nameKey="position"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    strokeWidth={1}
                    stroke="hsl(217, 33%, 17%)"
                    label={({ position, percent }) =>
                      `${position} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={{ stroke: "hsl(215, 20%, 40%)" }}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={entry.position} fill={entry.fill || POSITION_COLORS[idx % POSITION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Section>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
          SECTION 2: SPONSOR PERFORMANCE TABLE
          ════════════════════════════════════════════════════ */}
      <Section
        title="Sponsor Performance"
        subtitle={`${sortedSponsors.length} sponsor${sortedSponsors.length !== 1 ? "s" : ""} tracked · click headers to sort`}
        accentColor="bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500"
        delay={0.45}
      >
        {sortedSponsors.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground/40">
            <Users className="h-8 w-8" />
            <p className="text-xs font-mono uppercase tracking-wider">No sponsor data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="border-b border-border/40">
                  {[
                    { key: "name", label: "Sponsor", align: "text-left pl-5" },
                    { key: "adCount", label: "Ads" },
                    { key: "impressions", label: "Impressions" },
                    { key: "clicks", label: "Clicks" },
                    { key: "ctr", label: "CTR" },
                    { key: "revenue", label: "Revenue", align: "text-right pr-5" },
                  ].map(({ key, label, align }) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className={`cursor-pointer select-none px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground font-mono hover:text-primary transition-colors ${align || ""}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        <SortIcon col={key} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedSponsors.map((row, i) => {
                  const tierKey = row.tier?.toLowerCase() || "default";
                  const tierStyle = TIER_BADGE[tierKey] || TIER_BADGE.default;
                  return (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i, duration: 0.25 }}
                      className="border-b border-border/20 hover:bg-muted/5 transition-colors"
                    >
                      <td className="px-3 py-3 pl-5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{row.name}</span>
                          {tierKey !== "default" && (
                            <span className={`text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 border ${tierStyle}`}>
                              {row.tier}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-muted-foreground tabular-nums">
                        {row.adCount}
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-foreground tabular-nums">
                        {row.impressions.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-foreground tabular-nums">
                        {row.clicks.toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-bold font-mono tabular-nums ${ctrBg(row.ctr)} ${ctrColor(row.ctr)}`}>
                          {row.ctr >= 2 ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : row.ctr >= 0.5 ? (
                            <Minus className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {row.ctr.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-3 py-3 pr-5 text-right text-sm font-mono font-bold text-accent tabular-nums">
                        {fmtCurrency(row.revenue)}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ════════════════════════════════════════════════════
          SECTION 3: REPORT GENERATOR
          ════════════════════════════════════════════════════ */}
      <Section
        title="Sponsor Report Generator"
        subtitle="Export performance data as CSV for sponsor reporting"
        accentColor="bg-gradient-to-r from-primary via-primary/60 to-primary"
        delay={0.5}
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Select Sponsor
            </label>
            <div className="relative">
              <select
                value={selectedSponsor}
                onChange={(e) => setSelectedSponsor(e.target.value)}
                className="h-11 w-full appearance-none border border-border bg-background px-3 pr-8 text-sm font-mono rounded-none focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="">All Sponsors (combined report)</option>
                {safeSponsors.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.company || sp.name || sp.id}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="flex items-end">
            <AnimatePresence mode="wait">
              {generated ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <Button
                    disabled
                    className="rounded-none bg-emerald-600 text-xs uppercase tracking-wider font-bold h-11 px-6"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Downloaded
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="gen"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <Button
                    onClick={generateCSV}
                    disabled={generating}
                    className="rounded-none bg-primary hover:bg-primary/90 text-xs uppercase tracking-wider font-bold h-11 px-6"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating…
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Generate Report
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Report preview info */}
        <div className="mt-4 border border-border/30 bg-muted/5 p-3">
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-muted-foreground/60 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Report Preview
              </p>
              <p className="text-[9px] font-mono text-muted-foreground/60 mt-1">
                Columns: Ad Title, Position, Impressions, Clicks, CTR (%), Monthly Revenue (AUD), Device Target, Date Generated
              </p>
              <p className="text-[9px] font-mono text-muted-foreground/60 mt-0.5">
                Filename: rlt-sponsor-report-{selectedSponsor
                  ? (safeSponsors.find((s) => s.id === selectedSponsor)?.company || "sponsor").toLowerCase().replace(/\s+/g, "-")
                  : "all-sponsors"
                }-{new Date().toISOString().split("T")[0]}.csv
              </p>
              <p className="text-[9px] font-mono text-muted-foreground/60 mt-0.5">
                Rows: {selectedSponsor
                  ? safeAds.filter((a) => a.sponsor_id === selectedSponsor).length
                  : safeAds.length
                } ad{(selectedSponsor ? safeAds.filter((a) => a.sponsor_id === selectedSponsor).length : safeAds.length) !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════
          SECTION 4: A/B TEST RESULTS
          ════════════════════════════════════════════════════ */}
      <Section
        title="A/B Test Results"
        subtitle={abTestAds.length > 0
          ? `${abTestAds.length} ad${abTestAds.length !== 1 ? "s" : ""} with active variant tests`
          : "No active A/B tests — ads with ab_variants will appear here"
        }
        accentColor="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500"
        delay={0.55}
      >
        {abTestAds.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground/40">
            <PieChartIcon className="h-8 w-8" />
            <p className="text-xs font-mono uppercase tracking-wider">No A/B tests running</p>
            <p className="text-[10px] text-muted-foreground/30">
              Add ab_variants array to an ad to start split testing.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {abTestAds.map((ad, adIdx) => {
              const variants = ad.ab_variants.slice(0, 2);
              const [a, b] = variants;

              const aImps = a?.impressions || 0;
              const aClicks = a?.clicks || 0;
              const aCtr = calcCtr(aImps, aClicks);

              const bImps = b?.impressions || 0;
              const bClicks = b?.clicks || 0;
              const bCtr = calcCtr(bImps, bClicks);

              const winner = aCtr > bCtr ? "A" : bCtr > aCtr ? "B" : null;
              const maxImps = Math.max(aImps, bImps, 1);

              return (
                <motion.div
                  key={ad.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 * adIdx, duration: 0.3 }}
                  className="border border-border/40 bg-muted/5 overflow-hidden"
                >
                  {/* Test header */}
                  <div className="flex items-center justify-between border-b border-border/30 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{ad.title || "Untitled"}</span>
                      <span className="text-[8px] font-mono text-muted-foreground/60 uppercase tracking-wider">
                        {POSITIONS.find((p) => p.key === ad.position)?.label || ad.position}
                      </span>
                    </div>
                    {winner && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-[8px] font-bold uppercase tracking-wider text-amber-400">
                        <Trophy className="h-3 w-3" />
                        Variant {winner} wins
                      </span>
                    )}
                  </div>

                  {/* Comparison table */}
                  <div className="grid grid-cols-[auto_1fr_1fr] text-xs">
                    {/* Header row */}
                    <div className="px-4 py-2 border-b border-r border-border/20 text-[9px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                      Metric
                    </div>
                    <div className="px-4 py-2 border-b border-r border-border/20 text-center">
                      <span className={`text-[9px] font-bold uppercase tracking-wider font-mono ${winner === "A" ? "text-amber-400" : "text-muted-foreground"}`}>
                        {winner === "A" && <Trophy className="inline h-3 w-3 mr-1" />}
                        Variant A
                      </span>
                      {a?.label && <span className="block text-[8px] text-muted-foreground/50 mt-0.5">{a.label}</span>}
                    </div>
                    <div className="px-4 py-2 border-b border-border/20 text-center">
                      <span className={`text-[9px] font-bold uppercase tracking-wider font-mono ${winner === "B" ? "text-amber-400" : "text-muted-foreground"}`}>
                        {winner === "B" && <Trophy className="inline h-3 w-3 mr-1" />}
                        Variant B
                      </span>
                      {b?.label && <span className="block text-[8px] text-muted-foreground/50 mt-0.5">{b.label}</span>}
                    </div>

                    {/* Impressions */}
                    <div className="px-4 py-2.5 border-b border-r border-border/20 text-[9px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                      Impressions
                    </div>
                    <div className="px-4 py-2.5 border-b border-r border-border/20 text-center font-mono tabular-nums text-foreground">
                      {aImps.toLocaleString()}
                    </div>
                    <div className="px-4 py-2.5 border-b border-border/20 text-center font-mono tabular-nums text-foreground">
                      {bImps.toLocaleString()}
                    </div>

                    {/* Clicks */}
                    <div className="px-4 py-2.5 border-b border-r border-border/20 text-[9px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                      Clicks
                    </div>
                    <div className="px-4 py-2.5 border-b border-r border-border/20 text-center font-mono tabular-nums text-foreground">
                      {aClicks.toLocaleString()}
                    </div>
                    <div className="px-4 py-2.5 border-b border-border/20 text-center font-mono tabular-nums text-foreground">
                      {bClicks.toLocaleString()}
                    </div>

                    {/* CTR */}
                    <div className="px-4 py-2.5 border-b border-r border-border/20 text-[9px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                      CTR
                    </div>
                    <div className="px-4 py-2.5 border-b border-r border-border/20 text-center">
                      <span className={`font-mono tabular-nums font-bold ${ctrColor(aCtr)}`}>
                        {aCtr.toFixed(2)}%
                      </span>
                    </div>
                    <div className="px-4 py-2.5 border-b border-border/20 text-center">
                      <span className={`font-mono tabular-nums font-bold ${ctrColor(bCtr)}`}>
                        {bCtr.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Visual bar comparison */}
                  <div className="px-4 py-3 grid gap-2">
                    <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60 mb-1">
                      Impression Volume Comparison
                    </p>
                    {/* Variant A bar */}
                    <div className="grid gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono text-muted-foreground">Variant A</span>
                        <span className="text-[9px] font-mono text-muted-foreground tabular-nums">{aImps.toLocaleString()}</span>
                      </div>
                      <div className="h-3 w-full bg-muted/20 border border-border/30 overflow-hidden">
                        <motion.div
                          className={`h-full ${winner === "A" ? "bg-gradient-to-r from-amber-500/80 to-amber-500/40" : "bg-gradient-to-r from-primary/80 to-primary/40"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${(aImps / maxImps) * 100}%` }}
                          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                        />
                      </div>
                    </div>
                    {/* Variant B bar */}
                    <div className="grid gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono text-muted-foreground">Variant B</span>
                        <span className="text-[9px] font-mono text-muted-foreground tabular-nums">{bImps.toLocaleString()}</span>
                      </div>
                      <div className="h-3 w-full bg-muted/20 border border-border/30 overflow-hidden">
                        <motion.div
                          className={`h-full ${winner === "B" ? "bg-gradient-to-r from-amber-500/80 to-amber-500/40" : "bg-gradient-to-r from-blue-500/80 to-blue-500/40"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${(bImps / maxImps) * 100}%` }}
                          transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
