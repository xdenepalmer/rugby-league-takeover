import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Megaphone,
  Plus,
  X,
  Upload,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Zap,
  Clock,
  BarChart3,
  MousePointerClick,
  LayoutTemplate,
  Link2,
  ExternalLink,
  Image as ImageIcon,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import AdminConfirmSheet from "@/components/admin/shared/AdminConfirmSheet";
import MobileActionDrawer from "@/components/admin/MobileActionDrawer";
import PullToRefresh from "@/components/PullToRefresh";
import { emitHaptic } from "@/lib/native/haptic-events";
import { useWindowedList } from "@/hooks/use-windowed-list";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  AD_POSITIONS,
  AD_SIZES,
  AD_DEVICE_TARGETS,
  emptyAd,
  sampleAd,
  isValidUrl,
  isScheduleActive,
  getStatusLabel,
  validateAd,
  toMoneyField,
  aggregateAnalytics,
  adCounts,
  buildDuplicatePayload,
  stripAdId,
  newAbVariant,
  filterAds,
} from "./ads-helpers.js";

/**
 * Native ad manager — a true native workflow (003G/003K pattern). List/hub at
 * /admin/ads/ads, creative editor at /admin/ads/creatives/:adId. Every write
 * sends the EXACT payloads the web AdsManager sends and hits the SAME entities:
 *   • SiteAd.create / SiteAd.update (id stripped) / SiteAd.delete
 *   • duplicate → SiteAd.create({ ...rest, title: `${title} (Copy)` })
 *   • toggle active → SiteAd.update(id, { is_active })
 *   • global toggle → SiteSettings.update(id, { ads_enabled }) or .create(...)
 * and invalidates the SAME query keys (["siteAds"], ["siteSettings"]) so the
 * cache stays shared with the wrapped web panel.
 *
 * Session ad metrics stay in localStorage `rlt_ad_stats` (read + reset), and
 * like the web AdsManager the counters live-refresh — a 10s poll plus
 * foreground/impression/click listeners — so open analytics stay current.
 * Sponsors read from `rlt_sponsors` (read only). The web AdsManager dispatches
 * no rlt_admin_log events for ads, so neither does this.
 */

const AD_STATS_KEY = "rlt_ad_stats";
const AD_SPONSORS_KEY = "rlt_sponsors";

function readLS(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // non-browser / storage disabled — noop, same as the web helper
  }
}

const useSiteAds = () =>
  useQuery({
    queryKey: ["siteAds"],
    queryFn: () => base44.entities.SiteAd.list("-created_date", 200),
    enabled: appParams.hasBase44Config,
    staleTime: 60000,
  });

const useSiteSettings = () =>
  useQuery({
    queryKey: ["siteSettings"],
    queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1),
    enabled: appParams.hasBase44Config,
    staleTime: 60000,
  });

