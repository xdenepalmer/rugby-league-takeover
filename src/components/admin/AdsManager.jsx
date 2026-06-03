import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone, Plus, Trash2, Pencil, Eye, EyeOff,
  BarChart3, MousePointerClick, MonitorSmartphone,
  LayoutTemplate, X, Save, ChevronDown, Copy, ExternalLink,
  Calendar, AlertTriangle, CheckCircle2, RefreshCw, Link2,
  ImageIcon, Zap, Clock, Monitor, Smartphone,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import ImageField from "./ImageField";

/* ── Constants ── */
// Only positions that are actually rendered on the public site are offered here.
// (sidebar / in-feed have no mount point yet — re-add when those slots exist.)
const POSITIONS = [
  { key: "banner-top",    label: "Banner Top",    desc: "Full-width above main content", icon: "↕" },
  { key: "banner-bottom", label: "Banner Bottom", desc: "Full-width below main content", icon: "↕" },
  { key: "footer",        label: "Footer",        desc: "Above site footer", icon: "▬" },
];

const SIZES = [
  { key: "leaderboard",       label: "Leaderboard",       dim: "728 × 90",  w: 728, h: 90 },
  { key: "medium-rectangle",  label: "Medium Rectangle",  dim: "300 × 250", w: 300, h: 250 },
  { key: "wide-skyscraper",   label: "Wide Skyscraper",   dim: "160 × 600", w: 160, h: 600 },
  { key: "mobile-banner",     label: "Mobile Banner",     dim: "320 × 50",  w: 320, h: 50 },
];

const emptyAd = () => ({
  title: "",
  image_url: "",
  target_url: "",
  position: "banner-top",
  size: "leaderboard",
  is_active: true,
  start_date: "",
  end_date: "",
  sponsor_id: "",
  price_per_month: 0,
  cpm_rate: 0,
  device_target: "all",
  ab_variants: [],
});

