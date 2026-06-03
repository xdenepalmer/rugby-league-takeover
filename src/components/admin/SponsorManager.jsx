import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Plus, Trash2, Pencil, X, Save, Search,
  Star, Heart, ChevronDown, ChevronUp, Copy, ExternalLink,
  Calendar, AlertTriangle, CheckCircle2, Mail, Phone,
  Globe, StickyNote, DollarSign, Shield, Eye, EyeOff,
  ArrowUpDown, Users,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import ImageField from "./ImageField";

/* ── Constants ────────────────────────────────────────────── */
const LS_KEY = "rlt_sponsors";

const TIERS = {
  premium:   { label: "Premium",   icon: Star,  color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/30", glow: "shadow-[0_0_20px_rgba(245,158,11,0.12)]" },
  standard:  { label: "Standard",  icon: Shield, color: "text-primary",   bg: "bg-primary/10",    border: "border-primary/30",   glow: "" },
  community: { label: "Community", icon: Heart, color: "text-slate-400",  bg: "bg-slate-500/10",  border: "border-slate-500/30", glow: "" },
};

const SORT_OPTIONS = [
  { key: "name-asc",     label: "Name A–Z" },
  { key: "name-desc",    label: "Name Z–A" },
  { key: "tier",         label: "Tier (Premium first)" },
  { key: "created-desc", label: "Newest first" },
  { key: "created-asc",  label: "Oldest first" },
];

const emptySponsor = () => ({
  id: crypto.randomUUID(),
  company_name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  website: "",
  logo_url: "",
  brand_color: "#f97316",
  notes: "",
  tier: "standard",
  total_spend: 0,
  contract_start: "",
  contract_end: "",
  is_active: true,
  created_at: new Date().toISOString(),
});

/* ── Helpers ──────────────────────────────────────────────── */
function readLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

function getContractStatus(sponsor) {
  if (!sponsor.contract_start && !sponsor.contract_end) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (sponsor.contract_end) {
    const end = new Date(sponsor.contract_end);
    end.setHours(0, 0, 0, 0);
    if (end < today) return { label: "Expired", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", dot: "bg-red-500" };
    const daysLeft = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 30) return { label: `${daysLeft}d left`, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", dot: "bg-amber-400" };
  }
  if (sponsor.contract_start) {
    const start = new Date(sponsor.contract_start);
    start.setHours(0, 0, 0, 0);
    if (start > today) return { label: "Upcoming", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", dot: "bg-sky-400" };
  }
  return { label: "Active", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-500" };
}

function getInitials(name) {
  if (!name) return "??";
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try { return new Date(dateStr).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }); } catch { return dateStr; }
}

function getActiveAdCount(sponsorId) {
  try {
    const ads = JSON.parse(localStorage.getItem("rlt_ad_config")) || [];
    return ads.filter((a) => a.sponsor_id === sponsorId && a.is_active).length;
  } catch { return 0; }
}

const tierOrder = { premium: 0, standard: 1, community: 2 };

function sortSponsors(list, sortKey) {
  const copy = [...list];
  switch (sortKey) {
    case "name-asc":     return copy.sort((a, b) => (a.company_name || "").localeCompare(b.company_name || ""));
    case "name-desc":    return copy.sort((a, b) => (b.company_name || "").localeCompare(a.company_name || ""));
    case "tier":         return copy.sort((a, b) => (tierOrder[a.tier] ?? 1) - (tierOrder[b.tier] ?? 1));
    case "created-desc": return copy.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    case "created-asc":  return copy.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    default:             return copy;
  }
}

/* ── Validation ───────────────────────────────────────────── */
function validate(s) {
  const errors = [];
  if (!s.company_name?.trim()) errors.push("Company name is required");
  if (s.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.contact_email)) errors.push("Invalid email format");
  if (s.website && !/^https?:\/\/.+/.test(s.website)) errors.push("Website must start with http:// or https://");
  if (s.contract_start && s.contract_end && s.contract_start > s.contract_end) errors.push("Contract end must be after start");
  if (s.total_spend < 0) errors.push("Total spend cannot be negative");
  return errors;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Tier Badge                                                */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function TierBadge({ tier }) {
  const cfg = TIERS[tier] || TIERS.standard;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.2em] border ${cfg.border} ${cfg.bg} ${cfg.color}`}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Sponsor Card                                              */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function SponsorCard({ sponsor, index, onEdit, onDelete, onToggleActive }) {
  const [expanded, setExpanded] = useState(false);
  const [notesValue, setNotesValue] = useState(sponsor.notes || "");
  const tierCfg = TIERS[sponsor.tier] || TIERS.standard;
  const contractStatus = getContractStatus(sponsor);
  const adCount = getActiveAdCount(sponsor.id);
  const isPremium = sponsor.tier === "premium";

  const copyEmail = () => {
    navigator.clipboard.writeText(sponsor.contact_email);
    toast({ title: "Email copied", description: sponsor.contact_email });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.97 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: "easeOut" }}
      layout
      className={`group relative overflow-hidden border bg-card/60 cmd-glass transition-all duration-300 ${
        isPremium
          ? `${tierCfg.border} hover:border-amber-400/50 ${tierCfg.glow}`
          : sponsor.tier === "community"
            ? "border-slate-500/20 hover:border-slate-400/30"
            : "border-primary/20 hover:border-primary/30"
      } ${!sponsor.is_active ? "opacity-60" : ""}`}
    >
      {/* Accent bar */}
      <div className={`cmd-accent-bar h-[2px] w-full ${
        isPremium
          ? "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 bg-[length:200%_100%] animate-[cmd-data-stream_4s_linear_infinite]"
          : sponsor.tier === "community"
            ? "bg-gradient-to-r from-slate-500/40 via-slate-400/30 to-slate-500/40"
            : "bg-gradient-to-r from-primary/60 via-primary/40 to-primary/60"
      }`} />

      {/* Premium scan effect */}
      {isPremium && sponsor.is_active && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/25 to-transparent cmd-scan-line" />
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Logo / Initials */}
          <div
            className="shrink-0 h-14 w-14 flex items-center justify-center border overflow-hidden"
            style={{ borderColor: sponsor.brand_color + "40", backgroundColor: sponsor.brand_color + "10" }}
          >
            {sponsor.logo_url ? (
              <img src={sponsor.logo_url} alt={sponsor.company_name} className="h-full w-full object-cover" />
            ) : (
              <span className="font-display text-lg font-bold" style={{ color: sponsor.brand_color }}>
                {getInitials(sponsor.company_name)}
              </span>
            )}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-display text-base uppercase tracking-wide truncate">
                {sponsor.company_name || "Untitled Sponsor"}
              </h4>
              <TierBadge tier={sponsor.tier} />
              {!sponsor.is_active && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400 bg-muted/20 border border-border/40">
                  <EyeOff className="h-2.5 w-2.5" /> Inactive
                </span>
              )}
            </div>

            {/* Contact row */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              {sponsor.contact_name && (
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-300 font-mono">
                  <Users className="h-2.5 w-2.5" /> {sponsor.contact_name}
                </span>
              )}
              {sponsor.contact_email && (
                <button
                  onClick={copyEmail}
                  className="inline-flex items-center gap-1 text-[10px] text-slate-300 font-mono hover:text-primary transition-colors"
                  title="Copy email"
                >
                  <Mail className="h-2.5 w-2.5" /> {sponsor.contact_email}
                  <Copy className="h-2 w-2 opacity-0 group-hover:opacity-60 transition-opacity" />
                </button>
              )}
              {sponsor.contact_phone && (
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-300 font-mono">
                  <Phone className="h-2.5 w-2.5" /> {sponsor.contact_phone}
                </span>
              )}
            </div>

            {/* Status row */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {contractStatus && (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider border ${contractStatus.border} ${contractStatus.bg} ${contractStatus.color}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${contractStatus.dot}`} />
                  {contractStatus.label}
                </span>
              )}
              {(sponsor.contract_start || sponsor.contract_end) && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                  <Calendar className="h-2.5 w-2.5" />
                  {formatDate(sponsor.contract_start)} → {formatDate(sponsor.contract_end)}
                </span>
              )}
              {adCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                  {adCount} active ad{adCount !== 1 ? "s" : ""}
                </span>
              )}
              {sponsor.total_spend > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                  <DollarSign className="h-2.5 w-2.5" /> ${sponsor.total_spend.toLocaleString("en-AU")} AUD
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {sponsor.website && (
              <a
                href={sponsor.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center border border-border hover:border-primary/30 hover:text-primary transition-colors"
                title="Open website"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              onClick={() => onToggleActive(sponsor.id)}
              className="flex h-8 w-8 items-center justify-center border border-border hover:border-primary/30 hover:text-primary transition-colors"
              title={sponsor.is_active ? "Deactivate" : "Activate"}
            >
              {sponsor.is_active ? <Eye className="h-3.5 w-3.5 text-emerald-400" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
            <button
              onClick={() => onEdit(sponsor)}
              className="flex h-8 w-8 items-center justify-center border border-border hover:border-primary/30 hover:text-primary transition-colors"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex h-8 w-8 items-center justify-center border border-border hover:border-primary/30 hover:text-primary transition-colors"
              title={expanded ? "Collapse" : "Expand details"}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* ── Expanded detail view ── */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-border/30 grid gap-4 md:grid-cols-2">
                {/* Left: detail grid */}
                <div className="grid gap-3">
                  {[
                    { label: "Company",      value: sponsor.company_name },
                    { label: "Contact",      value: sponsor.contact_name },
                    { label: "Email",        value: sponsor.contact_email },
                    { label: "Phone",        value: sponsor.contact_phone },
                    { label: "Website",      value: sponsor.website },
                    { label: "Tier",         value: TIERS[sponsor.tier]?.label || sponsor.tier },
                    { label: "Total Spend",  value: `$${(sponsor.total_spend || 0).toLocaleString("en-AU")} AUD` },
                    { label: "Brand Color",  value: sponsor.brand_color },
                    { label: "Contract",     value: `${formatDate(sponsor.contract_start)} → ${formatDate(sponsor.contract_end)}` },
                    { label: "Created",      value: formatDate(sponsor.created_at) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-baseline gap-3">
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground w-24 shrink-0">{label}</span>
                      <span className="text-xs font-mono text-foreground truncate">
                        {label === "Brand Color" ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="h-3 w-3 border border-border" style={{ backgroundColor: value }} />
                            {value}
                          </span>
                        ) : value || "—"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Right: notes */}
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1">
                    <StickyNote className="h-3 w-3" /> Internal Notes
                  </label>
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    onBlur={() => {
                      if (notesValue !== sponsor.notes) {
                        const all = readLS(LS_KEY, []);
                        const idx = all.findIndex((s) => s.id === sponsor.id);
                        if (idx >= 0) { all[idx].notes = notesValue; writeLS(LS_KEY, all); }
                        toast({ title: "Notes saved" });
                      }
                    }}
                    placeholder="Add internal notes about this sponsor…"
                    className="min-h-[140px] w-full resize-y border border-border bg-background/40 p-3 text-sm font-mono rounded-none focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>

              {/* Delete zone */}
              <div className="mt-4 pt-3 border-t border-border/30 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-none text-xs uppercase tracking-wider border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  onClick={() => onDelete(sponsor.id)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete Sponsor
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Main: SponsorManager                                      */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function SponsorManager() {
  /* ── State ── */
  const [sponsors, setSponsors] = useState(() => readLS(LS_KEY, []));
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState("grid"); // "grid" | "form"
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("tier");
  const [errors, setErrors] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  /* Persist */
  useEffect(() => { writeLS(LS_KEY, sponsors); }, [sponsors]);

  /* ── CRUD ── */
  const saveSponsor = useCallback((sponsor) => {
    const validationErrors = validate(sponsor);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      toast({ title: "Validation Error", description: validationErrors[0], variant: "destructive" });
      return;
    }
    setErrors([]);
    setSponsors((prev) => {
      const idx = prev.findIndex((s) => s.id === sponsor.id);
      if (idx >= 0) { const copy = [...prev]; copy[idx] = { ...sponsor, updated_at: new Date().toISOString() }; return copy; }
      return [...prev, { ...sponsor, created_at: new Date().toISOString() }];
    });
    setEditing(null);
    setView("grid");
    toast({ title: "Sponsor saved", description: `"${sponsor.company_name}" has been saved.` });
  }, []);

  const deleteSponsor = useCallback((id) => {
    setSponsors((prev) => prev.filter((s) => s.id !== id));
    setDeleteConfirm(null);
    toast({ title: "Sponsor removed" });
  }, []);

  const toggleActive = useCallback((id) => {
    setSponsors((prev) => prev.map((s) => s.id === id ? { ...s, is_active: !s.is_active } : s));
  }, []);

  /* ── Filtered + sorted list ── */
  const visibleSponsors = useMemo(() => {
    const term = search.toLowerCase();
    const filtered = sponsors.filter((s) =>
      (s.company_name || "").toLowerCase().includes(term) ||
      (s.contact_name || "").toLowerCase().includes(term)
    );
    return sortSponsors(filtered, sortKey);
  }, [sponsors, search, sortKey]);

  /* Stats */
  const totalCount = sponsors.length;
  const activeCount = sponsors.filter((s) => s.is_active).length;
  const premiumCount = sponsors.filter((s) => s.tier === "premium").length;
  const expiringCount = sponsors.filter((s) => {
    const status = getContractStatus(s);
    return status && (status.label.includes("d left") || status.label === "Expired");
  }).length;

  /* ── Render ── */
  return (
    <section className="grid gap-5">
      {/* ──────────── HEADER ──────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden border border-border bg-card/60 cmd-glass"
      >
        <div className="cmd-accent-bar h-[2px] w-full bg-gradient-to-r from-primary/60 via-primary/40 to-primary/60" />
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 border border-primary/30 bg-primary/10">
              <Building2 className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-primary font-mono">
              Sponsor Management
            </p>
            {activeCount > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/5 border border-emerald-500/10">
                <span className="h-1 w-1 rounded-full bg-emerald-500 cmd-blink" />
                <span className="text-[7px] font-bold uppercase tracking-wider text-emerald-400">{activeCount} Active</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl md:text-4xl uppercase leading-none tracking-wide">Sponsors</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Manage advertiser and sponsor profiles. Track contracts, contact details, and tier status for all brand partners.
              </p>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted/20 border border-border/40 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                <Building2 className="h-3 w-3" /> {totalCount} Total
              </span>
              {premiumCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  <Star className="h-3 w-3" /> {premiumCount} Premium
                </span>
              )}
              {expiringCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  <AlertTriangle className="h-3 w-3" /> {expiringCount} Expiring
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ──────────── TOOLBAR: Search + Sort + New ──────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.35 }}
        className="flex flex-wrap items-center gap-3"
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10" />
          <Input
            placeholder="Search sponsors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-none pl-10 bg-card/60 border-border cmd-glass"
          />
        </div>

        {/* Sort */}
        <div className="relative">
          <ArrowUpDown className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="h-11 appearance-none border border-border bg-card/60 cmd-glass pl-9 pr-8 text-[11px] font-mono uppercase tracking-wider rounded-none focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* New sponsor */}
        <Button
          size="sm"
          onClick={() => { setEditing(emptySponsor()); setView("form"); setErrors([]); }}
          className="ml-auto rounded-none bg-primary hover:bg-primary/90 text-xs uppercase tracking-wider font-bold"
        >
          <Plus className="mr-2 h-4 w-4" /> New Sponsor
        </Button>
      </motion.div>

      {/* ──────────── VIEWS ──────────── */}
      <AnimatePresence mode="wait">

        {/* ── GRID VIEW ── */}
        {view === "grid" && (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {visibleSponsors.length === 0 ? (
              <div className="border border-border/60 bg-card/30 cmd-glass py-16 flex flex-col items-center justify-center text-center">
                <div className="p-4 border border-border/30 bg-muted/10 mb-4">
                  <Building2 className="h-8 w-8 text-slate-500" />
                </div>
                <p className="text-sm font-bold text-slate-200 mb-1">No sponsors found</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  {sponsors.length === 0
                    ? 'Click "New Sponsor" above to add your first brand partner.'
                    : "Try adjusting your search term above."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                <AnimatePresence>
                  {visibleSponsors.map((sponsor, i) => (
                    <SponsorCard
                      key={sponsor.id}
                      sponsor={sponsor}
                      index={i}
                      onEdit={(s) => { setEditing({ ...s }); setView("form"); setErrors([]); }}
                      onDelete={(id) => setDeleteConfirm(id)}
                      onToggleActive={toggleActive}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}

        {/* ── CREATE / EDIT FORM ── */}
        {view === "form" && editing && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="border border-border bg-card/60 cmd-glass"
          >
            <div className="cmd-accent-bar h-[2px] w-full bg-gradient-to-r from-primary/60 via-primary/40 to-primary/60" />

            <div className="flex items-center justify-between border-b border-border p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] font-mono text-muted-foreground">
                {sponsors.find((s) => s.id === editing.id) ? "Edit Sponsor" : "New Sponsor"}
              </p>
              <button
                onClick={() => { setEditing(null); setView("grid"); setErrors([]); }}
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

              {/* Row 1: Company + Contact Name */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Company Name *</label>
                  <Input
                    placeholder="e.g. Telstra"
                    value={editing.company_name}
                    onChange={(e) => setEditing({ ...editing, company_name: e.target.value })}
                    className={`h-11 rounded-none ${!editing.company_name?.trim() && errors.length ? "border-red-500/50" : ""}`}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Contact Name</label>
                  <Input
                    placeholder="Primary contact person"
                    value={editing.contact_name}
                    onChange={(e) => setEditing({ ...editing, contact_name: e.target.value })}
                    className="h-11 rounded-none"
                  />
                </div>
              </div>

              {/* Row 2: Email + Phone */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <Mail className="inline h-3 w-3 mr-1" /> Email
                  </label>
                  <Input
                    type="email"
                    placeholder="contact@company.com"
                    value={editing.contact_email}
                    onChange={(e) => setEditing({ ...editing, contact_email: e.target.value })}
                    className={`h-11 rounded-none font-mono ${editing.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.contact_email) ? "border-red-500/50" : ""}`}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <Phone className="inline h-3 w-3 mr-1" /> Phone
                  </label>
                  <Input
                    type="tel"
                    placeholder="+61 4XX XXX XXX"
                    value={editing.contact_phone}
                    onChange={(e) => setEditing({ ...editing, contact_phone: e.target.value })}
                    className="h-11 rounded-none font-mono"
                  />
                </div>
              </div>

              {/* Row 3: Website + Brand Color */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <Globe className="inline h-3 w-3 mr-1" /> Website
                  </label>
                  <Input
                    placeholder="https://company.com.au"
                    value={editing.website}
                    onChange={(e) => setEditing({ ...editing, website: e.target.value })}
                    className={`h-11 rounded-none font-mono ${editing.website && !/^https?:\/\/.+/.test(editing.website) ? "border-red-500/50" : ""}`}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Brand Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={editing.brand_color}
                      onChange={(e) => setEditing({ ...editing, brand_color: e.target.value })}
                      className="h-11 w-14 border border-border bg-transparent cursor-pointer rounded-none"
                    />
                    <Input
                      value={editing.brand_color}
                      onChange={(e) => setEditing({ ...editing, brand_color: e.target.value })}
                      className="h-11 rounded-none font-mono flex-1"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>

              {/* Logo */}
              <ImageField
                label="Company Logo"
                value={editing.logo_url}
                onChange={(url) => setEditing({ ...editing, logo_url: url })}
              />

              {/* Row 4: Tier + Total Spend */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Sponsorship Tier</label>
                  <div className="relative">
                    <select
                      value={editing.tier}
                      onChange={(e) => setEditing({ ...editing, tier: e.target.value })}
                      className="h-11 w-full appearance-none border border-border bg-background px-3 pr-8 text-sm font-mono rounded-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                    >
                      <option value="premium">⭐ Premium</option>
                      <option value="standard">Standard</option>
                      <option value="community">💙 Community</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <DollarSign className="inline h-3 w-3 mr-1" /> Total Spend (AUD)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="0"
                    value={editing.total_spend}
                    onChange={(e) => setEditing({ ...editing, total_spend: parseFloat(e.target.value) || 0 })}
                    className="h-11 rounded-none font-mono"
                  />
                </div>
              </div>

              {/* Row 5: Contract dates */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <Calendar className="inline h-3 w-3 mr-1" /> Contract Start
                  </label>
                  <Input
                    type="date"
                    value={editing.contract_start}
                    onChange={(e) => setEditing({ ...editing, contract_start: e.target.value })}
                    className="h-11 rounded-none font-mono"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <Calendar className="inline h-3 w-3 mr-1" /> Contract End
                  </label>
                  <Input
                    type="date"
                    value={editing.contract_end}
                    onChange={(e) => setEditing({ ...editing, contract_end: e.target.value })}
                    className={`h-11 rounded-none font-mono ${editing.contract_start && editing.contract_end && editing.contract_start > editing.contract_end ? "border-red-500/50" : ""}`}
                  />
                  {editing.contract_start && editing.contract_end && editing.contract_start > editing.contract_end && (
                    <p className="text-[9px] text-red-400">End date must be after start date</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="grid gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  <StickyNote className="inline h-3 w-3 mr-1" /> Internal Notes
                </label>
                <textarea
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  placeholder="Any internal notes about this sponsor…"
                  rows={4}
                  className="w-full resize-y border border-border bg-background px-3 py-2.5 text-sm font-mono rounded-none focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
                />
              </div>

              {/* Footer: Active toggle + save */}
              <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4">
                <label className="flex items-center gap-2 text-sm">
                  Active
                  <Switch
                    checked={editing.is_active !== false}
                    onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                  />
                </label>

                {editing.website && /^https?:\/\/.+/.test(editing.website) && (
                  <a
                    href={editing.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-mono text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Preview website
                  </a>
                )}

                <div className="ml-auto flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-none text-xs uppercase tracking-wider"
                    onClick={() => { setEditing(null); setView("grid"); setErrors([]); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="rounded-none bg-primary hover:bg-primary/90 text-xs uppercase tracking-wider font-bold"
                    onClick={() => saveSponsor(editing)}
                  >
                    <Save className="mr-2 h-4 w-4" /> Save Sponsor
                  </Button>
                </div>
              </div>
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
              transition={{ duration: 0.2 }}
              className="border border-border bg-card cmd-glass p-6 max-w-sm mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 border border-red-500/30 bg-red-500/10">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                </div>
                <h3 className="font-display text-lg uppercase tracking-wide">Delete Sponsor</h3>
              </div>
              <p className="text-sm text-slate-300 mb-1">
                Are you sure you want to delete <strong className="text-foreground">{sponsors.find((s) => s.id === deleteConfirm)?.company_name || "this sponsor"}</strong>?
              </p>
              <p className="text-[10px] text-muted-foreground mb-5">This action cannot be undone.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" className="rounded-none text-xs uppercase tracking-wider" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="rounded-none bg-red-500 hover:bg-red-600 text-white text-xs uppercase tracking-wider font-bold"
                  onClick={() => deleteSponsor(deleteConfirm)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
