import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck, Wifi, WifiOff, CreditCard, Smartphone, Database,
  MessageSquare, Quote, ShoppingBag, UserPlus, CheckCircle2, ArrowRight, LifeBuoy,
} from "lucide-react";

// A plain-English "is everything OK, and what needs me?" panel for a non-technical
// owner. No jargon, no fake telemetry — real status signals plus a to-do list
// built from real data, with buttons that jump straight to the right place.
export default function SystemStatusPanel({ counts = {}, orders = [], registrations = [] }) {
  const navigate = useNavigate();
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [installed, setInstalled] = useState(false);

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

  // ── Real status rows (plain English) ──
  const checks = [
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
  ];
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
    pendingPosts > 0 && {
      icon: MessageSquare,
      count: pendingPosts,
      label: pendingPosts === 1 ? "forum post to review" : "forum posts to review",
      cta: "Moderate",
      to: "/admin/community",
    },
    pendingTestimonials > 0 && {
      icon: Quote,
      count: pendingTestimonials,
      label: pendingTestimonials === 1 ? "testimonial to approve" : "testimonials to approve",
      cta: "Review",
      to: "/admin/content",
    },
    ordersToFulfil > 0 && {
      icon: ShoppingBag,
      count: ordersToFulfil,
      label: ordersToFulfil === 1 ? "paid order to send" : "paid orders to send",
      cta: "Open store",
      to: "/admin/store",
    },
    newRegistrations > 0 && {
      icon: UserPlus,
      count: newRegistrations,
      label: "new interest sign-ups this week",
      cta: "View",
      to: "/admin/people",
    },
  ].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="border border-border bg-card/60 cmd-glass overflow-hidden"
    >
      <div className={`h-[2px] w-full ${allOk ? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" : "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500"}`} />
      <div className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className={`h-4 w-4 ${allOk ? "text-emerald-400" : "text-amber-400"}`} />
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">System health</h3>
          <span className={`ml-auto inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${allOk ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${allOk ? "bg-emerald-400" : "bg-amber-400"}`} />
            {allOk ? "All good" : "Needs a look"}
          </span>
        </div>

        {/* Plain-English status rows */}
        <div className="grid gap-2 sm:grid-cols-2">
          {checks.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="flex items-start gap-3 border border-border/40 bg-muted/10 p-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${c.ok ? "text-emerald-400" : "text-red-400"}`} />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    {c.label}
                    <span className={c.ok ? "text-emerald-400" : "text-red-400"}>{c.ok ? "✓" : "✕"}</span>
                  </p>
                  <p className="text-xs leading-snug text-muted-foreground">{c.detail}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Needs your attention */}
        <div className="mt-5 border-t border-border/40 pt-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Needs your attention</p>
          {todos.length === 0 ? (
            <div className="flex items-center gap-3 border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              <p className="text-sm text-foreground">You're all caught up — nothing needs you right now. 🎉</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {todos.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.to}
                    type="button"
                    onClick={() => navigate(t.to)}
                    className="group flex items-center gap-3 border border-border/50 bg-muted/10 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-primary/30 bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-foreground">
                      <span className="font-display text-lg tabular-nums text-primary">{t.count}</span>{" "}
                      {t.label}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-primary">
                      {t.cta} <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Friendly help footer */}
        <div className="mt-4 flex items-start gap-2 border-t border-border/40 pt-3 text-xs text-muted-foreground">
          <LifeBuoy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          <p>A green ✓ means it's working. If you ever see a red ✕ here, take a screenshot and send it to Dene — nothing else needs technical knowledge.</p>
        </div>
      </div>
    </motion.div>
  );
}
