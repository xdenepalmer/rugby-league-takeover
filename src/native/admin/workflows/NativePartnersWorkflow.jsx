import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Handshake, Plus, Trash2, EyeOff, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import AdminConfirmSheet from "@/components/admin/shared/AdminConfirmSheet";
import MobileActionDrawer from "@/components/admin/MobileActionDrawer";
import MediaUploader from "@/components/admin/MediaUploader";
import PullToRefresh from "@/components/PullToRefresh";
import { openSystemUrl } from "@/lib/native/open-external";
import { emitHaptic } from "@/lib/native/haptic-events";
import { useWindowedList } from "@/hooks/use-windowed-list";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  emptyPartnerDraft,
  canCreatePartner,
  sortPartners,
  buildPartnerCreatePayload,
  buildPartnerUpdatePayload,
  hasPartnerChanges,
} from "./partners-helpers.js";

// Same query the web admin panels (and the wrapped PartnersModule) run —
// shared ["partners"] cache key, so both surfaces stay in sync.
const usePartners = () =>
  useQuery({
    queryKey: ["partners"],
    queryFn: () => base44.entities.Partner.list("sort_order", 200),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

const usePartnerUpdate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities.Partner.update(id, data),
    onSuccess: () => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast({ title: "Partner saved" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Could not save partner", description: error.message, variant: "destructive" });
    },
  });
};

const usePartnerDelete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => base44.entities.Partner.delete(id),
    onSuccess: () => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast({ title: "Partner removed" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Could not delete partner", description: error.message, variant: "destructive" });
    },
  });
};

