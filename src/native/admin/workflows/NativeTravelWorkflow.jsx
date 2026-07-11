import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plane, Plus, Save, Trash2, Clock, ArrowUpDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import ImageField from "@/components/admin/ImageField";
import MobileActionDrawer from "@/components/admin/MobileActionDrawer";
import AdminConfirmSheet from "@/components/admin/shared/AdminConfirmSheet";
import PullToRefresh from "@/components/PullToRefresh";
import { emitHaptic } from "@/lib/native/haptic-events";
import { useWindowedList } from "@/hooks/use-windowed-list";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  EMPTY_TRAVEL_PACKAGE,
  buildPackageDraft,
  buildPackagePayload,
  canCreatePackage,
  filterPackages,
  packageStatusMeta,
  descriptionPreview,
} from "./travel-helpers.js";

/**
 * Native travel-package CRUD — /admin/content/travel. Same query key and
 * entity writes as the web TravelPackagesManager (["packages"] /
 * TravelPackage.create/update/delete), so the cache stays shared with the
 * web panel and server RLS stays the authority. The web manager emits no
 * rlt_admin_log events for this module, so native doesn't either.
 */
const usePackages = () =>
  useQuery({
    queryKey: ["packages"],
    queryFn: () => base44.entities.TravelPackage.list("sort_order", 200),
    enabled: appParams.hasBase44Config,
  });

