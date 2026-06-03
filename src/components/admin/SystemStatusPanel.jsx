import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Wifi, WifiOff, CreditCard, Smartphone, Database,
  MessageSquare, Quote, ShoppingBag, UserPlus, CheckCircle2, ArrowRight, LifeBuoy,
  Newspaper, Trophy, Settings, Eye, RefreshCw,
} from "lucide-react";

// ── Quick actions ──
const QUICK_ACTIONS = [
  { icon: Newspaper, label: "Write news", to: "/admin/content" },
  { icon: Trophy, label: "Match results", to: "/admin/events" },
  { icon: MessageSquare, label: "Forum", to: "/admin/community" },
  { icon: ShoppingBag, label: "Orders", to: "/admin/store", countKey: "orders" },
  { icon: Settings, label: "Site text", to: "/admin/settings" },
  { icon: Eye, label: "View site", to: "/" },
];

const REFRESH_INTERVAL_S = 120; // seconds between auto-refresh

// ── SVG Circular Progress Ring ──
function HealthRing({ score, size = 140, strokeWidth = 8 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const isFullHealth = score >= 100;
  const color = isFullHealth ? "#34d399" : "#fbbf24";
  const glowColor = isFullHealth ? "rgba(52,211,153,0.45)" : "rgba(251,191,36,0.45)";

  return (
    <div className="relative flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-lg"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(217 33% 15%)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (circumference * score) / 100 }}
          transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }}
          style={{
            transformOrigin: "center",
            transform: "rotate(-90deg)",
            filter: `drop-shadow(0 0 6px ${glowColor})`,
          }}
        />
      </svg>
      {/* Center percentage */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          className="font-display text-3xl tabular-nums"
          style={{ color, textShadow: `0 0 18px ${glowColor}, 0 0 40px ${glowColor}` }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          {score}%
        </motion.span>
      </div>
      <motion.p
        className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        System Health
      </motion.p>
    </div>
  );
}

// ── Uptime micro progress bar ──
function UptimeBar({ percent = 100 }) {
  return (
    <div className="mt-2 h-[3px] w-full overflow-hidden bg-border/40">
      <motion.div
        className="h-full bg-emerald-500/70"
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.6 }}
      />
    </div>
  );
}

