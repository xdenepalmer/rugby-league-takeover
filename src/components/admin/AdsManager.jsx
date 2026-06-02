import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone, Plus, Trash2, Pencil, Eye, EyeOff,
  BarChart3, MousePointerClick, MonitorSmartphone,
  LayoutTemplate, X, Save, ChevronDown
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import ImageField from "./ImageField";

/* ── Constants ── */
const POSITIONS = [
  { key: "banner-top",    label: "Banner Top",    desc: "Full-width above main content" },
  { key: "banner-bottom", label: "Banner Bottom", desc: "Full-width below main content" },
  { key: "sidebar",       label: "Sidebar",       desc: "Right column on desktop" },
  { key: "in-feed",       label: "In-Feed",       desc: "Between content cards" },
  { key: "footer",        label: "Footer",        desc: "Above site footer" },
];

const SIZES = [
  { key: "leaderboard",       label: "Leaderboard",       dim: "728 × 90" },
  { key: "medium-rectangle",  label: "Medium Rectangle",  dim: "300 × 250" },
  { key: "wide-skyscraper",   label: "Wide Skyscraper",   dim: "160 × 600" },
  { key: "mobile-banner",     label: "Mobile Banner",     dim: "320 × 50" },
];

const emptyAd = () => ({
  id: crypto.randomUUID(),
  title: "",
  image_url: "",
  target_url: "",
  position: "banner-top",
  size: "leaderboard",
  is_active: true,
  start_date: "",
  end_date: "",
});