/* ── Helpers ── */
function readLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}
function isValidUrl(url) {
  if (!url) return false;
  try { new URL(url); return true; } catch { return false; }
}
function isScheduleActive(ad) {
  if (!ad) return false;
  const today = new Date().toISOString().split("T")[0];
  if (ad.start_date && today < ad.start_date) return false;
  if (ad.end_date && today > ad.end_date) return false;
  return true;
}
function getStatusLabel(ad) {
  if (!ad.is_active || ad.is_active === "false") return { label: "Paused", color: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
  if (!isScheduleActive(ad)) return { label: "Scheduled", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
  return { label: "Live", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
}

/* ── Validation ── */
function validateAd(ad) {
  const errors = [];
  if (!ad.title?.trim()) errors.push("Title is required");
  if (!ad.image_url?.trim()) errors.push("Ad creative image is required");
  if (ad.target_url && !isValidUrl(ad.target_url)) errors.push("Target URL is not a valid URL");
  if (ad.start_date && ad.end_date && ad.start_date > ad.end_date) errors.push("End date must be after start date");
  return errors;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function AdsManager() {
  /* ── React Query data layer ── */
  const queryClient = useQueryClient();

  const { data: ads = [] } = useQuery({
    queryKey: ['siteAds'],
    queryFn: () => base44.entities.SiteAd.list('-created_date', 200),
  });

  const { data: settingsRecords = [] } = useQuery({
    queryKey: ['siteSettings'],
    queryFn: () => base44.entities.SiteSettings.list('-updated_date', 1),
  });
  const settings = settingsRecords[0] || {};
  const adsEnabled = settings.ads_enabled === true || settings.ads_enabled === "true";

  /* ── Local UI state ── */
  const [stats, setStats] = useState(() => readLS("rlt_ad_stats", {}));
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState("slots");
  const [errors, setErrors] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sponsors] = useState(() => readLS('rlt_sponsors', []));

  /* ── Mutations ── */
  const toggleAdsMutation = useMutation({
    mutationFn: async (enabled) => {
      if (settings.id) {
        return base44.entities.SiteSettings.update(settings.id, { ads_enabled: enabled });
      }
      return base44.entities.SiteSettings.create({ ads_enabled: enabled });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['siteSettings'] }),
  });

  const saveMutation = useMutation({
    mutationFn: async (ad) => {
      if (ad.id) {
        const { id, ...payload } = ad;
        return base44.entities.SiteAd.update(id, payload);
      }
      return base44.entities.SiteAd.create(ad);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['siteAds'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SiteAd.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['siteAds'] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (ad) => {
      const { id, created_date, updated_date, ...rest } = ad;
      return base44.entities.SiteAd.create({ ...rest, title: `${ad.title} (Copy)` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siteAds'] });
      toast({ title: "Ad duplicated" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.SiteAd.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['siteAds'] }),
  });

  /* Refresh stats periodically (session metrics — stays in localStorage) */
  useEffect(() => {
    const refresh = () => setStats(readLS("rlt_ad_stats", {}));
    const id = setInterval(refresh, 10000);
    const handleImpression = () => setTimeout(refresh, 600);
    window.addEventListener("rlt_ad_impression", handleImpression);
    window.addEventListener("rlt_ad_click", handleImpression);
    return () => {
      clearInterval(id);
      window.removeEventListener("rlt_ad_impression", handleImpression);
      window.removeEventListener("rlt_ad_click", handleImpression);
    };
  }, []);

  /* ── CRUD ── */
  const saveAd = useCallback((ad) => {
    const validationErrors = validateAd(ad);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      toast({ title: "Validation Error", description: validationErrors[0], variant: "destructive" });
      return;
    }
    setErrors([]);
    saveMutation.mutate(ad, {
      onSuccess: () => {
        setEditing(null);
        setView("slots");
        toast({ title: "Ad saved", description: `"${ad.title}" has been saved successfully.` });
      },
    });
  }, [saveMutation]);

  const deleteAd = useCallback((id) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setDeleteConfirm(null);
        toast({ title: "Ad removed" });
      },
    });
  }, [deleteMutation]);

  const duplicateAd = useCallback((ad) => {
    duplicateMutation.mutate(ad);
  }, [duplicateMutation]);

  const toggleAdActive = useCallback((id) => {
    const ad = ads.find((a) => a.id === id);
    if (ad) {
      toggleActiveMutation.mutate({ id, is_active: !ad.is_active });
    }
  }, [ads, toggleActiveMutation]);

  const clearAllStats = useCallback(() => {
    writeLS("rlt_ad_stats", {});
    setStats({});
    toast({ title: "Analytics cleared" });
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

  const activeCount = ads.filter((a) => a.is_active && isScheduleActive(a)).length;
  const scheduledCount = ads.filter((a) => a.is_active && !isScheduleActive(a)).length;

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
            <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1">
                <Megaphone className="h-3 w-3" /> {ads.length} total
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <Zap className="h-3 w-3" /> {activeCount} live
              </span>
              {scheduledCount > 0 && (
                <span className="flex items-center gap-1 text-amber-400">
                  <Clock className="h-3 w-3" /> {scheduledCount} scheduled
                </span>
              )}
            </div>
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
              onCheckedChange={(v) => toggleAdsMutation.mutate(v)}
              className="scale-125"
            />
          </div>
        </div>
      </div>

      {/* ──────────── View Tabs ──────────── */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "slots",     label: "Ad Slots",  icon: LayoutTemplate, count: ads.length },
          { key: "list",      label: "All Ads",   icon: Megaphone, count: ads.length },
          { key: "analytics", label: "Analytics",  icon: BarChart3 },
        ].map(({ key, label, icon: Icon, count }) => (
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
            {count > 0 && <span className="text-[8px] ml-0.5 opacity-60">({count})</span>}
          </button>
        ))}
        <Button
          size="sm"
          onClick={() => { setEditing(emptyAd()); setView("form"); setErrors([]); }}
          className="ml-auto rounded-none bg-primary hover:bg-primary/90 text-xs uppercase tracking-wider font-bold"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Ad
        </Button>
      </div>

      {/* ──────────── VIEWS ──────────── */}
      <AnimatePresence mode="wait">

        {/* ── 2. AD SLOTS POSITION OVERVIEW ── */}
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
              const assigned = ads.filter((a) => a.position === pos.key);
              const active = assigned.find((a) => a.is_active && isScheduleActive(a));
              const posStats = analytics.byPosition[pos.key];
              return (
                <div
                  key={pos.key}
                  className="border border-border bg-card/40 cmd-glass overflow-hidden group/slot"
                >
                  {/* Position preview */}
                  <div className="relative h-28 bg-gradient-to-b from-muted/20 to-muted/5 flex items-center justify-center overflow-hidden">
                    {active?.image_url ? (
                      <img
                        src={active.image_url}
                        alt={active.title}
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
                    <span className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.2em] text-white/80 font-mono">
                      {pos.key}
                    </span>
                    {/* Stats overlay */}
                    {(posStats.impressions > 0 || posStats.clicks > 0) && (
                      <span className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 text-[7px] font-mono text-white/60">
                        {posStats.impressions} imp · {posStats.clicks} clk
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="font-display text-sm uppercase tracking-wide">{pos.label}</h4>
                      {active && (
                        <span className={`text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 border ${getStatusLabel(active).color}`}>
                          {getStatusLabel(active).label}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mb-3">{pos.desc}</p>

                    {active ? (
                      <div className="grid gap-2">
                        <div className="flex items-center gap-2">
                          <Eye className="h-3 w-3 text-emerald-400 shrink-0" />
                          <span className="text-xs font-mono text-foreground truncate">{active.title || "Untitled"}</span>
                        </div>
                        {active.target_url && (
                          <div className="flex items-center gap-2">
                            <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-[10px] font-mono text-muted-foreground truncate">{active.target_url}</span>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 rounded-none text-[10px] uppercase tracking-wider"
                            onClick={() => { setEditing({ ...active }); setView("form"); setErrors([]); }}
                          >
                            <Pencil className="mr-1.5 h-3 w-3" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-none text-[10px] uppercase tracking-wider"
                            onClick={() => duplicateAd(active)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="rounded-none text-[10px] uppercase tracking-wider"
                            onClick={() => setDeleteConfirm(active.id)}
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
                        onClick={() => { setEditing({ ...emptyAd(), position: pos.key }); setView("form"); setErrors([]); }}
                      >
                        <Plus className="mr-1.5 h-3 w-3" /> Assign Ad
                      </Button>
                    )}

                    {/* Extra ads in this position */}
                    {assigned.length > 1 && (
                      <p className="mt-2 text-[8px] text-muted-foreground/50 font-mono">
                        +{assigned.length - 1} more ad{assigned.length > 2 ? "s" : ""} in this slot
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* ── 2b. ALL ADS LIST ── */}
        {view === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="border border-border bg-card/40 cmd-glass"
          >
            <div className="p-4 border-b border-border">
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground font-mono">
                All Advertisements · {ads.length} total
              </p>
            </div>
            {ads.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground/40">
                <Megaphone className="h-8 w-8" />
                <p className="text-xs font-mono uppercase tracking-wider">No ads created yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {ads.map((ad) => {
                  const status = getStatusLabel(ad);
                  const pos = POSITIONS.find((p) => p.key === ad.position);
                  const adStats = stats[`${ad.position}__${ad.id}`] || { impressions: 0, clicks: 0 };
                  return (
                    <div key={ad.id} className="flex items-center gap-4 p-4 hover:bg-muted/5 transition-colors">
                      {/* Thumbnail */}
                      <div className="w-16 h-12 border border-border/40 bg-muted/10 shrink-0 overflow-hidden flex items-center justify-center">
                        {ad.image_url ? (
                          <img src={ad.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                        )}
                      </div>
                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground truncate">{ad.title || "Untitled"}</p>
                          <span className={`text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 border shrink-0 ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                          <span>{pos?.label || ad.position}</span>
                          <span>·</span>
                          <span>{adStats.impressions} imp</span>
                          <span>{adStats.clicks} clk</span>
                          {ad.sponsor_id && (() => { const sp = sponsors.find(s => s.id === ad.sponsor_id); return sp ? <span>· <span className="text-primary">{sp.company_name}</span></span> : null; })()}
                          {ad.price_per_month > 0 && <span>· <span className="text-emerald-400">${ad.price_per_month}/mo</span></span>}
                          <span className="inline-flex items-center gap-0.5">
                            {(!ad.device_target || ad.device_target === 'all') && <><Monitor className="h-3 w-3" /><Smartphone className="h-3 w-3" /></>}
                            {ad.device_target === 'desktop' && <Monitor className="h-3 w-3" />}
                            {ad.device_target === 'mobile' && <Smartphone className="h-3 w-3" />}
                          </span>
                          {ad.start_date && <span>· from {ad.start_date}</span>}
                          {ad.end_date && <span>to {ad.end_date}</span>}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-none h-8 w-8 p-0"
                          onClick={() => toggleAdActive(ad.id)}
                          title={ad.is_active ? "Pause" : "Activate"}
                        >
                          {ad.is_active ? <Eye className="h-3.5 w-3.5 text-emerald-400" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-none h-8 w-8 p-0"
                          onClick={() => { setEditing({ ...ad }); setView("form"); setErrors([]); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-none h-8 w-8 p-0"
                          onClick={() => duplicateAd(ad)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-none h-8 w-8 p-0 text-red-400 hover:text-red-300"
                          onClick={() => setDeleteConfirm(ad.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── 3. CREATE / EDIT FORM ── */}
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
                {editing.id ? "Edit Ad" : "New Ad"}
              </p>
              <button
                onClick={() => { setEditing(null); setView("slots"); setErrors([]); }}
                className="flex h-8 w-8 items-center justify-center border border-border hover:border-primary/30 hover:text-primary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5">
              {/* Validation errors */}
              {errors.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="border border-red-500/30 bg-red-500/5 p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Validation Errors</span>
                  </div>
                  <ul className="space-y-0.5">
                    {errors.map((err, i) => (
                      <li key={i} className="text-[11px] text-red-300 font-mono">• {err}</li>
                    ))}
                  </ul>
                </motion.div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Title *</label>
                  <Input
                    placeholder="Ad campaign name"
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    className={`h-11 rounded-none ${!editing.title?.trim() && errors.length ? "border-red-500/50" : ""}`}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Target URL
                    {editing.target_url && (
                      isValidUrl(editing.target_url)
                        ? <CheckCircle2 className="inline h-3 w-3 ml-1 text-emerald-400" />
                        : <AlertTriangle className="inline h-3 w-3 ml-1 text-red-400" />
                    )}
                  </label>
                  <Input
                    placeholder="https://sponsor-website.com"
                    value={editing.target_url}
                    onChange={(e) => setEditing({ ...editing, target_url: e.target.value })}
                    className={`h-11 rounded-none ${editing.target_url && !isValidUrl(editing.target_url) ? "border-red-500/50" : ""}`}
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Sponsor</label>
                <div className="relative">
                  <select
                    value={editing.sponsor_id}
                    onChange={(e) => setEditing({ ...editing, sponsor_id: e.target.value })}
                    className="h-11 w-full appearance-none border border-border bg-background px-3 pr-8 text-sm font-mono rounded-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    <option value="">No sponsor</option>
                    {sponsors.map((s) => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <ImageField
                label="Ad Creative *"
                value={editing.image_url}
                onChange={(url) => setEditing({ ...editing, image_url: url })}
              />

              {/* Live preview */}
              {editing.image_url && (
                <div className="border border-border/40 bg-black/20 p-3">
                  <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60 mb-2">Preview</p>
                  <div className="mx-auto overflow-hidden border border-border/20" style={{ maxWidth: 400 }}>
                    <img
                      src={editing.image_url}
                      alt="Preview"
                      className="w-full object-contain"
                      style={{ maxHeight: 200 }}
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  </div>
                </div>
              )}

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
                        <option key={p.key} value={p.key}>{p.label} — {p.desc}</option>
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

              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Monthly Rate (AUD)</label>
                  <Input type="number" min="0" step="0.01" placeholder="0.00" value={editing.price_per_month || ''} onChange={(e) => setEditing({ ...editing, price_per_month: parseFloat(e.target.value) || 0 })} className="h-11 rounded-none font-mono" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">CPM Rate (AUD)</label>
                  <Input type="number" min="0" step="0.01" placeholder="0.00" value={editing.cpm_rate || ''} onChange={(e) => setEditing({ ...editing, cpm_rate: parseFloat(e.target.value) || 0 })} className="h-11 rounded-none font-mono" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Device Target</label>
                  <div className="relative">
                    <select value={editing.device_target || 'all'} onChange={(e) => setEditing({ ...editing, device_target: e.target.value })} className="h-11 w-full appearance-none border border-border bg-background px-3 pr-8 text-sm font-mono rounded-none focus:outline-none focus:ring-1 focus:ring-primary/40">
                      <option value="all">All Devices</option>
                      <option value="desktop">Desktop Only</option>
                      <option value="mobile">Mobile Only</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <Calendar className="inline h-3 w-3 mr-1" />Start Date
                    <span className="text-muted-foreground/50 ml-1">(optional)</span>
                  </label>
                  <Input
                    type="date"
                    value={editing.start_date}
                    onChange={(e) => setEditing({ ...editing, start_date: e.target.value })}
                    className="h-11 rounded-none font-mono"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <Calendar className="inline h-3 w-3 mr-1" />End Date
                    <span className="text-muted-foreground/50 ml-1">(optional)</span>
                  </label>
                  <Input
                    type="date"
                    value={editing.end_date}
                    onChange={(e) => setEditing({ ...editing, end_date: e.target.value })}
                    className={`h-11 rounded-none font-mono ${editing.start_date && editing.end_date && editing.start_date > editing.end_date ? "border-red-500/50" : ""}`}
                  />
                  {editing.start_date && editing.end_date && editing.start_date > editing.end_date && (
                    <p className="text-[9px] text-red-400">End date must be after start date</p>
                  )}
                </div>
              </div>

              {/* ── A/B Testing Variants ── */}
              <div className="border border-border/40 bg-muted/5 p-4">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('ab-variants-section');
                    if (el) el.classList.toggle('hidden');
                  }}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">A/B Testing (Optional)</span>
                  {(editing.ab_variants?.length > 0) && (
                    <span className="text-[8px] font-mono text-primary ml-1">{editing.ab_variants.length} variant{editing.ab_variants.length > 1 ? 's' : ''}</span>
                  )}
                </button>
                <div id="ab-variants-section" className={editing.ab_variants?.length > 0 ? '' : 'hidden'}>
                  <div className="mt-3 grid gap-3">
                    {(editing.ab_variants || []).map((variant, idx) => (
                      <div key={variant.id} className="flex items-start gap-3 border border-border/30 bg-background/50 p-3">
                        <div className="shrink-0 w-20 h-14 border border-border/30 bg-muted/10 overflow-hidden flex items-center justify-center">
                          {variant.image_url ? (
                            <img src={variant.image_url} alt={`Variant ${idx + 1}`} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                          )}
                        </div>
                        <div className="flex-1 grid gap-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Variant {String.fromCharCode(65 + idx)} Image URL</label>
                          <Input
                            placeholder="https://cdn.example.com/variant.jpg"
                            value={variant.image_url}
                            onChange={(e) => {
                              const updated = [...(editing.ab_variants || [])];
                              updated[idx] = { ...updated[idx], image_url: e.target.value };
                              setEditing({ ...editing, ab_variants: updated });
                            }}
                            className="h-9 rounded-none font-mono text-xs"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-none h-8 w-8 p-0 text-red-400 hover:text-red-300 shrink-0 mt-5"
                          onClick={() => {
                            const updated = (editing.ab_variants || []).filter((_, i) => i !== idx);
                            setEditing({ ...editing, ab_variants: updated });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    {(editing.ab_variants?.length || 0) < 2 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-none text-[10px] uppercase tracking-wider border-dashed border-primary/20 text-primary hover:bg-primary/5 w-fit"
                        onClick={() => {
                          const newVariant = { id: crypto.randomUUID(), image_url: '', impressions: 0, clicks: 0 };
                          setEditing({ ...editing, ab_variants: [...(editing.ab_variants || []), newVariant] });
                        }}
                      >
                        <Plus className="mr-1.5 h-3 w-3" /> Add Variant
                      </Button>
                    )}
                  </div>
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

                {editing.target_url && isValidUrl(editing.target_url) && (
                  <a
                    href={editing.target_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-mono text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Preview link
                  </a>
                )}

                <div className="ml-auto flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-none text-xs uppercase tracking-wider"
                    onClick={() => { setEditing(null); setView("slots"); setErrors([]); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="rounded-none bg-primary hover:bg-primary/90 text-xs uppercase tracking-wider font-bold"
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
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {[
                { label: "Total Impressions", value: analytics.totalImpressions.toLocaleString(), icon: Eye, color: "text-primary" },
                { label: "Total Clicks", value: analytics.totalClicks.toLocaleString(), icon: MousePointerClick, color: "text-accent" },
                { label: "Click-Through Rate", value: `${analytics.ctr}%`, icon: BarChart3, color: "text-emerald-400" },
                { label: "Active Ads", value: `${activeCount}`, icon: Megaphone, color: "text-amber-400" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="border border-border bg-card/60 cmd-glass p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground font-mono">
                      {label}
                    </span>
                  </div>
                  <p className={`font-display text-3xl uppercase tracking-wide ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Per-position breakdown */}
            <div className="border border-border bg-card/60 cmd-glass p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground font-mono">
                  Per-Position Breakdown
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-none text-[9px] uppercase tracking-wider text-muted-foreground h-7"
                  onClick={clearAllStats}
                >
                  <RefreshCw className="mr-1 h-3 w-3" /> Reset Stats
                </Button>
              </div>

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

      {/* ── Delete Confirmation Dialog ── */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="border border-border bg-card cmd-glass p-6 max-w-sm mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/10 border border-red-500/20">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h4 className="font-display text-lg uppercase">Delete Ad?</h4>
                  <p className="text-[11px] text-muted-foreground">This action cannot be undone. All analytics data for this ad will be preserved.</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" className="rounded-none text-xs uppercase tracking-wider" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" className="rounded-none text-xs uppercase tracking-wider" onClick={() => deleteAd(deleteConfirm)}>
                  <Trash2 className="mr-2 h-3 w-3" /> Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