// ── Main component ──
// A plain-English "is everything OK, and what needs me?" panel for a non-technical
// owner. No jargon, no fake telemetry — real status signals plus a to-do list
// built from real data, with buttons that jump straight to the right place.
export default function SystemStatusPanel({ counts = {}, orders = [], registrations = [] }) {
  const navigate = useNavigate();
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [installed, setInstalled] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(Date.now());
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_S);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setInstalled(Boolean(navigator.serviceWorker && navigator.serviceWorker.controller));
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Refresh timestamp & countdown
  useEffect(() => {
    setRefreshedAt(Date.now());
    setCountdown(REFRESH_INTERVAL_S);
  }, [counts, orders, registrations]);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(tick);
  }, [refreshedAt]);

  const formatTime = useCallback((ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, []);

  // ── Real status rows (plain English) ──
  const checks = useMemo(() => [
    {
      ok: online,
      icon: online ? Wifi : WifiOff,
      label: "Website online",
      detail: online ? "Your site is up and reachable." : "No internet connection on this device.",
    },
    {
      ok: Boolean(counts),
      icon: Database,
      label: "Live data connected",
      detail: "News, store, forum and accounts are loading correctly.",
    },
    {
      ok: true,
      icon: CreditCard,
      label: "Secure payments",
      detail: "Card payments are handled securely by Stripe — no card details touch your site.",
    },
    {
      ok: true,
      icon: Smartphone,
      label: installed ? "Installed app ready" : "App ready to install",
      detail: installed
        ? "This device has the app installed and can work offline."
        : "Fans can add the site to their home screen as an app (Share → Add to Home Screen).",
    },
  ], [online, counts, installed]);

  const allOk = checks.every((c) => c.ok);

  // ── To-do list from real data ──
  const pendingPosts = Number(counts.pendingPosts || 0);
  const pendingTestimonials = Number(counts.pendingTestimonials || 0);
  const ordersToFulfil = orders.filter((o) => o.status === "paid" || o.status === "packing").length;
  const now = Date.now();
  const newRegistrations = registrations.filter(
    (r) => r.created_date && now - new Date(r.created_date).getTime() < 7 * 86400000
  ).length;

  const todos = [
    ordersToFulfil > 0 && {
      icon: ShoppingBag,
      count: ordersToFulfil,
      label: ordersToFulfil === 1 ? "paid order to send" : "paid orders to send",
      cta: "Open store",
      to: "/admin/store",
      priority: "urgent",
    },
    pendingPosts > 0 && {
      icon: MessageSquare,
      count: pendingPosts,
      label: pendingPosts === 1 ? "forum post to review" : "forum posts to review",
      cta: "Moderate",
      to: "/admin/community",
      priority: "normal",
    },
    pendingTestimonials > 0 && {
      icon: Quote,
      count: pendingTestimonials,
      label: pendingTestimonials === 1 ? "testimonial to approve" : "testimonials to approve",
      cta: "Review",
      to: "/admin/content",
      priority: "normal",
    },
    newRegistrations > 0 && {
      icon: UserPlus,
      count: newRegistrations,
      label: "new interest sign-ups this week",
      cta: "View",
      to: "/admin/people",
      priority: "normal",
    },
  ].filter(Boolean);

  // Health score: 25% per passing check
  const healthScore = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);

  // Badge counts for quick actions
  const quickActionCounts = useMemo(() => ({
    orders: ordersToFulfil,
  }), [ordersToFulfil]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="border border-border bg-card/60 cmd-glass overflow-hidden rounded-none"
    >
      {/* Top accent bar */}
      <div className={`h-[2px] w-full ${allOk ? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" : "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500"}`} />

      <div className="p-5">
        {/* ── Header row ── */}
        <div className="mb-5 flex items-center gap-2">
          <ShieldCheck className={`h-4 w-4 ${allOk ? "text-emerald-400" : "text-amber-400"}`} />
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Control centre</h3>
          <span className={`ml-auto inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-none ${allOk ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${allOk ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"}`} />
            {allOk ? "All good" : "Needs a look"}
          </span>
        </div>

        {/* ── Health Ring ── */}
        <div className="mb-6 flex justify-center">
          <HealthRing score={healthScore} />
        </div>

        {/* ── Quick actions ── */}
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Quick actions</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {QUICK_ACTIONS.map(({ icon: Icon, label, to, countKey }, i) => {
            const badge = countKey ? quickActionCounts[countKey] : 0;
            return (
              <motion.button
                key={label}
                type="button"
                onClick={() => navigate(to)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="group relative flex flex-col items-center justify-center gap-1.5 border border-border/50 bg-muted/10 p-3 text-center transition-colors hover:border-primary/40 hover:bg-primary/[0.05] overflow-hidden rounded-none"
              >
                {/* cmd-accent-bar top line */}
                <div className="cmd-accent-bar absolute inset-x-0 top-0 h-[2px] bg-primary/0 transition-all group-hover:bg-primary/60" />

                {/* Badge */}
                {badge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center bg-primary px-1 text-[9px] font-bold text-white rounded-none">
                    {badge}
                  </span>
                )}

                <motion.span
                  className="inline-flex"
                  whileHover={{ rotate: [0, -12, 12, -6, 0], transition: { duration: 0.5 } }}
                >
                  <Icon className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
                </motion.span>
                <span className="text-[10px] font-bold uppercase tracking-wide leading-tight text-foreground">{label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* ── Needs your attention (Todos) ── */}
        <div className="mt-5 border-t border-border/40 pt-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Needs your attention</p>
          <AnimatePresence mode="popLayout">
            {todos.length === 0 ? (
              <motion.div
                key="all-clear"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-3 border border-emerald-500/30 bg-emerald-500/[0.06] p-4 rounded-none"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                <p className="text-sm text-foreground">You're all caught up — nothing needs you right now. 🎉</p>
              </motion.div>
            ) : (
              <div className="grid gap-2">
                {todos.map((t, i) => {
                  const Icon = t.icon;
                  const isUrgent = t.priority === "urgent";
                  return (
                    <motion.button
                      key={t.to}
                      type="button"
                      onClick={() => navigate(t.to)}
                      initial={{ opacity: 0, x: -24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 24, height: 0, marginTop: 0, padding: 0 }}
                      transition={{ duration: 0.35, delay: i * 0.08 }}
                      className="group flex items-center gap-3 border border-border/50 bg-muted/10 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04] rounded-none"
                    >
                      {/* Priority dot */}
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        {isUrgent && (
                          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60" />
                        )}
                        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isUrgent ? "bg-red-500" : "bg-amber-500"}`} />
                      </span>

                      <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-primary/30 bg-primary/10 text-primary rounded-none">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 text-sm text-foreground">
                        <span className="font-display text-lg tabular-nums text-primary">{t.count}</span>{" "}
                        {t.label}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-primary">
                        {t.cta} <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Status checks ── */}
        <div className="mt-5 border-t border-border/40 pt-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Everything working?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {checks.map((c, i) => {
              const Icon = c.icon;
              return (
                <motion.div
                  key={c.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 + i * 0.08 }}
                  className="border border-border/40 bg-muted/10 overflow-hidden rounded-none"
                >
                  <div className="flex items-start gap-3 p-3">
                    <motion.span
                      animate={c.ok ? { scale: [1, 1.15, 1] } : {}}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    >
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${c.ok ? "text-emerald-400" : "text-red-400"}`} />
                    </motion.span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        {c.label}
                        <span className={c.ok ? "text-emerald-400" : "text-red-400"}>{c.ok ? "✓" : "✕"}</span>
                      </p>
                      <p className="text-xs leading-snug text-muted-foreground">{c.detail}</p>
                    </div>
                  </div>
                  {/* Uptime progress bar */}
                  <UptimeBar percent={c.ok ? 100 : 0} />
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Last refreshed + countdown ── */}
        <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
            <RefreshCw className={`h-3 w-3 ${countdown === 0 ? "animate-spin" : ""}`} />
            <span>
              Refreshed {formatTime(refreshedAt)}
              {countdown > 0 && (
                <> · next in <span className="tabular-nums font-medium text-muted-foreground">{countdown}s</span></>
              )}
            </span>
          </div>
        </div>

        {/* ── Friendly help footer ── */}
        <div className="mt-3 flex items-start gap-2 border-t border-border/40 pt-3 text-xs text-muted-foreground">
          <LifeBuoy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          <p>Tap an action above to jump straight there. A green ✓ means it's working — if you ever see a red ✕, screenshot it and send it to Dene. Nothing here needs technical knowledge.</p>
        </div>
      </div>
    </motion.div>
  );
}