function useAdMutations() {
  const queryClient = useQueryClient();
  const refreshAds = () => queryClient.invalidateQueries({ queryKey: ["siteAds"] });
  const refreshSettings = () => queryClient.invalidateQueries({ queryKey: ["siteSettings"] });

  // Web parity: on an existing record the id is stripped and the rest is the
  // update body; a new record is created with the whole draft.
  const saveMutation = useMutation({
    mutationFn: async (ad) => {
      if (ad.id) {
        const { id, payload } = stripAdId(ad);
        return base44.entities.SiteAd.update(id, payload);
      }
      return base44.entities.SiteAd.create(ad);
    },
    onSuccess: () => {
      emitHaptic("save.success");
      refreshAds();
    },
    onError: () => {
      emitHaptic("mutation.error");
      toast({ title: "Failed to save ad", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SiteAd.delete(id),
    onSuccess: () => {
      emitHaptic("save.success");
      refreshAds();
    },
    onError: () => {
      emitHaptic("mutation.error");
      toast({ title: "Failed to delete ad", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (ad) => base44.entities.SiteAd.create(buildDuplicatePayload(ad)),
    onSuccess: () => {
      emitHaptic("save.success");
      refreshAds();
      toast({ title: "Ad duplicated" });
    },
    onError: () => {
      emitHaptic("mutation.error");
      toast({ title: "Failed to duplicate ad", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.SiteAd.update(id, { is_active }),
    onSuccess: () => refreshAds(),
    onError: () => {
      emitHaptic("mutation.error");
      toast({ title: "Failed to update ad status", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  const toggleAdsMutation = useMutation({
    mutationFn: ({ id, enabled }) => {
      if (id) return base44.entities.SiteSettings.update(id, { ads_enabled: enabled });
      return base44.entities.SiteSettings.create({ ads_enabled: enabled });
    },
    onSuccess: () => refreshSettings(),
    onError: () => {
      emitHaptic("mutation.error");
      toast({ title: "Failed to update ad settings", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  return { saveMutation, deleteMutation, duplicateMutation, toggleActiveMutation, toggleAdsMutation };
}

/**
 * Touch-first ad-creative control: URL paste, native file picker, always-visible
 * clear (no hover-only affordances). Uploads through the EXACT client call the
 * web ImageField uses: base44.integrations.Core.UploadFile.
 */
function NativeImageField({ label, value, onChange, idPrefix }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
      emitHaptic("save.success");
    } catch (error) {
      emitHaptic("mutation.error");
      toast({ title: "Image upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-2">
      <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-url`}>
        {label}
      </label>
      <div className="flex items-start gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-border bg-card/50">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground/40" aria-hidden="true" />
          )}
        </div>
        <div className="grid min-w-0 flex-1 gap-2">
          <Input
            id={`${idPrefix}-url`}
            placeholder="Paste image URL"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 rounded-none border-border bg-background"
          />
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => upload(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="ios-pressable flex min-h-11 flex-1 items-center justify-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" /> {uploading ? "Uploading…" : "Upload"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                aria-label={`Remove ${label.toLowerCase()}`}
                className="ios-pressable flex min-h-11 min-w-11 items-center justify-center border border-red-500/40 text-red-400"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Styled native <select> matching the boxy field language. */
function SelectField({ id, label, value, onChange, options }) {
  return (
    <div className="grid gap-2">
      <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full appearance-none rounded-none border border-border bg-background px-3 pr-8 text-sm outline-none"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * Shared editor fields — the same field set (and coercion) the web AdsManager
 * form writes. `sponsors` comes from localStorage `rlt_sponsors` (read-only,
 * web parity).
 */
function AdFormFields({ draft, setField, idPrefix, sponsors }) {
  const variants = draft.ab_variants || [];
  const setVariant = (idx, patch) => {
    const next = [...variants];
    next[idx] = { ...next[idx], ...patch };
    setField("ab_variants", next);
  };
  const removeVariant = (idx) => setField("ab_variants", variants.filter((_, i) => i !== idx));
  const addVariant = () => setField("ab_variants", [...variants, newAbVariant()]);
  const dateInvalid = draft.start_date && draft.end_date && draft.start_date > draft.end_date;

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-title`}>
          Title *
        </label>
        <Input
          id={`${idPrefix}-title`}
          placeholder="Ad campaign name"
          value={draft.title || ""}
          onChange={(e) => setField("title", e.target.value)}
          className="h-11 rounded-none border-border bg-background"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-target`}>
          Target URL
        </label>
        <Input
          id={`${idPrefix}-target`}
          placeholder="https://sponsor-website.com"
          value={draft.target_url || ""}
          onChange={(e) => setField("target_url", e.target.value)}
          className={`h-11 rounded-none border-border bg-background ${draft.target_url && !isValidUrl(draft.target_url) ? "border-red-500/50" : ""}`}
        />
        {draft.target_url && !isValidUrl(draft.target_url) && (
          <p className="text-[10px] font-bold text-red-400">Target URL is not a valid URL</p>
        )}
        {draft.target_url && isValidUrl(draft.target_url) && (
          <a
            href={draft.target_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ios-pressable flex min-h-9 items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" /> Preview link
          </a>
        )}
      </div>

      {sponsors.length > 0 && (
        <SelectField
          id={`${idPrefix}-sponsor`}
          label="Sponsor"
          value={draft.sponsor_id || ""}
          onChange={(v) => setField("sponsor_id", v)}
          options={[{ value: "", label: "No sponsor" }, ...sponsors.map((s) => ({ value: s.id, label: s.company_name }))]}
        />
      )}

      <NativeImageField
        label="Ad Creative *"
        idPrefix={`${idPrefix}-creative`}
        value={draft.image_url}
        onChange={(url) => setField("image_url", url)}
      />

      {draft.image_url && (
        <div className="border border-border/40 bg-card/40 p-2">
          <p className="pb-1 text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground/70">Preview</p>
          <img
            src={draft.image_url}
            alt="Ad preview"
            className="max-h-40 w-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <SelectField
          id={`${idPrefix}-position`}
          label="Position"
          value={draft.position || "banner-top"}
          onChange={(v) => setField("position", v)}
          options={AD_POSITIONS.map((p) => ({ value: p.key, label: p.label }))}
        />
        <SelectField
          id={`${idPrefix}-size`}
          label="Size"
          value={draft.size || "leaderboard"}
          onChange={(v) => setField("size", v)}
          options={AD_SIZES.map((s) => ({ value: s.key, label: `${s.label} (${s.dim})` }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-ppm`}>
            Monthly Rate (AUD)
          </label>
          <Input
            id={`${idPrefix}-ppm`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={draft.price_per_month || ""}
            onChange={(e) => setField("price_per_month", toMoneyField(e.target.value))}
            className="h-11 rounded-none border-border bg-background font-mono"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-cpm`}>
            CPM Rate (AUD)
          </label>
          <Input
            id={`${idPrefix}-cpm`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={draft.cpm_rate || ""}
            onChange={(e) => setField("cpm_rate", toMoneyField(e.target.value))}
            className="h-11 rounded-none border-border bg-background font-mono"
          />
        </div>
      </div>

      <SelectField
        id={`${idPrefix}-device`}
        label="Device Target"
        value={draft.device_target || "all"}
        onChange={(v) => setField("device_target", v)}
        options={AD_DEVICE_TARGETS.map((d) => ({ value: d.key, label: d.label }))}
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <label className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-start`}>
            <Calendar className="h-3 w-3" aria-hidden="true" /> Start date
          </label>
          <Input
            id={`${idPrefix}-start`}
            type="date"
            value={draft.start_date || ""}
            onChange={(e) => setField("start_date", e.target.value)}
            className="h-11 rounded-none border-border bg-background font-mono"
          />
        </div>
        <div className="grid gap-2">
          <label className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-end`}>
            <Calendar className="h-3 w-3" aria-hidden="true" /> End date
          </label>
          <Input
            id={`${idPrefix}-end`}
            type="date"
            value={draft.end_date || ""}
            onChange={(e) => setField("end_date", e.target.value)}
            className={`h-11 rounded-none border-border bg-background font-mono ${dateInvalid ? "border-red-500/50" : ""}`}
          />
        </div>
      </div>
      {dateInvalid && <p className="text-[10px] font-bold text-red-400">End date must be after start date</p>}

      {/* A/B testing variants — same shape/limit (max 2) as the web editor. */}
      <div className="border border-border/40 bg-card/40 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">A/B Testing (optional)</p>
          {variants.length < 2 && (
            <button
              type="button"
              onClick={addVariant}
              className="ios-pressable flex min-h-9 items-center gap-1 px-2 text-[10px] font-bold uppercase tracking-widest text-primary"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add variant
            </button>
          )}
        </div>
        <div className="grid gap-2 pt-2">
          {variants.map((variant, idx) => (
            <div key={variant.id || idx} className="flex items-end gap-2">
              <div className="grid min-w-0 flex-1 gap-1.5">
                <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-variant-${idx}`}>
                  Variant {String.fromCharCode(65 + idx)} image URL
                </label>
                <Input
                  id={`${idPrefix}-variant-${idx}`}
                  placeholder="https://cdn.example.com/variant.jpg"
                  value={variant.image_url || ""}
                  onChange={(e) => setVariant(idx, { image_url: e.target.value })}
                  className="h-11 rounded-none border-border bg-background font-mono text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => removeVariant(idx)}
                aria-label={`Remove variant ${idx + 1}`}
                className="ios-pressable flex min-h-11 min-w-11 items-center justify-center border border-red-500/40 text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
          {variants.length === 0 && (
            <p className="text-[10px] italic text-muted-foreground">No variants — the base creative is served to everyone.</p>
          )}
        </div>
      </div>

      <label className="flex min-h-11 items-center justify-between border border-border bg-card/50 px-3 py-2">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {draft.is_active !== false ? (
            <Eye className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          ) : (
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" />
          )}
          Active
        </span>
        <Switch checked={draft.is_active !== false} onCheckedChange={(v) => setField("is_active", v)} />
      </label>
    </div>
  );
}

/** Read the sponsor directory (localStorage rlt_sponsors) — read-only, web parity. */
function useSponsors() {
  return useMemo(() => readLS(AD_SPONSORS_KEY, []), []);
}

/** Save/validate a draft (create path). Mirrors AdsManager.saveAd exactly. */
function useSubmitAd(saveMutation) {
  return async (draft, { onDone } = {}) => {
    const errors = validateAd(draft);
    if (errors.length > 0) {
      emitHaptic("mutation.error");
      toast({ title: "Validation Error", description: errors[0], variant: "destructive" });
      return false;
    }
    emitHaptic("action.primary");
    try {
      await saveMutation.mutateAsync(draft);
      toast({ title: "Ad saved", description: `"${draft.title}" has been saved successfully.` });
      onDone?.();
      return true;
    } catch {
      // onError already toasted; keep the form open so nothing is lost.
      return false;
    }
  };
}

function StatusBadge({ ad }) {
  const status = getStatusLabel(ad);
  return (
    <span className={`shrink-0 border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${status.tone}`}>
      {status.label}
    </span>
  );
}

/** ── LIST / HUB SCREEN (default export, self-chromed) ────────────────────── */
export default function NativeAdsWorkflow() {
  const navigate = useNavigate();
  const sponsors = useSponsors();
  const { data: ads = [], isLoading } = useSiteAds();
  const { data: settingsRecords = [] } = useSiteSettings();
  const settings = settingsRecords[0] || {};
  const adsEnabled = settings.ads_enabled === true || settings.ads_enabled === "true";

  const { saveMutation, deleteMutation, duplicateMutation, toggleActiveMutation, toggleAdsMutation } = useAdMutations();
  const submitAd = useSubmitAd(saveMutation);

  const [view, setView] = useState("ads");
  const [query, setQuery] = useState("");
  const [createDraft, setCreateDraft] = useState(null); // null = drawer closed
  const [confirmDelete, setConfirmDelete] = useState(null); // ad id | null
  const [confirmResetStats, setConfirmResetStats] = useState(false);
  const [stats, setStats] = useState(() => readLS(AD_STATS_KEY, {}));

  // Live-refresh the analytics counters like the web AdsManager: a 10s poll
  // plus re-reads on foreground and on ad impression/click events.
  useEffect(() => {
    const refresh = () => setStats(readLS(AD_STATS_KEY, {}));
    const interval = setInterval(refresh, 10000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("rlt_ad_impression", refresh);
    window.addEventListener("rlt_ad_click", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener("rlt_ad_impression", refresh);
      window.removeEventListener("rlt_ad_click", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const counts = useMemo(() => adCounts(ads), [ads]);
  const analytics = useMemo(() => aggregateAnalytics(stats), [stats]);
  const maxImpressions = Math.max(1, ...Object.values(analytics.byPosition).map((v) => v.impressions));
  const visible = useMemo(() => filterAds(ads, query), [ads, query]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, { initial: 20, step: 20, restoreKey: "admin-ads" });

  const setCreateField = (field, value) => setCreateDraft((draft) => ({ ...draft, [field]: value }));

  const openCreate = (position) => {
    emitHaptic("action.primary");
    setCreateDraft(position ? { ...emptyAd(), position } : { ...emptyAd() });
  };

  const submitCreate = () =>
    submitAd(createDraft, { onDone: () => setCreateDraft(null) });

  const addSampleAd = async () => {
    emitHaptic("action.primary");
    try {
      await saveMutation.mutateAsync(sampleAd());
      toast({
        title: "Sample ad added",
        description: "A test ad is live in the Footer slot — view the site to confirm it renders, then delete it when done.",
      });
    } catch {
      // onError already toasted
    }
  };

  const toggleActive = (ad) => {
    emitHaptic("tab.select");
    toggleActiveMutation.mutate({ id: ad.id, is_active: !ad.is_active });
  };

  const confirmDeleteAd = async () => {
    try {
      await deleteMutation.mutateAsync(confirmDelete);
      setConfirmDelete(null);
      toast({ title: "Ad removed" });
    } catch {
      // onError already toasted; sheet stays open for retry
    }
  };

  const resetStats = () => {
    writeLS(AD_STATS_KEY, {});
    setStats({});
    setConfirmResetStats(false);
    emitHaptic("mutation.warning");
    toast({ title: "Analytics cleared" });
  };

  const tabs = [
    { key: "ads", label: "Ads", icon: Megaphone },
    { key: "slots", label: "Slots", icon: LayoutTemplate },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="pb-10">
      <NativeTopBar
        title="Ad Manager"
        fallback="/admin/ads"
        right={
          <button
            type="button"
            onClick={() => openCreate()}
            aria-label="New ad"
            className="ios-pressable flex h-11 min-w-11 items-center justify-center text-primary"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        }
      />

      <PullToRefresh queryKeys={[["siteAds"], ["siteSettings"]]}>
        {/* Global ad system toggle — SiteSettings.ads_enabled */}
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between gap-3 border border-border bg-card/50 p-3">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Global ad system</p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-bold uppercase tracking-widest">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Megaphone className="h-3 w-3" aria-hidden="true" /> {counts.total} total
                </span>
                <span className="flex items-center gap-1 text-emerald-300">
                  <Zap className="h-3 w-3" aria-hidden="true" /> {counts.active} live
                </span>
                {counts.scheduled > 0 && (
                  <span className="flex items-center gap-1 text-amber-300">
                    <Clock className="h-3 w-3" aria-hidden="true" /> {counts.scheduled} scheduled
                  </span>
                )}
              </div>
              <p className={`pt-1 text-[10px] font-black uppercase tracking-widest ${adsEnabled ? "text-emerald-300" : "text-muted-foreground"}`}>
                {adsEnabled ? "Ads live site-wide" : "Disabled site-wide"}
              </p>
            </div>
            <Switch
              checked={adsEnabled}
              disabled={toggleAdsMutation.isPending}
              onCheckedChange={(v) => {
                emitHaptic("action.primary");
                toggleAdsMutation.mutate({ id: settings.id, enabled: v });
              }}
            />
          </div>
        </div>

        {/* View tabs */}
        <div className="ios-scroll flex gap-2 overflow-x-auto px-4 py-2">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => {
                emitHaptic("tab.select");
                setView(key);
              }}
              className={`ios-pressable flex min-h-9 shrink-0 items-center gap-1.5 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                view === key ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {/* ── ADS LIST ── */}
        {view === "ads" && (
          <div>
            <div className="px-4 pb-2">
              <div className="flex items-center gap-2 border border-border bg-card/50 px-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title, position, URL"
                  aria-label="Search ads"
                  className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </div>
              <button
                type="button"
                onClick={addSampleAd}
                disabled={saveMutation.isPending}
                className="ios-pressable mt-2 flex min-h-9 items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add sample ad (test)
              </button>
            </div>

            {isLoading && ads.length === 0 ? (
              <div className="space-y-2 px-4">
                <NativeSkeleton className="h-20 w-full" />
                <NativeSkeleton className="h-20 w-full" />
                <NativeSkeleton className="h-20 w-full" />
              </div>
            ) : windowed.length === 0 ? (
              <div className="px-4 pt-4">
                <NativeEmptyState
                  icon={Megaphone}
                  title="No ads here"
                  description={ads.length === 0 ? "Create your first ad with the + button." : "Nothing matches this search."}
                />
              </div>
            ) : (
              <div>
                {windowed.map((ad) => {
                  const pos = AD_POSITIONS.find((p) => p.key === ad.position);
                  const adStats = stats[`${ad.position}__${ad.id}`] || { impressions: 0, clicks: 0 };
                  return (
                    <div
                      key={ad.id}
                      className={`flex items-center gap-3 border-b border-border/40 px-4 py-3 ${ad.is_active ? "" : "opacity-60"}`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          emitHaptic("tab.select");
                          navigate(`/admin/ads/creatives/${encodeURIComponent(ad.id)}`);
                        }}
                        className="ios-pressable flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden border border-border bg-card/50">
                          {ad.image_url ? (
                            <img src={ad.image_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground/40" aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-bold">{ad.title || "Untitled"}</p>
                            <StatusBadge ad={ad} />
                          </div>
                          <p className="truncate pt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                            {pos?.label || ad.position} · {adStats.impressions} imp · {adStats.clicks} clk
                          </p>
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleActive(ad)}
                          aria-label={ad.is_active ? "Pause ad" : "Activate ad"}
                          className="ios-pressable flex min-h-11 min-w-11 items-center justify-center border border-border"
                        >
                          {ad.is_active ? (
                            <Eye className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            emitHaptic("action.primary");
                            duplicateMutation.mutate(ad);
                          }}
                          aria-label="Duplicate ad"
                          className="ios-pressable flex min-h-11 min-w-11 items-center justify-center border border-border"
                        >
                          <Copy className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            emitHaptic("mutation.warning");
                            setConfirmDelete(ad.id);
                          }}
                          aria-label="Delete ad"
                          className="ios-pressable flex min-h-11 min-w-11 items-center justify-center border border-red-500/40 text-red-400"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
              </div>
            )}
          </div>
        )}

        {/* ── AD SLOTS ── */}
        {view === "slots" && (
          <div className="grid gap-3 px-4 pt-1">
            {AD_POSITIONS.map((pos) => {
              const assigned = ads.filter((a) => a.position === pos.key);
              const active = assigned.find((a) => a.is_active && isScheduleActive(a));
              const posStats = analytics.byPosition[pos.key] || { impressions: 0, clicks: 0 };
              return (
                <div key={pos.key} className="border border-border/60 bg-card/50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-bold uppercase tracking-wide">{pos.label}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{pos.desc}</p>
                    </div>
                    {active ? <StatusBadge ad={active} /> : (
                      <span className="shrink-0 border border-border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                        Empty
                      </span>
                    )}
                  </div>
                  <p className="pt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {assigned.length} ad{assigned.length === 1 ? "" : "s"} · {posStats.impressions} imp · {posStats.clicks} clk
                  </p>
                  {active ? (
                    <div className="grid gap-2 pt-2">
                      <div className="flex items-center gap-2">
                        <Eye className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                        <span className="truncate text-xs font-bold">{active.title || "Untitled"}</span>
                      </div>
                      {active.target_url && (
                        <div className="flex items-center gap-2">
                          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="truncate text-[10px] text-muted-foreground">{active.target_url}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          emitHaptic("tab.select");
                          navigate(`/admin/ads/creatives/${encodeURIComponent(active.id)}`);
                        }}
                        className="ios-pressable flex min-h-11 items-center justify-center border border-border text-[10px] font-bold uppercase tracking-widest"
                      >
                        Edit creative
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openCreate(pos.key)}
                      className="ios-pressable mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 border border-dashed border-primary/40 text-[10px] font-bold uppercase tracking-widest text-primary"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Assign ad
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {view === "analytics" && (
          <div className="grid gap-3 px-4 pt-1">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Impressions", value: analytics.totalImpressions.toLocaleString(), icon: Eye },
                { label: "Clicks", value: analytics.totalClicks.toLocaleString(), icon: MousePointerClick },
                { label: "CTR", value: `${analytics.ctr}%`, icon: BarChart3 },
                { label: "Active Ads", value: `${counts.active}`, icon: Megaphone },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="border border-border/60 bg-card/50 p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">{label}</span>
                  </div>
                  <p className="pt-1 font-display text-2xl font-bold text-primary">{value}</p>
                </div>
              ))}
            </div>

            <div className="border border-border/60 bg-card/50 p-3">
              <div className="flex items-center justify-between pb-2">
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Per-position</p>
                <button
                  type="button"
                  onClick={() => {
                    emitHaptic("mutation.warning");
                    setConfirmResetStats(true);
                  }}
                  className="ios-pressable flex min-h-9 items-center gap-1 px-1 text-[9px] font-bold uppercase tracking-widest text-red-400"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" /> Reset stats
                </button>
              </div>
              <div className="grid gap-2">
                {AD_POSITIONS.map((pos) => {
                  const data = analytics.byPosition[pos.key] || { impressions: 0, clicks: 0 };
                  const pct = maxImpressions > 0 ? (data.impressions / maxImpressions) * 100 : 0;
                  const positionCtr = data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(1) : "0.0";
                  return (
                    <div key={pos.key} className="grid gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest">{pos.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {data.impressions.toLocaleString()} imp · {data.clicks.toLocaleString()} clk · {positionCtr}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden border border-border/30 bg-muted/20">
                        <div className="h-full bg-primary/60" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {analytics.totalImpressions === 0 && (
                <p className="pt-3 text-center text-[10px] uppercase tracking-widest text-muted-foreground/60">No analytics data yet</p>
              )}
            </div>
          </div>
        )}
      </PullToRefresh>

      {/* Create drawer */}
      <MobileActionDrawer
        open={!!createDraft}
        onOpenChange={(open) => {
          if (!open) setCreateDraft(null);
        }}
        title="New ad"
        description="Goes live in its slot as soon as it's active and in schedule."
      >
        {createDraft && (
          <>
            <AdFormFields draft={createDraft} setField={setCreateField} idPrefix="native-ad-create" sponsors={sponsors} />
            <div className="grid grid-cols-2 gap-2 pt-4">
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => setCreateDraft(null)}
                className="ios-pressable flex min-h-11 items-center justify-center border border-border text-xs font-bold uppercase tracking-widest disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={submitCreate}
                className="ios-pressable flex min-h-11 items-center justify-center bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
              >
                {saveMutation.isPending ? "Saving…" : "Save ad"}
              </button>
            </div>
          </>
        )}
      </MobileActionDrawer>

      <AdminConfirmSheet
        open={!!confirmDelete}
        variant="destructive"
        title="Delete this ad?"
        description="This removes the ad. Analytics data for this ad is preserved."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={confirmDeleteAd}
        onCancel={() => setConfirmDelete(null)}
      />

      <AdminConfirmSheet
        open={confirmResetStats}
        variant="destructive"
        title="Reset all analytics?"
        description="Clears the local impression/click counters for every slot. This can't be undone."
        confirmLabel="Reset"
        onConfirm={resetStats}
        onCancel={() => setConfirmResetStats(false)}
      />
    </div>
  );
}

/** ── CREATIVE EDITOR (named export) — /admin/ads/creatives/:adId ─────────── */
export function NativeAdDetail() {
  const { adId } = useParams();
  const navigate = useNavigate();
  const sponsors = useSponsors();
  const { data: ads = [], isLoading } = useSiteAds();
  const ad = useMemo(() => ads.find((a) => String(a.id) === String(adId)) || null, [ads, adId]);
  const { saveMutation, deleteMutation, duplicateMutation } = useAdMutations();
  const submitAd = useSubmitAd(saveMutation);

  const [edits, setEdits] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Web parity: the edit form is seeded from the full record and Save sends the
  // whole edited record back through SiteAd.update (id stripped), not a patch.
  const draft = { ...(ad || {}), ...edits };
  const setField = (field, value) => setEdits((prev) => ({ ...prev, [field]: value }));

  const save = () => submitAd(draft);

  const confirmDeleteAd = async () => {
    try {
      await deleteMutation.mutateAsync(ad.id);
      setConfirmDelete(false);
      toast({ title: "Ad removed" });
      navigate("/admin/ads", { replace: true });
    } catch {
      // onError already toasted; sheet stays open for retry
    }
  };

  if (!isLoading && !ad) {
    return (
      <div>
        <NativeTopBar title="Ad" fallback="/admin/ads" />
        <div className="px-4 pt-6">
          <NativeEmptyState icon={Megaphone} title="Ad not found" description="It may have been removed, or you're offline." />
        </div>
      </div>
    );
  }
  if (!ad) {
    return (
      <div>
        <NativeTopBar title="Ad" fallback="/admin/ads" />
        <div className="space-y-2 px-4 pt-4">
          <NativeSkeleton className="h-24 w-full" />
          <NativeSkeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <NativeTopBar title={ad.title || "Ad"} fallback="/admin/ads" />
      <div className="space-y-4 px-4 pt-3">
        <div className="flex items-center justify-between border border-border/60 bg-card/50 p-3">
          <StatusBadge ad={draft} />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {AD_POSITIONS.find((p) => p.key === draft.position)?.label || draft.position}
          </span>
        </div>

        <div className="border border-border/60 bg-card/50 p-3">
          <AdFormFields draft={draft} setField={setField} idPrefix="native-ad-edit" sponsors={sponsors} />
        </div>

        <button
          type="button"
          disabled={saveMutation.isPending}
          onClick={save}
          className="ios-pressable flex min-h-12 w-full items-center justify-center bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
        >
          {saveMutation.isPending ? "Saving…" : "Save ad"}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={duplicateMutation.isPending}
            onClick={() => {
              emitHaptic("action.primary");
              duplicateMutation.mutate(ad);
            }}
            className="ios-pressable flex min-h-11 items-center justify-center gap-1.5 border border-border text-xs font-bold uppercase tracking-widest disabled:opacity-40"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Duplicate
          </button>
          <button
            type="button"
            onClick={() => {
              emitHaptic("mutation.warning");
              setConfirmDelete(true);
            }}
            className="ios-pressable flex min-h-11 items-center justify-center gap-1.5 border border-red-500/40 text-xs font-bold uppercase tracking-widest text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
          </button>
        </div>
      </div>

      <AdminConfirmSheet
        open={confirmDelete}
        variant="destructive"
        title="Delete this ad?"
        description="This removes the ad. Analytics data for this ad is preserved."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={confirmDeleteAd}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