/* ── Helpers ── */
function readLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function AdsManager() {
  /* ── State ── */
  const [adsEnabled, setAdsEnabled] = useState(() => localStorage.getItem("rlt_ads_enabled") === "true");
  const [ads, setAds]     = useState(() => readLS("rlt_ad_config", []));
  const [stats]           = useState(() => readLS("rlt_ad_stats", {}));
  const [editing, setEditing] = useState(null);   // null | ad object
  const [view, setView]       = useState("slots"); // "slots" | "form" | "analytics"

  /* Persist on change */
  useEffect(() => { localStorage.setItem("rlt_ads_enabled", String(adsEnabled)); }, [adsEnabled]);
  useEffect(() => { writeLS("rlt_ad_config", ads); }, [ads]);

  /* Listen for live stat updates from AdSlot CustomEvents */
  useEffect(() => {
    const handle = () => {
      /* no-op refresh — stats are read once on mount to avoid constant re-render loops */
    };
    window.addEventListener("rlt_ad_impression", handle);
    window.addEventListener("rlt_ad_click", handle);
    return () => {
      window.removeEventListener("rlt_ad_impression", handle);
      window.removeEventListener("rlt_ad_click", handle);
    };
  }, []);

  /* ── CRUD ── */
  const saveAd = useCallback((ad) => {
    setAds((prev) => {
      const idx = prev.findIndex((a) => a.id === ad.id);
      if (idx >= 0) { const copy = [...prev]; copy[idx] = ad; return copy; }
      return [...prev, ad];
    });
    setEditing(null);
    setView("slots");
    toast({ title: "Ad saved", description: `"${ad.title || "Untitled"}" has been saved.` });
  }, []);

  const deleteAd = useCallback((id) => {
    setAds((prev) => prev.filter((a) => a.id !== id));
    toast({ title: "Ad removed" });
  }, []);

  /* ── Analytics aggregation ── */
  const analytics = useMemo(() => {
    let totalImpressions = 0;
    let totalClicks = 0;
    const byPosition = {};
    POSITIONS.forEach((p) => { byPosition[p.key] = { impressions: 0, clicks: 0 }; });

    Object.entries(stats).forEach(([key, val]) => {
      const pos = key.split("__")[0];
      totalImpressions += val.impressions || 0;
      totalClicks += val.clicks || 0;
      if (byPosition[pos]) {
        byPosition[pos].impressions += val.impressions || 0;
        byPosition[pos].clicks += val.clicks || 0;
      }
    });

    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";
    return { totalImpressions, totalClicks, ctr, byPosition };
  }, [stats]);

  const maxImpressions = Math.max(1, ...Object.values(analytics.byPosition).map((v) => v.impressions));

  /* ── Render ── */
  return (
    <section className="grid gap-5">
      {/* ──────────── 1. GLOBAL TOGGLE ──────────── */}
      <div className="border border-border bg-card/60 cmd-glass p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground font-mono mb-1">
              Master Control
            </p>
            <h3 className="font-display text-xl uppercase tracking-wide">
              Global Ad System
            </h3>
          </div>

          <div className="flex items-center gap-4">
            <AnimatePresence mode="wait">
              {adsEnabled ? (
                <motion.span
                  key="on"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400 font-mono">
                    Ads Live
                  </span>
                </motion.span>
              ) : (
                <motion.span
                  key="off"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted/20 border border-border"
                >
                  <EyeOff className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground font-mono">
                    Disabled Site-Wide
                  </span>
                </motion.span>
              )}
            </AnimatePresence>

            <Switch
              checked={adsEnabled}
              onCheckedChange={setAdsEnabled}
              className="scale-125"
            />
          </div>
        </div>
      </div>

      {/* ──────────── View Tabs ──────────── */}
      <div className="flex gap-2">
        {[
          { key: "slots",     label: "Ad Slots",    icon: LayoutTemplate },
          { key: "analytics", label: "Analytics",    icon: BarChart3 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] font-mono border transition-all duration-200 ${
              view === key
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card/40 text-muted-foreground hover:border-primary/20 hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
        <Button
          size="sm"
          onClick={() => { setEditing(emptyAd()); setView("form"); }}
          className="ml-auto rounded-none bg-primary hover:bg-primary/90 text-xs uppercase tracking-wider font-bold"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Ad
        </Button>
      </div>

      {/* ──────────── 2. AD SLOTS OVERVIEW ──────────── */}
      <AnimatePresence mode="wait">
        {view === "slots" && (
          <motion.div
            key="slots"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {POSITIONS.map((pos) => {
              const assigned = ads.find((a) => a.position === pos.key && a.is_active !== false);
              return (
                <div
                  key={pos.key}
                  className="border border-border bg-card/40 cmd-glass overflow-hidden group/slot"
                >
                  {/* Position preview mockup */}
                  <div className="relative h-28 bg-gradient-to-b from-muted/20 to-muted/5 flex items-center justify-center overflow-hidden">
                    {assigned?.image_url ? (
                      <img
                        src={assigned.image_url}
                        alt={assigned.title}
                        className="h-full w-full object-cover opacity-60 transition-opacity duration-300 group-hover/slot:opacity-80"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Megaphone className="h-6 w-6 text-muted-foreground/20" />
                        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/30 font-mono">
                          Empty
                        </span>
                      </div>
                    )}
                    {/* Position badge */}
                    <span className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.2em] text-white/80 font-mono">
                      {pos.key}
                    </span>
                  </div>

                  <div className="p-4">
                    <h4 className="font-display text-sm uppercase tracking-wide mb-0.5">
                      {pos.label}
                    </h4>
                    <p className="text-[10px] text-muted-foreground/60 mb-3">{pos.desc}</p>

                    {assigned ? (
                      <div className="grid gap-2">
                        <div className="flex items-center gap-2">
                          <Eye className="h-3 w-3 text-emerald-400" />
                          <span className="text-xs font-mono text-foreground truncate">{assigned.title || "Untitled"}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 rounded-none text-[10px] uppercase tracking-wider"
                            onClick={() => { setEditing({ ...assigned }); setView("form"); }}
                          >
                            <Pencil className="mr-1.5 h-3 w-3" /> Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="rounded-none text-[10px] uppercase tracking-wider"
                            onClick={() => deleteAd(assigned.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full rounded-none text-[10px] uppercase tracking-wider border-dashed border-primary/20 text-primary hover:bg-primary/5"
                        onClick={() => { setEditing({ ...emptyAd(), position: pos.key }); setView("form"); }}
                      >
                        <Plus className="mr-1.5 h-3 w-3" /> Assign Ad
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* ──────────── 3. CREATE / EDIT FORM ──────────── */}
        {view === "form" && editing && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="border border-border bg-card/60 cmd-glass"
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] font-mono text-muted-foreground">
                {ads.find((a) => a.id === editing.id) ? "Edit Ad" : "New Ad"}
              </p>
              <button
                onClick={() => { setEditing(null); setView("slots"); }}
                className="flex h-8 w-8 items-center justify-center border border-border hover:border-primary/30 hover:text-primary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Title</label>
                  <Input
                    placeholder="Ad campaign name"
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    className="h-11 rounded-none"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Target URL</label>
                  <Input
                    placeholder="https://sponsor-website.com"
                    value={editing.target_url}
                    onChange={(e) => setEditing({ ...editing, target_url: e.target.value })}
                    className="h-11 rounded-none"
                  />
                </div>
              </div>

              <ImageField
                label="Ad Creative"
                value={editing.image_url}
                onChange={(url) => setEditing({ ...editing, image_url: url })}
              />

              <div className="grid gap-4 md:grid-cols-2">
                {/* Position selector */}
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Position</label>
                  <div className="relative">
                    <select
                      value={editing.position}
                      onChange={(e) => setEditing({ ...editing, position: e.target.value })}
                      className="h-11 w-full appearance-none border border-border bg-background px-3 pr-8 text-sm font-mono rounded-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                    >
                      {POSITIONS.map((p) => (
                        <option key={p.key} value={p.key}>{p.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                {/* Size selector */}
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Size</label>
                  <div className="relative">
                    <select
                      value={editing.size}
                      onChange={(e) => setEditing({ ...editing, size: e.target.value })}
                      className="h-11 w-full appearance-none border border-border bg-background px-3 pr-8 text-sm font-mono rounded-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                    >
                      {SIZES.map((s) => (
                        <option key={s.key} value={s.key}>{s.label} ({s.dim})</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Start Date</label>
                  <Input
                    type="date"
                    value={editing.start_date}
                    onChange={(e) => setEditing({ ...editing, start_date: e.target.value })}
                    className="h-11 rounded-none font-mono"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">End Date</label>
                  <Input
                    type="date"
                    value={editing.end_date}
                    onChange={(e) => setEditing({ ...editing, end_date: e.target.value })}
                    className="h-11 rounded-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 border-t border-border pt-4">
                <label className="flex items-center gap-2 text-sm">
                  Active
                  <Switch
                    checked={editing.is_active !== false}
                    onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                  />
                </label>

                <div className="ml-auto flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-none text-xs uppercase tracking-wider"
                    onClick={() => { setEditing(null); setView("slots"); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="rounded-none bg-primary hover:bg-primary/90 text-xs uppercase tracking-wider font-bold"
                    disabled={!editing.title && !editing.image_url}
                    onClick={() => saveAd(editing)}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Ad
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ──────────── 4. ANALYTICS DASHBOARD ──────────── */}
        {view === "analytics" && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="grid gap-4"
          >
            {/* KPI cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Total Impressions", value: analytics.totalImpressions.toLocaleString(), icon: Eye },
                { label: "Total Clicks",      value: analytics.totalClicks.toLocaleString(),      icon: MousePointerClick },
                { label: "Click-Through Rate", value: `${analytics.ctr}%`,                        icon: BarChart3 },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="border border-border bg-card/60 cmd-glass p-5"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-primary/60" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground font-mono">
                      {label}
                    </span>
                  </div>
                  <p className="font-display text-3xl uppercase tracking-wide">{value}</p>
                </div>
              ))}
            </div>

            {/* Per-position breakdown */}
            <div className="border border-border bg-card/60 cmd-glass p-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground font-mono mb-4">
                Per-Position Breakdown
              </p>

              <div className="grid gap-3">
                {POSITIONS.map((pos) => {
                  const data = analytics.byPosition[pos.key];
                  const pct = maxImpressions > 0 ? ((data.impressions / maxImpressions) * 100) : 0;
                  const positionCtr = data.impressions > 0
                    ? ((data.clicks / data.impressions) * 100).toFixed(1)
                    : "0.0";

                  return (
                    <div key={pos.key} className="grid gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-foreground uppercase tracking-wider">
                          {pos.label}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {data.impressions.toLocaleString()} imp · {data.clicks.toLocaleString()} clicks · {positionCtr}% CTR
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted/20 border border-border/30 overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-primary/80 to-primary/40"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {analytics.totalImpressions === 0 && (
                <div className="mt-6 flex flex-col items-center gap-2 py-8 text-muted-foreground/40">
                  <MonitorSmartphone className="h-8 w-8" />
                  <p className="text-xs font-mono uppercase tracking-wider">No analytics data yet</p>
                  <p className="text-[10px] text-muted-foreground/30">Enable ads and assign creatives to start tracking.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
