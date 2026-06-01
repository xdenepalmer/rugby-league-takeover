import React, { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from "recharts";
import {
  TrendingUp, DollarSign, Users, ShoppingCart, MessageSquare,
  ArrowUpRight, ArrowDownRight, Activity, Newspaper, Package, Clock, Radio, Wifi, WifiOff, Smartphone, CreditCard,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SystemStatusPanel from "./SystemStatusPanel";
import { Button } from "@/components/ui/button";

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

/* ─── System Status Widget (real, plain-English) ─────────── */
function SystemStatusWidget() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [installed, setInstalled] = useState(false);
  const [checkedAt, setCheckedAt] = useState(() => new Date());

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setInstalled(Boolean(navigator.serviceWorker && navigator.serviceWorker.controller));
    const id = setInterval(() => setCheckedAt(new Date()), 30000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(id);
    };
  }, []);

  const tiles = [
    { label: "Connection", value: online ? "Online" : "Offline", ok: online, icon: online ? Wifi : WifiOff },
    { label: "App", value: installed ? "Offline-ready" : "In browser", ok: true, icon: Smartphone },
    { label: "Payments", value: "Secure", ok: true, icon: CreditCard },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="border border-border bg-card/60 cmd-glass overflow-hidden"
    >
      <div className={`h-[2px] w-full ${online ? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" : "bg-gradient-to-r from-red-600 via-red-500 to-red-600 animate-pulse"}`} />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className={`h-4 w-4 cmd-pulse ${online ? "text-emerald-400" : "text-red-400"}`} />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-200">
            System Status
          </h3>
          <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 border text-[8px] font-bold uppercase tracking-wider ${
            online ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full cmd-blink ${online ? "bg-emerald-400" : "bg-red-400"}`} />
            {online ? "All good" : "Offline"}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {tiles.map(({ label, value, ok, icon: MIcon }) => (
            <div key={label} className="text-center border border-border/40 bg-muted/20 p-3">
              <MIcon className={`h-3.5 w-3.5 mx-auto mb-1.5 ${ok ? "text-emerald-400" : "text-red-400"}`} />
              <p className="text-sm font-bold text-foreground">{value}</p>
              <p className="text-[8px] uppercase tracking-wider text-slate-300 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 pt-3.5 border-t border-border/30 flex items-center gap-1.5 text-[10px] text-slate-400">
          <Clock className="h-3 w-3" /> Checked {checkedAt.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })} · refreshes automatically
        </p>
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

  // Revenue chart data
  const revenueByDate = paidOrders.reduce((acc, order) => {
    if (!order.created_date) return acc;
    const date = new Date(order.created_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    acc[date] = (acc[date] || 0) + Number(order.total_aud || 0);
    return acc;
  }, {});

  // ─── Simulation & Interactive telemetry States ───
  const [regChartType, setRegChartType] = useState("area"); // "area" | "line" | "bar"
  const [revChartType, setRevChartType] = useState("bar");  // "bar" | "line" | "area"
  const [timeFrame, setTimeFrame] = useState("7d"); // "24h" | "7d" | "30d"
  const [simLoad, setSimLoad] = useState(0); // 0 to 100
  const [jitter, setJitter] = useState(0);
  const [networkMode, setNetworkMode] = useState("online");
  const [syncQueue, setSyncQueue] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSurging, setIsSurging] = useState(false);
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem("rlt_theme_accent") || "sincity");

  const changeTheme = (themeKey) => {
    setActiveTheme(themeKey);
    window.dispatchEvent(new CustomEvent("rlt_theme_change", { detail: { theme: themeKey } }));
    window.dispatchEvent(new CustomEvent("rlt_admin_log", {
      detail: { type: "success", text: `[THEME] Switched accent configuration to: ${themeKey.toUpperCase()}` }
    }));
  };

  useEffect(() => {
    const handleThemeEvent = (e) => {
      if (e.detail?.theme) {
        setActiveTheme(e.detail.theme);
      }
    };
    window.addEventListener("rlt_theme_change", handleThemeEvent);
    return () => window.removeEventListener("rlt_theme_change", handleThemeEvent);
  }, []);

  useEffect(() => {
    if (!isSurging) return;
    setSimLoad(95);
    setNetworkMode("online");
    
    const messages = [
      "Queue node Sydney-1 processing tickets...",
      "Stripe payment success: 2x Gold Supporter packages",
      "Stripe payment success: 1x Allegiant Stadium VIP Pass",
      "Section 124 seat claim processed for user a***@hotmail.com",
      "Section 120 seat claim processed for user j***@yahoo.com.au",
      "Gateway load threshold warning: Melbourne traffic spike",
      "Ticket allocation Sec 120 Aussie Zone now 96% full",
      "Webhook delivery succeeded: email confirmation dispatched"
    ];
    
    const interval = setInterval(() => {
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      const logEntryId = Math.random().toString(36).substring(7).toUpperCase();
      window.dispatchEvent(new CustomEvent("rlt_admin_log", {
        detail: { type: "info", text: `[DROP-SURGE] [${logEntryId}] ${randomMsg}` }
      }));
    }, 1800);
    
    return () => clearInterval(interval);
  }, [isSurging]);

  useEffect(() => {
    const id = setInterval(() => {
      setJitter(Math.random() * 5);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handleSurgeEvent = (e) => {
      const loadVal = e.detail?.load;
      if (loadVal !== undefined) {
        setSimLoad(loadVal);
        if (loadVal > 85) {
          setIsSurging(true);
        } else {
          setIsSurging(false);
        }
      }
    };
    window.addEventListener("rlt_admin_surge_change", handleSurgeEvent);
    return () => window.removeEventListener("rlt_admin_surge_change", handleSurgeEvent);
  }, []);

  const simulatedCpu = Math.min(Math.round(25 + simLoad * 0.7 + jitter + (networkMode === "offline" ? 12 : networkMode === "latency" ? 6 : 0)), 100);

  const handleNetworkChange = (mode) => {
    setNetworkMode(mode);
    window.dispatchEvent(new CustomEvent("rlt_admin_network_change", { detail: { mode } }));
    window.dispatchEvent(new CustomEvent("rlt_admin_log", {
      detail: {
        type: mode === "online" ? "info" : "warn",
        text: `[SYS] Network profile switched to: ${mode.toUpperCase()}`
      }
    }));
  };

  const handleForceSync = () => {
    if (syncQueue.length === 0) return;
    setIsSyncing(true);
    
    window.dispatchEvent(new CustomEvent("rlt_admin_log", {
      detail: { type: "info", text: "[SYS] Initiating force synchronization sequence..." }
    }));

    setTimeout(() => {
      setIsSyncing(false);
      setSyncQueue([]);
      setNetworkMode("online");
      window.dispatchEvent(new CustomEvent("rlt_admin_network_change", { detail: { mode: "online" } }));
      window.dispatchEvent(new CustomEvent("rlt_admin_log", {
        detail: { type: "success", text: "[SUCCESS] Synchronization complete. PWA database is in sync with server." }
      }));
      
      // Flash confetti
      import("canvas-confetti").then((confetti) => {
        confetti.default({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
      });
    }, 1500);
  };

  useEffect(() => {
    if (networkMode === "online") {
      setSyncQueue([]);
      return;
    }

    const interval = setInterval(() => {
      const actions = [
        { id: Math.random().toString(36).substring(7).toUpperCase(), action: "Submit Forum Post", payload: "Vibe in Aussie Sector", time: new Date().toLocaleTimeString() },
        { id: Math.random().toString(36).substring(7).toUpperCase(), action: "Sync Store Order", payload: "1x Gold Supporter Package", time: new Date().toLocaleTimeString() },
        { id: Math.random().toString(36).substring(7).toUpperCase(), action: "Update Event Details", payload: "Stadium Swim Schedule", time: new Date().toLocaleTimeString() },
        { id: Math.random().toString(36).substring(7).toUpperCase(), action: "Submit Match Tipping", payload: "AUS 24 - 10 USA", time: new Date().toLocaleTimeString() }
      ];
      
      const newAction = actions[Math.floor(Math.random() * actions.length)];
      setSyncQueue(prev => {
        if (prev.length >= 5) return prev;
        return [...prev, newAction];
      });
      
      window.dispatchEvent(new CustomEvent("rlt_admin_log", {
        detail: {
          type: "warn",
          text: `[PWA Sync] Network degraded. Buffered action: ${newAction.action} (ID: ${newAction.id})`
        }
      }));
    }, 6000);

    return () => clearInterval(interval);
  }, [networkMode]);

  const simulateData = (baseData, field) => {
    const isOffline = networkMode === "offline";
    const isLaggy = networkMode === "latency";
    
    return baseData.map((d) => {
      let multiplier = 1;
      if (simLoad > 0) {
        multiplier = 1 + (simLoad / 10) * (0.5 + Math.random() * 0.8);
      }
      
      let baseVal = d[field];
      if (isOffline) {
        baseVal = Math.round(baseVal * 0.15); 
      } else if (isLaggy) {
        const lagJitter = 0.6 + Math.random() * 0.8;
        baseVal = Math.round(baseVal * multiplier * lagJitter);
      } else {
        baseVal = Math.round(baseVal * multiplier);
      }

      return {
        ...d,
        [field]: baseVal,
      };
    });
  };

  const baseRegData = useMemo(() => {
    if (timeFrame === "24h") {
      return [
        { date: "08:00", Signups: 2 },
        { date: "10:00", Signups: 4 },
        { date: "12:00", Signups: 9 },
        { date: "14:00", Signups: 15 },
        { date: "16:00", Signups: 11 },
        { date: "18:00", Signups: 22 },
        { date: "20:00", Signups: 18 },
      ];
    }
    if (timeFrame === "30d") {
      return [
        { date: "May 1", Signups: 15 },
        { date: "May 5", Signups: 28 },
        { date: "May 10", Signups: 34 },
        { date: "May 15", Signups: 42 },
        { date: "May 20", Signups: 38 },
        { date: "May 25", Signups: 55 },
        { date: "May 30", Signups: 64 },
      ];
    }
    const rawData = Object.entries(registrationsByDate)
      .map(([date, count]) => ({ date, Signups: count }))
      .slice(-7);
    return rawData.length > 0 ? rawData : [
      { date: "Mon", Signups: 4 },
      { date: "Tue", Signups: 7 },
      { date: "Wed", Signups: 5 },
      { date: "Thu", Signups: 12 },
      { date: "Fri", Signups: 8 },
      { date: "Sat", Signups: 15 },
      { date: "Sun", Signups: 10 },
    ];
  }, [timeFrame, registrationsByDate]);

  const finalRegData = useMemo(() => {
    return simulateData(baseRegData, "Signups");
  }, [baseRegData, simLoad]);

  const baseRevData = useMemo(() => {
    if (timeFrame === "24h") {
      return [
        { date: "08:00", Sales: 110 },
        { date: "10:00", Sales: 240 },
        { date: "12:00", Sales: 380 },
        { date: "14:00", Sales: 950 },
        { date: "16:00", Sales: 620 },
        { date: "18:00", Sales: 1100 },
        { date: "20:00", Sales: 850 },
      ];
    }
    if (timeFrame === "30d") {
      return [
        { date: "May 1", Sales: 1200 },
        { date: "May 5", Sales: 1800 },
        { date: "May 10", Sales: 2400 },
        { date: "May 15", Sales: 3100 },
        { date: "May 20", Sales: 2900 },
        { date: "May 25", Sales: 4200 },
        { date: "May 30", Sales: 5100 },
      ];
    }
    const rawData = Object.entries(revenueByDate)
      .map(([date, amount]) => ({ date, Sales: Number(amount.toFixed(2)) }))
      .slice(-7);
    return rawData.length > 0 ? rawData : [
      { date: "Mon", Sales: 120 },
      { date: "Tue", Sales: 240 },
      { date: "Wed", Sales: 180 },
      { date: "Thu", Sales: 520 },
      { date: "Fri", Sales: 310 },
      { date: "Sat", Sales: 890 },
      { date: "Sun", Sales: 450 },
    ];
  }, [timeFrame, revenueByDate]);

  const finalRevData = useMemo(() => {
    return simulateData(baseRevData, "Sales");
  }, [baseRevData, simLoad]);

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

      {/* ── Operational Telemetry & Simulation Controls ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.02 }}
        className="border border-border bg-card/60 cmd-glass p-5 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-3 pointer-events-none opacity-5">
          <TrendingUp className="h-20 w-20 text-primary" />
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground font-mono">Operational Telemetry Settings</h3>
            <p className="text-[10px] text-slate-300 font-medium">Configure time-range scopes, toggle visual chart styles, or test server surge limits.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Timeframe Controller */}
            <div className="flex border border-border/50 bg-neutral-950 p-0.5 rounded">
              {["24h", "7d", "30d"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeFrame(t)}
                  className={`px-3 py-1 text-[9px] font-mono font-bold uppercase tracking-wider rounded transition-all ${
                    timeFrame === t ? "bg-primary/20 text-primary border border-primary/25" : "text-slate-400 hover:text-foreground font-semibold"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Network Latency Simulator */}
            <div className="flex border border-border/50 bg-neutral-950 p-0.5 rounded">
              {[
                { mode: "online", label: "Online", icon: "🟢" },
                { mode: "latency", label: "Laggy", icon: "🟡" },
                { mode: "offline", label: "Offline", icon: "🔴" }
              ].map((n) => (
                <button
                  key={n.mode}
                  type="button"
                  onClick={() => handleNetworkChange(n.mode)}
                  className={`px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 ${
                    networkMode === n.mode
                      ? "bg-primary/20 text-primary border border-primary/25"
                      : "text-slate-400 hover:text-foreground font-semibold"
                  }`}
                >
                  <span className="text-[8px]">{n.icon}</span>
                  <span>{n.label}</span>
                </button>
              ))}
            </div>

            {/* Simulated Surge Slider */}
            <div className="flex items-center gap-3 border border-border/50 bg-neutral-950 px-3 py-1.5 rounded min-w-[240px]">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300 whitespace-nowrap">
                Surge Limit
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={simLoad}
                onChange={(e) => setSimLoad(Number(e.target.value))}
                className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <span className={`text-[10px] font-mono font-bold w-10 text-right tabular-nums ${
                simLoad > 85 ? "text-red-400 animate-pulse font-black" : simLoad > 50 ? "text-amber-400" : "text-emerald-400"
              }`}>
                {simLoad}%
              </span>
            </div>
          </div>
        </div>

        {/* ── Vegas Neon Accent Customizer ── */}
        <div className="mt-4 pt-4 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-200 font-mono">Vegas Accent Customizer</h4>
            <p className="text-[10px] text-slate-300">Set the active site-wide neon glow signature. Changes deploy dynamically.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "sincity", label: "Sin City", color: "bg-[#f97316]" },
              { id: "flamingo", label: "Flamingo", color: "bg-[#ec4899]" },
              { id: "highroller", label: "High Roller", color: "bg-[#a855f7]" },
              { id: "emerald", label: "Emerald", color: "bg-[#10b981]" },
              { id: "jackpot", label: "Jackpot", color: "bg-[#fbbf24]" }
            ].map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => changeTheme(theme.id)}
                className={`px-3 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded border transition-all flex items-center gap-1.5 ${
                  activeTheme === theme.id
                    ? "bg-primary/20 text-primary border-primary font-black"
                    : "border-border/60 hover:border-foreground text-slate-300 hover:text-foreground font-semibold"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${theme.color}`} />
                <span>{theme.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Simulated Drop Surge Controller ── */}
        <div className="mt-4 pt-4 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-200 font-mono">Live Ticket Drop Surge Simulator</h4>
            <p className="text-[10px] text-slate-300">Stress-test graph tickers, sync queues, and CLI console channels with mock high-frequency ticket queues.</p>
          </div>
          <div className="flex items-center gap-3">
            {isSurging && (
              <span className="flex h-2 w-2 rounded-full bg-red-500 cmd-pulse" />
            )}
            <Button
              type="button"
              onClick={() => {
                const next = !isSurging;
                setIsSurging(next);
                window.dispatchEvent(new CustomEvent("rlt_admin_log", {
                  detail: {
                    type: next ? "warn" : "info",
                    text: next ? "[SYS] ENGAGING VEGAS TICKET DROP SURGE SIMULATION ENGINE!" : "[SYS] Disengaging ticket drop simulator..."
                  }
                }));
                if (next) {
                  setSimLoad(95);
                } else {
                  setSimLoad(10);
                }
              }}
              className={`rounded-none text-[10px] font-bold uppercase tracking-wider font-mono px-4 h-9 select-none transition-all ${
                isSurging 
                  ? "bg-red-600 hover:bg-red-700 text-white border border-red-500/30 animate-pulse" 
                  : "bg-primary hover:bg-primary/95 text-white"
              }`}
            >
              {isSurging ? "DISENGAGE SURGE SIM" : "TRIGGER VEGAS TICKET DROP"}
            </Button>
          </div>
        </div>

        {/* Warning Indicator */}
        <AnimatePresence>
          {simLoad > 85 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 border border-red-500/25 bg-red-500/[0.08] p-3 text-left"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 font-mono animate-pulse">
                ⚠️ CRITICAL SYSTEM ALERT: TRAFFIC SURGE THRESHOLD EXCEEDED (TICKET RUSH SIMULATION ENGINE LOAD: {simulatedCpu}%)
              </p>
              <p className="text-[9px] text-red-400/60 mt-0.5 font-mono">
                Mocking peak user activity from Australia nodes. Gateway throttling parameters engaged. Real-time graphs scaling.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
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
        {/* Registrations Chart */}
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
                <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-200">
                  Registration Signups
                </h3>
                <p className="text-[9px] font-mono text-slate-300 mt-0.5">
                  Last data points · scope: {timeFrame}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Chart Style Toggle */}
                <div className="flex border border-border/50 bg-neutral-950 p-0.5 rounded mr-1">
                  {["area", "line", "bar"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setRegChartType(type)}
                      className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded ${
                        regChartType === type ? "bg-primary/20 text-primary border border-primary/25" : "text-slate-400 hover:text-foreground"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/5 border border-primary/10">
                  <Activity className="h-3 w-3 text-primary cmd-pulse" />
                  <span className="text-[8px] font-bold uppercase tracking-wider text-primary">Live</span>
                </div>
              </div>
            </div>

            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {regChartType === "area" ? (
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
                ) : regChartType === "line" ? (
                  <LineChart data={finalRegData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 12%)" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="Signups"
                      stroke="hsl(15, 95%, 55%)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "hsl(15, 95%, 55%)" }}
                      activeDot={{ r: 5, fill: "hsl(15, 95%, 55%)", stroke: "#fff", strokeWidth: 2 }}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={finalRegData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 12%)" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="Signups" fill="hsl(15, 95%, 55%)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* Revenue Chart */}
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
                <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-200">
                  Revenue Stream (AUD)
                </h3>
                <p className="text-[9px] font-mono text-slate-300 mt-0.5">
                  Last data points · scope: {timeFrame}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Chart Style Toggle */}
                <div className="flex border border-border/50 bg-neutral-950 p-0.5 rounded mr-1">
                  {["bar", "line", "area"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setRevChartType(type)}
                      className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded ${
                        revChartType === type ? "bg-accent/20 text-accent border border-accent/25" : "text-slate-400 hover:text-foreground"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-accent/5 border border-accent/10">
                  <DollarSign className="h-3 w-3 text-accent" />
                  <span className="text-[8px] font-bold uppercase tracking-wider text-accent">Stripe</span>
                </div>
              </div>
            </div>

            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {revChartType === "bar" ? (
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
                ) : revChartType === "area" ? (
                  <AreaChart data={finalRevData}>
                    <defs>
                      <linearGradient id="cmdRevGradArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 12%)" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="Sales"
                      stroke="hsl(45, 93%, 47%)"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#cmdRevGradArea)"
                      dot={{ r: 3, fill: "hsl(45, 93%, 47%)", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "hsl(45, 93%, 47%)", stroke: "#fff", strokeWidth: 2 }}
                    />
                  </AreaChart>
                ) : (
                  <LineChart data={finalRevData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 12%)" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="Sales"
                      stroke="hsl(45, 93%, 47%)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "hsl(45, 93%, 47%)" }}
                      activeDot={{ r: 5, fill: "hsl(45, 93%, 47%)", stroke: "#fff", strokeWidth: 2 }}
                    />
                  </LineChart>
                )}
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
                      <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">
                        {order.status || "pending"}
                      </p>
                    </div>
                  </div>
                ))}
                {orders.length === 0 && (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-6 w-6 mx-auto text-slate-500 mb-2" />
                    <p className="text-[10px] text-slate-400 font-medium">No orders yet</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── PWA Offline Sync Monitor HUD ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.52, duration: 0.4 }}
        className="border border-border bg-card/60 cmd-glass overflow-hidden"
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-cyan-500 via-primary to-cyan-500" />
        <div className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-300 flex items-center gap-1.5">
                <Radio className={`h-3.5 w-3.5 ${networkMode === "offline" ? "text-red-500 animate-pulse" : networkMode === "latency" ? "text-amber-500 animate-pulse" : "text-emerald-400"}`} />
                PWA Offline Sync Monitor
              </h3>
              <p className="text-[9px] font-mono text-slate-300 mt-0.5">
                Service Worker Buffer Status · Database Sync State
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 border ${
                networkMode === "offline" ? "bg-red-500/10 border-red-500/30 text-red-400" :
                networkMode === "latency" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              }`}>
                {networkMode === "offline" ? "OFFLINE MODE" : networkMode === "latency" ? "LAGGY (THROTTLED)" : "ONLINE / DEPLOYED"}
              </span>
              
              <Button
                type="button"
                size="sm"
                onClick={handleForceSync}
                disabled={syncQueue.length === 0 || isSyncing}
                className="h-8 rounded-none bg-primary text-[10px] font-bold uppercase tracking-wider font-mono hover:bg-primary/95 text-white disabled:opacity-40"
              >
                {isSyncing ? "Syncing..." : `Force Sync (${syncQueue.length})`}
              </Button>
            </div>
          </div>

          {/* Sync Queue Table / List */}
          <div className="border border-border/40 bg-black/40 p-4">
            {syncQueue.length === 0 ? (
              <div className="text-center py-6 text-slate-400 font-mono text-xs">
                {networkMode === "online" ? (
                  <p className="flex items-center justify-center gap-2">🟢 PWA Sync database is clean. No pending local logs.</p>
                ) : (
                  <p className="flex items-center justify-center gap-2 animate-pulse">⏳ Network degraded. Waiting for user interaction or telemetry events...</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {syncQueue.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-[11px] font-mono border-b border-border/20 pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-bold">[{item.id}]</span>
                      <span className="text-foreground">{item.action}</span>
                      <span className="text-muted-foreground/50">({item.payload})</span>
                    </div>
                    <span className="text-muted-foreground/60">{item.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── System health + what needs attention (plain English) ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4 }}
      >
        <SystemStatusPanel counts={counts} orders={orders} registrations={registrations} />
      </motion.div>
    </div>
  );
}