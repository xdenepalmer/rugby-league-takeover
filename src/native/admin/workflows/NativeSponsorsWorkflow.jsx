import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Building2,
  Plus,
  X,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Star,
  Mail,
  Phone,
  Globe,
  Copy,
  ExternalLink,
  Calendar,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import AdminConfirmSheet from "@/components/admin/shared/AdminConfirmSheet";
import MobileActionDrawer from "@/components/admin/MobileActionDrawer";
import PullToRefresh from "@/components/PullToRefresh";
import { emitHaptic } from "@/lib/native/haptic-events";
import { useWindowedList } from "@/hooks/use-windowed-list";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  LS_KEY,
  SORT_OPTIONS,
  TIER_LABELS,
  TIER_OPTIONS,
  emptySponsor,
  validateSponsor,
  canSaveSponsor,
  toSpendField,
  upsertSponsor,
  removeSponsor,
  toggleActiveInList,
  isExistingSponsor,
  getContractStatus,
  getInitials,
  formatDate,
  activeAdCount,
  visibleSponsors,
  sponsorStats,
} from "./sponsors-helpers.js";

/**
 * Native sponsors workflow — list at /admin/ads/sponsors, editor at
 * /admin/ads/sponsors/:sponsorId. Sponsors are a localStorage-only module
 * (the web SponsorManager has NO entity and NO edge function): it holds the
 * array in React state and persists the WHOLE array to localStorage under
 * "rlt_sponsors" on every change. This workflow mirrors that store exactly —
 * every write lands the same record shapes in the same localStorage key the
 * web reads, so both surfaces share the one source of truth.
 *
 * localStorage isn't reactive, so we layer a native-only React Query cache
 * (["sponsors"]) whose queryFn reads localStorage; mutations write localStorage
 * then invalidate the key (and PullToRefresh re-reads it). No web query key
 * exists to reuse — sponsors were never wired through React Query — so this key
 * is introduced native-side purely as a cache over the localStorage truth.
 *
 * Audit parity: the web SponsorManager dispatches NO admin audit-log events,
 * so this workflow emits none either (same empty event set).
 */

const SPONSORS_KEY = ["sponsors"];
const AD_CONFIG_KEY = "rlt_ad_config";

function readLS(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeSponsors(next) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* noop — same swallow the web writeLS uses */
  }
}

const useSponsors = () =>
  useQuery({
    queryKey: SPONSORS_KEY,
    // Source of truth is localStorage "rlt_sponsors", read fresh on each fetch.
    queryFn: () => readLS(LS_KEY, []),
    staleTime: 0,
  });

/**
 * Shared mutations. Each reads the freshest localStorage array inside the
 * mutation (never a stale cache), applies the same pure transform the web
 * applies, writes the whole array back, then invalidates ["sponsors"].
 */