/** Logo thumbnail — object-contain so wide/odd logos aren't cropped. */
function PartnerLogo({ partner, className = "" }) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden border border-border bg-muted/20 ${className}`}>
      {partner?.logo_url ? (
        <img src={partner.logo_url} alt="" className="h-full w-full object-contain p-1" />
      ) : (
        <Handshake className="h-5 w-5 stroke-1 text-muted-foreground/40" aria-hidden="true" />
      )}
    </div>
  );
}

/** Logo input — the SAME upload client call the web ImageField makes
 *  (base44.integrations.Core.UploadFile via MediaUploader) plus URL paste. */
function LogoField({ value, onChange }) {
  return (
    <div className="grid gap-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Logo</p>
      <MediaUploader label="Upload logo" accept="image/*" onUploaded={onChange} />
      {value && (
        <div className="flex items-center gap-2">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted/20">
            <img src={value} alt="Logo preview" className="h-full w-full object-contain p-0.5" />
          </div>
          <p className="min-w-0 flex-1 truncate font-mono text-[10px] text-emerald-400">{value.split("/").pop()}</p>
          <button
            type="button"
            aria-label="Remove logo"
            onClick={() => onChange("")}
            className="ios-pressable flex h-11 w-11 shrink-0 items-center justify-center border border-border text-muted-foreground"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <Input
        placeholder="Or paste a logo image URL"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Logo URL"
        className="h-11 rounded-none border-border bg-background font-mono text-xs"
      />
    </div>
  );
}

/**
 * Native Partners & Venues workflow — /admin/content/partners. Every write
 * sends the exact payloads the web PartnersManager sends (Partner.create /
 * Partner.update / Partner.delete) and invalidates the same ["partners"]
 * key; server RLS stays the authority. Logos upload through the same
 * base44.integrations.Core.UploadFile call the web ImageField uses.
 */
export default function NativePartnersList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: partners = [], isLoading } = usePartners();
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(() => emptyPartnerDraft());

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Partner.create(data),
    onSuccess: () => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast({ title: "Partner added" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Could not add partner", description: error.message, variant: "destructive" });
    },
  });

  // Web ordering: numeric sort_order ascending.
  const sorted = useMemo(() => sortPartners(partners), [partners]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(sorted, {
    initial: 15,
    step: 15,
    restoreKey: "admin-partners",
  });

  const openAdd = () => {
    emitHaptic("action.primary");
    setDraft(emptyPartnerDraft());
    setAddOpen(true);
  };

  // The add drawer awaits settlement so it only closes on a real save.
  const submitCreate = async () => {
    if (!canCreatePartner(draft) || createMutation.isPending) return;
    emitHaptic("action.primary");
    try {
      await createMutation.mutateAsync(buildPartnerCreatePayload(draft));
      setDraft(emptyPartnerDraft());
      setAddOpen(false);
    } catch {
      // onError already surfaced the failure; keep the drawer open.
    }
  };

  return (
    <div className="pb-8">
      <NativeTopBar
        title="Partners"
        fallback="/admin/content"
        right={
          <button type="button" onClick={openAdd} aria-label="Add partner" className="ios-pressable flex h-11 min-w-11 items-center justify-center text-primary">
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        }
      />
      <PullToRefresh queryKeys={[["partners"]]}>
        <div className="px-4 pt-3">
          <p className="pb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            Partner / venue logos and links shown in the Partners section on the homepage.
          </p>
        </div>

        {isLoading && partners.length === 0 ? (
          <div className="space-y-2 px-4">
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-2">
            <NativeEmptyState
              icon={Handshake}
              title="No partners yet"
              description="Add your first partner or venue with the + button."
            />
          </div>
        ) : (
          <div>
            {windowed.map((partner) => (
              <button
                key={partner.id}
                type="button"
                onClick={() => {
                  emitHaptic("tab.select");
                  navigate(`/admin/content/partners/${encodeURIComponent(partner.id)}`);
                }}
                className="ios-pressable flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left"
              >
                <span className="shrink-0 border border-border bg-card/50 px-1.5 py-0.5 font-mono text-[10px] font-black text-muted-foreground">
                  {Number(partner.sort_order || 0)}
                </span>
                <PartnerLogo partner={partner} className="h-12 w-12" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{partner.name || "Unnamed partner"}</span>
                  <span className="block truncate pt-0.5 text-xs text-muted-foreground">
                    {partner.url || partner.description || "No link"}
                  </span>
                </span>
                {partner.is_published === false && (
                  <span className="flex shrink-0 items-center gap-1 border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-300">
                    <EyeOff className="h-3 w-3" aria-hidden="true" /> Hidden
                  </span>
                )}
              </button>
            ))}
            {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
          </div>
        )}
      </PullToRefresh>

      {/* Create sheet — writes the exact draft shape the web form submits. */}
      <MobileActionDrawer
        open={addOpen}
        onOpenChange={(open) => {
          if (!open) setAddOpen(false);
        }}
        title="Add a partner"
        description="Shown in the Partners section on the homepage."
      >
        <div className="grid gap-3 py-2">
          <Input
            placeholder="Partner / venue name"
            aria-label="Partner name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="h-11 rounded-none border-border bg-background"
          />
          <Input
            placeholder="Website link (optional)"
            aria-label="Website link"
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            className="h-11 rounded-none border-border bg-background"
          />
          <Textarea
            placeholder="Short description (optional)"
            aria-label="Description"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className="min-h-16 rounded-none border-border bg-background"
          />
          <LogoField value={draft.logo_url} onChange={(url) => setDraft({ ...draft, logo_url: url })} />
          <div className="flex items-center gap-4">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Sort order"
              aria-label="Sort order"
              value={draft.sort_order}
              onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
              className="h-11 w-28 rounded-none border-border bg-background font-mono"
            />
            <label className="flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Published
              <Switch checked={draft.is_published !== false} onCheckedChange={(v) => setDraft({ ...draft, is_published: v })} />
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-3">
          <button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => setAddOpen(false)}
            className="ios-pressable flex min-h-11 items-center justify-center border border-border text-xs font-bold uppercase tracking-widest disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canCreatePartner(draft) || createMutation.isPending}
            onClick={submitCreate}
            className="ios-pressable flex min-h-11 items-center justify-center bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            {createMutation.isPending ? "Adding…" : "Add partner"}
          </button>
        </div>
      </MobileActionDrawer>
    </div>
  );
}

/** Native partner editor — /admin/content/partners/:partnerId */
export function NativePartnerDetail() {
  const { partnerId } = useParams();
  const navigate = useNavigate();
  const { data: partners = [], isLoading } = usePartners();
  const partner = useMemo(() => partners.find((p) => String(p.id) === String(partnerId)) || null, [partners, partnerId]);
  const updateMutation = usePartnerUpdate();
  const deleteMutation = usePartnerDelete();

  const [draft, setDraft] = useState(null); // lazily seeded from the record
  const [confirmDelete, setConfirmDelete] = useState(false);
  const form = draft ?? {
    name: partner?.name || "",
    url: partner?.url || "",
    description: partner?.description || "",
    logo_url: partner?.logo_url || "",
    sort_order: partner?.sort_order ?? 1,
    is_published: partner?.is_published !== false,
  };

  const saveChanges = async () => {
    if (!partner || !hasPartnerChanges(partner, form) || updateMutation.isPending) return;
    emitHaptic("action.primary");
    try {
      await updateMutation.mutateAsync({ id: partner.id, data: buildPartnerUpdatePayload(partner, form) });
      setDraft(null); // re-seed from the fresh record
    } catch {
      // onError already surfaced the failure; edits stay in the form.
    }
  };

  const confirmDeletePartner = async () => {
    if (!partner || deleteMutation.isPending) return;
    try {
      await deleteMutation.mutateAsync(partner.id);
      setConfirmDelete(false);
      navigate("/admin/content/partners", { replace: true });
    } catch {
      setConfirmDelete(false);
    }
  };

  const openLink = () => {
    emitHaptic("tab.select");
    openSystemUrl(partner.url).then((handled) => {
      if (!handled && typeof window !== "undefined") window.open(partner.url, "_blank", "noopener,noreferrer");
    });
  };

  if (!isLoading && !partner) {
    return (
      <div>
        <NativeTopBar title="Partner" fallback="/admin/content/partners" />
        <div className="px-4 pt-6">
          <NativeEmptyState icon={Handshake} title="Partner not found" description="It may have been removed, or you're offline." />
        </div>
      </div>
    );
  }
  if (!partner) {
    return (
      <div>
        <NativeTopBar title="Partner" fallback="/admin/content/partners" />
        <div className="space-y-2 px-4 pt-4">
          <NativeSkeleton className="h-24 w-full" />
          <NativeSkeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const dirty = hasPartnerChanges(partner, form);

  return (
    <div className="pb-10">
      <NativeTopBar title={partner.name || "Edit partner"} fallback="/admin/content/partners" />
      <div className="space-y-4 px-4 pt-3">
        {/* Preview */}
        <div className="flex items-center gap-3 border border-border/60 bg-card/50 p-3">
          <PartnerLogo partner={partner} className="h-16 w-16" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{partner.name || "Unnamed partner"}</p>
            <p className="pt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              Sort {Number(partner.sort_order || 0)} · {partner.is_published === false ? "Hidden" : "Published"}
            </p>
            {partner.url && (
              <button
                type="button"
                onClick={openLink}
                className="ios-pressable mt-1 flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Open link
              </button>
            )}
          </div>
        </div>

        {/* Edit form — writes only the fields that changed, using the same
            field names/values the web manager's blur-writes send. */}
        <div className="border border-border/60 bg-card/50 p-3">
          <div className="grid gap-3">
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-partner-name">
              Name
            </label>
            <Input
              id="native-partner-name"
              placeholder="Partner / venue name"
              value={form.name}
              onChange={(e) => setDraft({ ...form, name: e.target.value })}
              className="h-11 rounded-none border-border bg-background"
            />
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-partner-url">
              Website link
            </label>
            <Input
              id="native-partner-url"
              placeholder="Website link"
              value={form.url}
              onChange={(e) => setDraft({ ...form, url: e.target.value })}
              className="h-11 rounded-none border-border bg-background"
            />
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-partner-description">
              Description
            </label>
            <Textarea
              id="native-partner-description"
              placeholder="Short description (optional)"
              value={form.description}
              onChange={(e) => setDraft({ ...form, description: e.target.value })}
              className="min-h-20 rounded-none border-border bg-background"
            />
            <LogoField value={form.logo_url} onChange={(url) => setDraft({ ...form, logo_url: url })} />
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-partner-sort">
              Sort order
            </label>
            <Input
              id="native-partner-sort"
              type="number"
              inputMode="numeric"
              value={form.sort_order}
              onChange={(e) => setDraft({ ...form, sort_order: Number(e.target.value) })}
              className="h-11 w-32 rounded-none border-border bg-background font-mono"
            />
            <label className="flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Published
              <Switch checked={form.is_published !== false} onCheckedChange={(v) => setDraft({ ...form, is_published: v })} />
            </label>
          </div>
          <button
            type="button"
            disabled={!dirty || updateMutation.isPending}
            onClick={saveChanges}
            className="ios-pressable mt-3 flex min-h-12 w-full items-center justify-center bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>

        <button
          type="button"
          disabled={deleteMutation.isPending}
          onClick={() => {
            emitHaptic("mutation.warning");
            setConfirmDelete(true);
          }}
          className="ios-pressable flex min-h-11 w-full items-center justify-center gap-1.5 border border-red-500/40 text-xs font-bold uppercase tracking-widest text-red-400 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete partner
        </button>
      </div>

      <AdminConfirmSheet
        open={confirmDelete}
        title="Delete this partner?"
        description="Removes it from the homepage Partners section immediately. This can't be undone."
        confirmLabel="Yes, delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={confirmDeletePartner}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