function StatusBadge({ pkg }) {
  const meta = packageStatusMeta(pkg);
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${meta.tone}`}>
      {meta.key === "coming_soon" && <Clock className="h-2.5 w-2.5" aria-hidden="true" />}
      {meta.label}
    </span>
  );
}

/** Field wrapper matching the admin label idiom. */
function Field({ id, label, help, children }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </label>
      {children}
      {help && <p className="text-[9px] text-muted-foreground/60">{help}</p>}
    </div>
  );
}

/**
 * Shared form body. The create sheet mirrors the web create form (no
 * booking fields — they still ship as "" in the payload, web parity); the
 * detail editor exposes the full field set like the web card editor.
 */
function PackageFormFields({ idPrefix, draft, setDraft, withBooking = false }) {
  return (
    <div className="grid gap-3">
      <Field id={`${idPrefix}-name`} label="Package name" help="Display name shown on the homepage">
        <Input
          id={`${idPrefix}-name`}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="e.g. VIP Courtside Experience"
          className="h-11 rounded-none border-border bg-background"
        />
      </Field>
      <Field id={`${idPrefix}-sort`} label="Sort order" help="Lower numbers appear first on the page">
        <Input
          id={`${idPrefix}-sort`}
          type="number"
          inputMode="numeric"
          value={draft.sort_order}
          onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
          className="h-11 rounded-none border-border bg-background font-mono"
        />
      </Field>
      <Field id={`${idPrefix}-description`} label="Description" help="Brief summary shown in the package card">
        <Textarea
          id={`${idPrefix}-description`}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="Describe what's included in this travel package…"
          className="min-h-24 rounded-none border-border bg-background"
        />
      </Field>
      <ImageField
        label="Package image"
        value={draft.image_url}
        onChange={(url) => setDraft({ ...draft, image_url: url })}
      />
      {withBooking && (
        <>
          <Field id={`${idPrefix}-booking-url`} label="Booking link (optional)" help="Promo/booking URL — shows a click-through button on the card">
            <Input
              id={`${idPrefix}-booking-url`}
              value={draft.booking_url}
              onChange={(e) => setDraft({ ...draft, booking_url: e.target.value })}
              placeholder="https://…"
              inputMode="url"
              className="h-11 rounded-none border-border bg-background"
            />
          </Field>
          <Field id={`${idPrefix}-booking-label`} label="Booking button label" help="Defaults to 'Book Now'">
            <Input
              id={`${idPrefix}-booking-label`}
              value={draft.booking_label}
              onChange={(e) => setDraft({ ...draft, booking_label: e.target.value })}
              placeholder="Book Circa Rate"
              className="h-11 rounded-none border-border bg-background"
            />
          </Field>
        </>
      )}
      <div className="flex min-h-11 items-center justify-between border border-border/60 bg-card/50 px-3">
        <label htmlFor={`${idPrefix}-coming-soon`} className="text-[10px] font-bold uppercase tracking-widest">
          {draft.is_coming_soon !== false ? "Coming Soon" : "Available Now"}
        </label>
        <Switch
          id={`${idPrefix}-coming-soon`}
          checked={draft.is_coming_soon !== false}
          onCheckedChange={(value) => setDraft({ ...draft, is_coming_soon: value })}
        />
      </div>
    </div>
  );
}

/** Native searchable package list + create sheet — /admin/content/travel */
export default function NativeTravelPackagesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: packages = [], isLoading } = usePackages();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_TRAVEL_PACKAGE);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TravelPackage.create(data),
    onSuccess: () => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast({ title: "Package added" });
      setDraft(EMPTY_TRAVEL_PACKAGE);
      setCreateOpen(false);
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Could not add package", description: error.message, variant: "destructive" });
    },
  });

  const visible = useMemo(() => filterPackages(packages, query), [packages, query]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, {
    initial: 15,
    step: 15,
    restoreKey: "admin-travel-packages",
  });

  return (
    <div className="pb-8">
      <NativeTopBar
        title="Travel Packages"
        fallback="/admin/content"
        right={
          <button
            type="button"
            aria-label="Add package"
            onClick={() => {
              emitHaptic("action.primary");
              setCreateOpen(true);
            }}
            className="ios-pressable flex h-11 min-w-11 items-center justify-center text-primary"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        }
      />
      <PullToRefresh queryKeys={[["packages"]]}>
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 border border-border bg-card/50 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search packages"
              aria-label="Search packages"
              className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <p className="py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {packages.length} {packages.length === 1 ? "package" : "packages"} · lower sort order shows first
          </p>
        </div>

        {isLoading && packages.length === 0 ? (
          <div className="space-y-2 px-4">
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState
              icon={Plane}
              title={query ? "No matches" : "No packages yet"}
              description={query ? "Nothing matches this search." : "Tap + to create your first travel package card."}
            />
          </div>
        ) : (
          <div>
            {windowed.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => {
                  emitHaptic("tab.select");
                  navigate(`/admin/content/travel/${encodeURIComponent(pkg.id)}`);
                }}
                className="ios-pressable flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left"
              >
                {pkg.image_url ? (
                  <img src={pkg.image_url} alt="" className="h-14 w-14 shrink-0 border border-border/40 object-cover" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-border/40 bg-card/50">
                    <Plane className="h-5 w-5 text-muted-foreground/40" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 border border-border/40 bg-card/50 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                      <ArrowUpDown className="h-2.5 w-2.5" aria-hidden="true" />#{pkg.sort_order || 1}
                    </span>
                    <StatusBadge pkg={pkg} />
                  </div>
                  <p className="truncate pt-1 text-sm font-bold">{pkg.name || "Untitled Package"}</p>
                  {pkg.description && (
                    <p className="truncate text-xs text-muted-foreground">{descriptionPreview(pkg.description)}</p>
                  )}
                </div>
              </button>
            ))}
            {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
          </div>
        )}
      </PullToRefresh>

      <MobileActionDrawer
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) setCreateOpen(false);
        }}
        title="Add New Package"
        description="Create a new travel package card for the homepage."
      >
        <PackageFormFields idPrefix="native-travel-create" draft={draft} setDraft={setDraft} />
        <button
          type="button"
          disabled={!canCreatePackage(draft) || createMutation.isPending}
          onClick={() => {
            emitHaptic("action.primary");
            createMutation.mutate(buildPackagePayload(draft));
          }}
          className="ios-pressable mt-4 flex min-h-12 w-full items-center justify-center gap-2 bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {createMutation.isPending ? "Adding…" : "Add Package"}
        </button>
      </MobileActionDrawer>
    </div>
  );
}

/** Native package editor — /admin/content/travel/:packageId */
export function NativeTravelPackageDetail() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: packages = [], isLoading } = usePackages();
  const pkg = useMemo(() => packages.find((p) => String(p.id) === String(packageId)) || null, [packages, packageId]);

  const [draft, setDraft] = useState(null); // lazily seeded from the package
  const [confirmDelete, setConfirmDelete] = useState(false);
  const form = draft ?? buildPackageDraft(pkg);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TravelPackage.update(id, data),
    onSuccess: () => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast({ title: "Package saved" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Could not save package", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TravelPackage.delete(id),
    onSuccess: () => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast({ title: "Package deleted" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Could not delete package", description: error.message, variant: "destructive" });
    },
  });

  const confirmDeletePackage = async () => {
    try {
      await deleteMutation.mutateAsync(pkg.id);
      setConfirmDelete(false);
      navigate("/admin/content/travel", { replace: true });
    } catch {
      // onError already surfaced the failure; keep the sheet open.
    }
  };

  if (!isLoading && !pkg) {
    return (
      <div>
        <NativeTopBar title="Package" fallback="/admin/content/travel" />
        <div className="px-4 pt-6">
          <NativeEmptyState icon={Plane} title="Package not found" description="It may have been deleted, or you're offline." />
        </div>
      </div>
    );
  }
  if (!pkg) {
    return (
      <div>
        <NativeTopBar title="Package" fallback="/admin/content/travel" />
        <div className="space-y-2 px-4 pt-4">
          <NativeSkeleton className="h-40 w-full" />
          <NativeSkeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <NativeTopBar title={pkg.name || "Package"} fallback="/admin/content/travel" />
      <div className="space-y-4 px-4 pt-3">
        {/* Live card preview */}
        <div className="border border-border/60 bg-card/50">
          {pkg.image_url && <img src={pkg.image_url} alt={pkg.name || "Package"} className="h-36 w-full object-cover" />}
          <div className="flex items-center justify-between p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{pkg.name || "Untitled Package"}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Sort order #{pkg.sort_order || 1}</p>
            </div>
            <StatusBadge pkg={pkg} />
          </div>
        </div>

        {/* Editor — full web field set, saved as one update like the web card */}
        <div className="border border-border/60 bg-card/50 p-3">
          <p className="pb-3 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Edit Package</p>
          <PackageFormFields idPrefix="native-travel-edit" draft={form} setDraft={setDraft} withBooking />
          <button
            type="button"
            disabled={updateMutation.isPending}
            onClick={() => {
              emitHaptic("action.primary");
              updateMutation.mutate({ id: pkg.id, data: buildPackagePayload(form) });
            }}
            className="ios-pressable mt-4 flex min-h-12 w-full items-center justify-center gap-2 bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {updateMutation.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>

        {/* Danger zone */}
        <button
          type="button"
          disabled={deleteMutation.isPending}
          onClick={() => {
            emitHaptic("mutation.warning");
            setConfirmDelete(true);
          }}
          className="ios-pressable flex min-h-11 w-full items-center justify-center gap-2 border border-red-500/40 text-xs font-bold uppercase tracking-widest text-red-400 disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete Package
        </button>
      </div>

      <AdminConfirmSheet
        open={confirmDelete}
        title="Delete this package?"
        description="Removes the package card from the homepage immediately. This can't be undone."
        confirmLabel="Delete package"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={confirmDeletePackage}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