const useSponsorMutations = () => {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: SPONSORS_KEY });

  const saveMutation = useMutation({
    mutationFn: (sponsor) => {
      const next = upsertSponsor(readLS(LS_KEY, []), sponsor);
      writeSponsors(next);
      return Promise.resolve(sponsor);
    },
    onSuccess: (sponsor) => {
      emitHaptic("save.success");
      refresh();
      // Web parity: SponsorManager toasts the company name on save.
      toast({ title: "Sponsor saved", description: `"${sponsor.company_name}" has been saved.` });
    },
    onError: () => {
      emitHaptic("mutation.error");
      toast({ title: "Failed to save sponsor", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => {
      writeSponsors(removeSponsor(readLS(LS_KEY, []), id));
      return Promise.resolve(id);
    },
    onSuccess: () => {
      emitHaptic("save.success");
      refresh();
      toast({ title: "Sponsor removed" });
    },
    onError: () => {
      emitHaptic("mutation.error");
      toast({ title: "Failed to remove sponsor", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => {
      writeSponsors(toggleActiveInList(readLS(LS_KEY, []), id));
      return Promise.resolve(id);
    },
    onSuccess: () => {
      refresh();
    },
    onError: () => {
      emitHaptic("mutation.error");
      toast({ title: "Failed to update sponsor", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  return { saveMutation, deleteMutation, toggleMutation };
};

/**
 * Touch-first logo control: URL paste, native file picker, always-visible
 * clear button (no hover-only affordances). Uploads through the EXACT client
 * call the web ImageField uses: base44.integrations.Core.UploadFile.
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
            <Building2 className="h-6 w-6 text-muted-foreground/40" aria-hidden="true" />
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

/** Shared editor fields — the same field set (and coercion) the web form writes. */
function SponsorFormFields({ draft, setField, idPrefix }) {
  const dateError = draft.contract_start && draft.contract_end && draft.contract_start > draft.contract_end;
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-company`}>
          Company name *
        </label>
        <Input
          id={`${idPrefix}-company`}
          placeholder="e.g. Telstra"
          value={draft.company_name || ""}
          onChange={(e) => setField("company_name", e.target.value)}
          className="h-11 rounded-none border-border bg-background"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-contact`}>
          Contact name
        </label>
        <Input
          id={`${idPrefix}-contact`}
          placeholder="Primary contact person"
          value={draft.contact_name || ""}
          onChange={(e) => setField("contact_name", e.target.value)}
          className="h-11 rounded-none border-border bg-background"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-email`}>
          Email
        </label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          inputMode="email"
          placeholder="contact@company.com"
          value={draft.contact_email || ""}
          onChange={(e) => setField("contact_email", e.target.value)}
          className="h-11 rounded-none border-border bg-background font-mono"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-phone`}>
          Phone
        </label>
        <Input
          id={`${idPrefix}-phone`}
          type="tel"
          inputMode="tel"
          placeholder="+61 4XX XXX XXX"
          value={draft.contact_phone || ""}
          onChange={(e) => setField("contact_phone", e.target.value)}
          className="h-11 rounded-none border-border bg-background font-mono"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-website`}>
          Website
        </label>
        <Input
          id={`${idPrefix}-website`}
          inputMode="url"
          placeholder="https://company.com.au"
          value={draft.website || ""}
          onChange={(e) => setField("website", e.target.value)}
          className="h-11 rounded-none border-border bg-background font-mono"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-color`}>
          Brand color
        </label>
        <div className="flex gap-2">
          <input
            id={`${idPrefix}-color`}
            type="color"
            value={draft.brand_color || "#f97316"}
            onChange={(e) => setField("brand_color", e.target.value)}
            aria-label="Brand color picker"
            className="h-11 w-14 shrink-0 cursor-pointer rounded-none border border-border bg-transparent"
          />
          <Input
            value={draft.brand_color || ""}
            onChange={(e) => setField("brand_color", e.target.value)}
            maxLength={7}
            aria-label="Brand color hex"
            className="h-11 flex-1 rounded-none border-border bg-background font-mono"
          />
        </div>
      </div>

      <NativeImageField label="Company logo" idPrefix={`${idPrefix}-logo`} value={draft.logo_url} onChange={(url) => setField("logo_url", url)} />

      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-tier`}>
          Sponsorship tier
        </label>
        <select
          id={`${idPrefix}-tier`}
          value={draft.tier || "standard"}
          onChange={(e) => setField("tier", e.target.value)}
          className="h-11 w-full rounded-none border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
        >
          {TIER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-spend`}>
          Total spend (AUD)
        </label>
        <Input
          id={`${idPrefix}-spend`}
          type="number"
          inputMode="decimal"
          min="0"
          step="100"
          placeholder="0"
          value={draft.total_spend ?? 0}
          onChange={(e) => setField("total_spend", toSpendField(e.target.value))}
          className="h-11 rounded-none border-border bg-background font-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-start`}>
            Contract start
          </label>
          <Input
            id={`${idPrefix}-start`}
            type="date"
            value={draft.contract_start || ""}
            onChange={(e) => setField("contract_start", e.target.value)}
            className="h-11 rounded-none border-border bg-background font-mono"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-end`}>
            Contract end
          </label>
          <Input
            id={`${idPrefix}-end`}
            type="date"
            value={draft.contract_end || ""}
            onChange={(e) => setField("contract_end", e.target.value)}
            className={`h-11 rounded-none border-border bg-background font-mono ${dateError ? "border-red-500/50" : ""}`}
          />
        </div>
      </div>
      {dateError && <p className="text-[10px] text-red-400">End date must be after start date</p>}

      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-notes`}>
          Internal notes
        </label>
        <Textarea
          id={`${idPrefix}-notes`}
          placeholder="Any internal notes about this sponsor…"
          value={draft.notes || ""}
          onChange={(e) => setField("notes", e.target.value)}
          className="min-h-24 resize-none rounded-none border-border bg-background text-sm font-mono"
        />
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

/** Inline validation-error panel, mirroring the web form's error block. */
function ValidationErrors({ errors }) {
  if (!errors.length) return null;
  return (
    <div className="grid gap-1 border border-red-500/30 bg-red-500/5 p-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Validation errors</span>
      </div>
      <ul className="grid gap-0.5">
        {errors.map((err) => (
          <li key={err} className="text-[11px] font-mono text-red-300">
            • {err}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Native searchable, sortable sponsor list — /admin/ads/sponsors */
export default function NativeSponsorsList() {
  const navigate = useNavigate();
  const { data: sponsors = [], isLoading } = useSponsors();
  const { saveMutation, toggleMutation } = useSponsorMutations();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("tier");
  const [createDraft, setCreateDraft] = useState(null); // null = drawer closed
  const [createErrors, setCreateErrors] = useState([]);

  const ads = useMemo(() => readLS(AD_CONFIG_KEY, []), []);
  const stats = useMemo(() => sponsorStats(sponsors), [sponsors]);
  const visible = useMemo(() => visibleSponsors(sponsors, { search, sortKey }), [sponsors, search, sortKey]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, { initial: 15, step: 15, restoreKey: "admin-sponsors" });

  const setCreateField = (field, value) => setCreateDraft((draft) => ({ ...draft, [field]: value }));

  const openCreate = () => {
    emitHaptic("action.primary");
    setCreateErrors([]);
    setCreateDraft(emptySponsor());
  };

  const submitCreate = async () => {
    const errors = validateSponsor(createDraft);
    if (errors.length) {
      setCreateErrors(errors);
      // Web parity: SponsorManager toasts the first validation error.
      toast({ title: "Validation Error", description: errors[0], variant: "destructive" });
      return;
    }
    if (saveMutation.isPending) return;
    emitHaptic("action.primary");
    try {
      await saveMutation.mutateAsync(createDraft);
      setCreateDraft(null);
      setCreateErrors([]);
    } catch {
      // onError already toasted; keep the drawer open so nothing is lost.
    }
  };

  const toggle = (event, id) => {
    event.stopPropagation();
    emitHaptic("action.primary");
    toggleMutation.mutate(id);
  };

  return (
    <div className="pb-8">
      <NativeTopBar
        title="Sponsors"
        fallback="/admin/ads"
        right={
          <button
            type="button"
            onClick={openCreate}
            aria-label="Add sponsor"
            className="ios-pressable flex h-11 min-w-11 items-center justify-center text-primary"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        }
      />
      <PullToRefresh queryKeys={[SPONSORS_KEY]}>
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 border border-border bg-card/50 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, contact"
              aria-label="Search sponsors"
              className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="ios-scroll flex gap-2 overflow-x-auto py-2">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                aria-pressed={sortKey === o.key}
                onClick={() => setSortKey(o.key)}
                className={`ios-pressable min-h-9 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                  sortKey === o.key ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <span className="border border-border/50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              {stats.total} total
            </span>
            {stats.active > 0 && (
              <span className="border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-300">
                {stats.active} active
              </span>
            )}
            {stats.premium > 0 && (
              <span className="border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-300">
                {stats.premium} premium
              </span>
            )}
            {stats.expiring > 0 && (
              <span className="border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-300">
                {stats.expiring} expiring
              </span>
            )}
          </div>
        </div>

        {isLoading && sponsors.length === 0 ? (
          <div className="space-y-2 px-4">
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState
              icon={Building2}
              title="No sponsors found"
              description={sponsors.length === 0 ? "Add your first brand partner with the + button." : "Try adjusting your search above."}
            />
          </div>
        ) : (
          <div>
            {windowed.map((sponsor) => {
              const status = getContractStatus(sponsor);
              const adCount = activeAdCount(ads, sponsor.id);
              const inactive = sponsor.is_active === false;
              return (
                <button
                  key={sponsor.id}
                  type="button"
                  onClick={() => {
                    emitHaptic("tab.select");
                    navigate(`/admin/ads/sponsors/${encodeURIComponent(sponsor.id)}`);
                  }}
                  className={`ios-pressable flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left ${inactive ? "opacity-60" : ""}`}
                >
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border"
                    style={{ borderColor: (sponsor.brand_color || "#f97316") + "40", backgroundColor: (sponsor.brand_color || "#f97316") + "10" }}
                  >
                    {sponsor.logo_url ? (
                      <img src={sponsor.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-display text-base font-bold" style={{ color: sponsor.brand_color || "#f97316" }}>
                        {getInitials(sponsor.company_name)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold">{sponsor.company_name || "Untitled Sponsor"}</p>
                      {sponsor.tier === "premium" && <Star className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-label="Premium" />}
                      {inactive && (
                        <span className="shrink-0 border border-border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{TIER_LABELS[sponsor.tier] || sponsor.tier}</span>
                      {status && (
                        <span className={`border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${status.tone}`}>{status.label}</span>
                      )}
                      {adCount > 0 && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300">
                          {adCount} active ad{adCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => toggle(e, sponsor.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") toggle(e, sponsor.id);
                    }}
                    aria-label={inactive ? "Activate sponsor" : "Deactivate sponsor"}
                    className="ios-pressable flex h-11 min-w-11 shrink-0 items-center justify-center border border-border"
                  >
                    {inactive ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    )}
                  </span>
                </button>
              );
            })}
            {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
          </div>
        )}
      </PullToRefresh>

      <MobileActionDrawer
        open={!!createDraft}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDraft(null);
            setCreateErrors([]);
          }
        }}
        title="New sponsor"
        description="Sponsor profiles are stored on this device's admin store."
      >
        {createDraft && (
          <div className="grid gap-4">
            <ValidationErrors errors={createErrors} />
            <SponsorFormFields draft={createDraft} setField={setCreateField} idPrefix="native-sponsor-create" />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => {
                  setCreateDraft(null);
                  setCreateErrors([]);
                }}
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
                {saveMutation.isPending ? "Saving…" : "Save sponsor"}
              </button>
            </div>
          </div>
        )}
      </MobileActionDrawer>
    </div>
  );
}

/** Native sponsor editor — /admin/ads/sponsors/:sponsorId */
export function NativeSponsorDetail() {
  const { sponsorId } = useParams();
  const navigate = useNavigate();
  const { data: sponsors = [], isLoading } = useSponsors();
  const sponsor = useMemo(() => sponsors.find((s) => String(s.id) === String(sponsorId)) || null, [sponsors, sponsorId]);
  const { saveMutation, deleteMutation } = useSponsorMutations();

  const [edits, setEdits] = useState({});
  const [errors, setErrors] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Web parity: the edit form is seeded from the full record and Save writes
  // the whole edited record back (not a sparse patch).
  const draft = { ...(sponsor || {}), ...edits };
  const setField = (field, value) => setEdits((prev) => ({ ...prev, [field]: value }));

  const save = async () => {
    const validationErrors = validateSponsor(draft);
    if (validationErrors.length) {
      setErrors(validationErrors);
      toast({ title: "Validation Error", description: validationErrors[0], variant: "destructive" });
      return;
    }
    setErrors([]);
    emitHaptic("action.primary");
    // Web parity: an existing record's Save stamps updated_at (upsertSponsor).
    await saveMutation.mutateAsync(draft);
  };

  const confirmDeleteSponsor = async () => {
    try {
      await deleteMutation.mutateAsync(sponsor.id);
      setConfirmDelete(false);
      navigate("/admin/ads/sponsors", { replace: true });
    } catch {
      // onError already toasted; the sheet stays open for retry.
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(draft.contact_email);
      toast({ title: "Email copied", description: draft.contact_email });
    } catch {
      toast({ title: "Couldn't copy", description: draft.contact_email, variant: "destructive" });
    }
  };

  if (!isLoading && !sponsor) {
    return (
      <div>
        <NativeTopBar title="Sponsor" fallback="/admin/ads/sponsors" />
        <div className="px-4 pt-6">
          <NativeEmptyState icon={Building2} title="Sponsor not found" description="It may have been removed on this device." />
        </div>
      </div>
    );
  }
  if (!sponsor) {
    return (
      <div>
        <NativeTopBar title="Sponsor" fallback="/admin/ads/sponsors" />
        <div className="space-y-2 px-4 pt-4">
          <NativeSkeleton className="h-24 w-full" />
          <NativeSkeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const status = getContractStatus(draft);
  const existing = isExistingSponsor(sponsors, draft.id);

  return (
    <div className="pb-10">
      <NativeTopBar title={sponsor.company_name || "Sponsor"} fallback="/admin/ads/sponsors" />
      <div className="space-y-4 px-4 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border border-border/60 bg-card/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-border/50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              {TIER_LABELS[draft.tier] || draft.tier}
            </span>
            {status && <span className={`border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${status.tone}`}>{status.label}</span>}
            {draft.is_active === false && (
              <span className="border border-border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Inactive</span>
            )}
          </div>
          {draft.total_spend > 0 && (
            <span className="flex items-center gap-1 text-sm font-black text-primary">
              <DollarSign className="h-3.5 w-3.5" aria-hidden="true" />
              {Number(draft.total_spend).toLocaleString("en-AU")}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {draft.contact_email && (
            <button
              type="button"
              onClick={copyEmail}
              className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy email
            </button>
          )}
          {draft.contact_email && (
            <a
              href={`mailto:${draft.contact_email}`}
              className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Email
            </a>
          )}
          {draft.contact_phone && (
            <a
              href={`tel:${draft.contact_phone}`}
              className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" /> Call
            </a>
          )}
          {draft.website && /^https?:\/\/.+/.test(draft.website) && (
            <a
              href={draft.website}
              target="_blank"
              rel="noopener noreferrer"
              className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest"
            >
              <Globe className="h-3.5 w-3.5" aria-hidden="true" /> Website <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
          {(draft.contract_start || draft.contract_end) && (
            <span className="flex min-h-10 items-center gap-1.5 border border-border/50 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" /> {formatDate(draft.contract_start)} → {formatDate(draft.contract_end)}
            </span>
          )}
        </div>

        <div className="border border-border/60 bg-card/50 p-3">
          <ValidationErrors errors={errors} />
          <div className={errors.length ? "pt-4" : ""}>
            <SponsorFormFields draft={draft} setField={setField} idPrefix="native-sponsor-edit" />
          </div>
        </div>

        <button
          type="button"
          disabled={saveMutation.isPending || !canSaveSponsor(draft)}
          onClick={save}
          className="ios-pressable flex min-h-12 w-full items-center justify-center bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
        >
          {saveMutation.isPending ? "Saving…" : existing ? "Save sponsor" : "Create sponsor"}
        </button>

        <button
          type="button"
          onClick={() => {
            emitHaptic("mutation.warning");
            setConfirmDelete(true);
          }}
          className="ios-pressable flex min-h-11 w-full items-center justify-center gap-1.5 border border-red-500/40 text-xs font-bold uppercase tracking-widest text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete sponsor
        </button>
      </div>

      <AdminConfirmSheet
        open={confirmDelete}
        variant="destructive"
        title="Delete this sponsor?"
        description={`This permanently removes ${sponsor.company_name || "this sponsor"} from the admin store. This can't be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={confirmDeleteSponsor}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
