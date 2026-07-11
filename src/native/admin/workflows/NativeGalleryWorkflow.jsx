import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Images, Plus, Eye, EyeOff, Trash2, ExternalLink, Camera, Film, Youtube, Facebook } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
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
  EMPTY_GALLERY_DRAFT,
  GALLERY_TYPE_OPTIONS,
  GALLERY_FILTERS,
  galleryTypeMeta,
  getYoutubeId,
  filterGalleryItems,
  galleryEventGroups,
  isGalleryItemPublished,
  applyDraftMediaType,
  canSubmitGalleryDraft,
  buildGalleryCreatePayload,
  buildGalleryEditPayload,
  buildGalleryPublishTogglePayload,
  galleryPreviewSrc,
  galleryItemUrl,
} from "./gallery-helpers.js";

// Same query key + fetch the wrapped web module uses, so both surfaces share
// one cache (admin-modules.jsx GalleryModule).
const useGalleryItems = () =>
  useQuery({
    queryKey: ["gallery"],
    queryFn: () => base44.entities.GalleryItem.list("sort_order", 200),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

const useGalleryUpdate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities.GalleryItem.update(id, data),
    onSuccess: () => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Gallery update failed", description: error.message, variant: "destructive" });
    },
  });
};

const useGalleryDelete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => base44.entities.GalleryItem.delete(id),
    onSuccess: () => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      toast({ title: "Item removed" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });
};

const TYPE_ICONS = { photo: Camera, video: Film, youtube: Youtube, facebook: Facebook };

function TypeBadge({ type }) {
  const meta = galleryTypeMeta(type);
  return (
    <span className={`border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${meta.tone}`}>
      {meta.label}
    </span>
  );
}

function ItemThumb({ item, className = "" }) {
  const src = galleryPreviewSrc(item);
  const Icon = TYPE_ICONS[item.media_type] || Images;
  return (
    <div className={`shrink-0 overflow-hidden border border-border bg-muted/20 ${className}`}>
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
          <Icon className="h-6 w-6 stroke-1" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

/** Per-type media input — same upload client call the web manager uses
 *  (base44.integrations.Core.UploadFile via MediaUploader) plus URL paste. */
function DraftMediaInput({ draft, onChange }) {
  if (draft.media_type === "photo" || draft.media_type === "video") {
    const isPhoto = draft.media_type === "photo";
    return (
      <div className="grid gap-2">
        <MediaUploader
          label={isPhoto ? "Upload photo" : "Upload video"}
          accept={isPhoto ? "image/*" : "video/*"}
          onUploaded={(url) => onChange({ ...draft, media_url: url })}
        />
        {draft.media_url && (
          <p className="truncate font-mono text-[10px] text-emerald-400">
            Uploaded: {draft.media_url.split("/").pop()}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground">Or paste a direct {isPhoto ? "image" : "video"} URL:</p>
        <Input
          placeholder="https://..."
          value={draft.media_url}
          onChange={(e) => onChange({ ...draft, media_url: e.target.value })}
          aria-label={isPhoto ? "Image URL" : "Video URL"}
          className="h-11 rounded-none border-border bg-background font-mono text-xs"
        />
      </div>
    );
  }
  const ytId = draft.media_type === "youtube" ? getYoutubeId(draft.embed_url) : null;
  return (
    <div className="grid gap-2">
      <Input
        placeholder={
          draft.media_type === "youtube"
            ? "https://www.youtube.com/watch?v=... or https://youtu.be/..."
            : "https://www.facebook.com/video/... or share URL"
        }
        value={draft.embed_url}
        onChange={(e) => onChange({ ...draft, embed_url: e.target.value })}
        aria-label={draft.media_type === "youtube" ? "YouTube URL" : "Facebook URL"}
        className="h-11 rounded-none border-border bg-background font-mono text-xs"
      />
      {ytId && (
        <img
          src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
          alt="YouTube thumbnail preview"
          className="h-24 w-auto border border-border object-cover"
        />
      )}
    </div>
  );
}

/** Native gallery manager — /admin/content/gallery */
export default function NativeGalleryList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useGalleryItems();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState(null); // create drawer open when non-null
  const [confirmDelete, setConfirmDelete] = useState(null); // item | null
  const updateMutation = useGalleryUpdate();
  const deleteMutation = useGalleryDelete();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.GalleryItem.create(data),
    onSuccess: () => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      toast({ title: "Gallery item added" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Could not add item", description: error.message, variant: "destructive" });
    },
  });

  const visible = useMemo(() => filterGalleryItems(items, { query, filter }), [items, query, filter]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, {
    initial: 15,
    step: 15,
    restoreKey: "admin-gallery",
  });
  const countFor = (key) => filterGalleryItems(items, { filter: key }).length;
  const eventGroups = useMemo(() => galleryEventGroups(items), [items]);
  const publishedCount = items.filter(isGalleryItemPublished).length;

  const submitDraft = async () => {
    if (!draft || !canSubmitGalleryDraft(draft) || createMutation.isPending) return;
    emitHaptic("action.primary");
    // Drawer awaits settlement so it only closes on a real save.
    await createMutation.mutateAsync(buildGalleryCreatePayload(draft));
    setDraft(null);
  };

  const confirmDeleteItem = async () => {
    if (!confirmDelete) return;
    await deleteMutation.mutateAsync(confirmDelete.id);
    setConfirmDelete(null);
  };

  return (
    <div className="pb-8">
      <NativeTopBar
        title="Gallery"
        fallback="/admin/content"
        right={
          <button
            type="button"
            aria-label="Add gallery item"
            onClick={() => {
              emitHaptic("action.primary");
              setDraft({ ...EMPTY_GALLERY_DRAFT });
            }}
            className="ios-pressable flex h-11 min-w-11 items-center justify-center text-primary"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        }
      />
      <PullToRefresh queryKeys={[["gallery"]]}>
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 border border-border bg-card/50 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, event, URL"
              aria-label="Search gallery"
              className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="ios-scroll flex gap-2 overflow-x-auto py-2">
            {GALLERY_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`ios-pressable min-h-9 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                  filter === f.key ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
                }`}
              >
                {f.label} ({countFor(f.key)})
              </button>
            ))}
          </div>
          {items.length > 0 && (
            <div className="ios-scroll flex gap-2 overflow-x-auto pb-2">
              <span className="shrink-0 border border-border bg-card/40 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-400">
                {publishedCount} published
              </span>
              {Object.entries(eventGroups).map(([label, count]) => (
                <span key={label} className="shrink-0 border border-border bg-card/40 px-2.5 py-1 font-mono text-[10px] font-bold text-primary">
                  {label} · {count}
                </span>
              ))}
            </div>
          )}
        </div>

        {isLoading && items.length === 0 ? (
          <div className="space-y-2 px-4">
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState
              icon={Images}
              title="No gallery items"
              description="Nothing matches this filter. Add photos and videos with the + button."
            />
          </div>
        ) : (
          <div>
            {windowed.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 border-b border-border/40 px-4 py-3 ${
                  isGalleryItemPublished(item) ? "" : "opacity-60"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    emitHaptic("tab.select");
                    navigate(`/admin/content/gallery/${encodeURIComponent(item.id)}`);
                  }}
                  className="ios-pressable flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <ItemThumb item={item} className="h-14 w-20" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <TypeBadge type={item.media_type} />
                      {item.event_label && (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-primary">{item.event_label}</span>
                      )}
                      {!isGalleryItemPublished(item) && (
                        <span className="border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-400">
                          Draft
                        </span>
                      )}
                    </span>
                    <span className="block truncate pt-1 text-sm font-bold">
                      {item.title || <span className="italic text-muted-foreground">No title</span>}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={updateMutation.isPending}
                  aria-label={isGalleryItemPublished(item) ? "Hide item" : "Publish item"}
                  onClick={() => {
                    emitHaptic("action.primary");
                    updateMutation.mutate({ id: item.id, data: buildGalleryPublishTogglePayload(item) });
                  }}
                  className={`ios-pressable flex h-11 w-11 shrink-0 items-center justify-center border disabled:opacity-40 ${
                    isGalleryItemPublished(item)
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-border bg-muted/10 text-muted-foreground"
                  }`}
                >
                  {isGalleryItemPublished(item) ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  aria-label="Delete item"
                  onClick={() => {
                    emitHaptic("mutation.warning");
                    setConfirmDelete(item);
                  }}
                  className="ios-pressable flex h-11 w-11 shrink-0 items-center justify-center border border-destructive/30 bg-destructive/10 text-destructive disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
          </div>
        )}
      </PullToRefresh>

      {/* Create sheet — writes the exact draft shape the web form submits. */}
      <MobileActionDrawer
        open={!!draft}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
        title="Add gallery item"
        description="Photos, uploaded videos, or YouTube/Facebook links."
      >
        {draft && (
          <div className="grid gap-3 py-2">
            <Input
              placeholder="Title / caption (optional)"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              aria-label="Title"
              className="h-11 rounded-none border-border bg-background"
            />
            <div className="grid grid-cols-2 gap-2">
              {GALLERY_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={draft.media_type === opt.value}
                  onClick={() => {
                    emitHaptic("tab.select");
                    setDraft(applyDraftMediaType(draft, opt.value));
                  }}
                  className={`ios-pressable flex min-h-11 items-center justify-center border px-2 text-[10px] font-bold uppercase tracking-widest ${
                    draft.media_type === opt.value
                      ? "border-emerald-400 bg-emerald-500/15 text-emerald-300"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <DraftMediaInput draft={draft} onChange={setDraft} />
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <Input
                placeholder="Event label (e.g. Las Vegas 2024)"
                value={draft.event_label}
                onChange={(e) => setDraft({ ...draft, event_label: e.target.value })}
                aria-label="Event label"
                className="h-11 rounded-none border-border bg-background"
              />
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Sort"
                value={draft.sort_order}
                onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                aria-label="Sort order"
                className="h-11 rounded-none border-border bg-background"
              />
            </div>
            <label className="flex min-h-11 cursor-pointer select-none items-center gap-3 text-sm">
              <Switch
                checked={draft.is_published !== false}
                onCheckedChange={(v) => setDraft({ ...draft, is_published: v })}
              />
              Published
            </label>
            <button
              type="button"
              disabled={!canSubmitGalleryDraft(draft) || createMutation.isPending}
              onClick={submitDraft}
              className="ios-pressable flex min-h-12 items-center justify-center gap-2 bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {createMutation.isPending ? "Adding…" : "Add to gallery"}
            </button>
            {!canSubmitGalleryDraft(draft) && (
              <p className="text-[10px] uppercase tracking-widest text-amber-300">
                Add media or a link before saving
              </p>
            )}
          </div>
        )}
      </MobileActionDrawer>

      <AdminConfirmSheet
        open={!!confirmDelete}
        title="Delete this gallery item?"
        description={`"${confirmDelete?.title || galleryTypeMeta(confirmDelete?.media_type).label}" is removed from the public gallery immediately. This can't be undone.`}
        confirmLabel="Delete item"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={confirmDeleteItem}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

/** Native gallery item detail + editor — /admin/content/gallery/:itemId */
export function NativeGalleryItemDetail() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useGalleryItems();
  const item = useMemo(() => items.find((i) => String(i.id) === String(itemId)) || null, [items, itemId]);
  const updateMutation = useGalleryUpdate();
  const deleteMutation = useGalleryDelete();
  const [form, setForm] = useState(null); // lazily seeded from the item
  const [confirmDelete, setConfirmDelete] = useState(false);

  const formState = form ?? {
    title: item?.title || "",
    event_label: item?.event_label || "",
    sort_order: item?.sort_order ?? 1,
  };

  if (!isLoading && !item) {
    return (
      <div>
        <NativeTopBar title="Gallery item" fallback="/admin/content/gallery" />
        <div className="px-4 pt-6">
          <NativeEmptyState icon={Images} title="Item not found" description="It may have been deleted, or you're offline." />
        </div>
      </div>
    );
  }
  if (!item) {
    return (
      <div>
        <NativeTopBar title="Gallery item" fallback="/admin/content/gallery" />
        <div className="space-y-2 px-4 pt-4">
          <NativeSkeleton className="h-44 w-full" />
          <NativeSkeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const url = galleryItemUrl(item);
  // Same partial single-field semantics the web blur-writes use: only
  // changed fields go in the update payload.
  const pendingChanges = buildGalleryEditPayload(item, formState);
  const hasChanges = Object.keys(pendingChanges).length > 0;

  const saveChanges = () => {
    if (!hasChanges) return;
    emitHaptic("action.primary");
    updateMutation.mutate({ id: item.id, data: pendingChanges });
  };

  const confirmDeleteItem = async () => {
    await deleteMutation.mutateAsync(item.id);
    setConfirmDelete(false);
    navigate("/admin/content/gallery", { replace: true });
  };

  return (
    <div className="pb-10">
      <NativeTopBar title={item.title || galleryTypeMeta(item.media_type).label} fallback="/admin/content/gallery" />
      <div className="space-y-4 px-4 pt-3">
        {/* Preview */}
        <div className="border border-border/60 bg-card/50">
          <ItemThumb item={item} className="h-48 w-full border-0" />
          <div className="flex flex-wrap items-center gap-2 border-t border-border/40 p-3">
            <TypeBadge type={item.media_type} />
            {item.event_label && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-primary">{item.event_label}</span>
            )}
            {!isGalleryItemPublished(item) && (
              <span className="border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-400">
                Draft
              </span>
            )}
          </div>
        </div>

        {/* Source URL */}
        <div className="border border-border/60 bg-card/50 p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">URL</p>
          <p className="truncate pt-1 font-mono text-[10px] text-muted-foreground">{url || "—"}</p>
          {url && (
            <button
              type="button"
              onClick={() => {
                emitHaptic("tab.select");
                openSystemUrl(url).then((handled) => {
                  if (!handled && typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
                });
              }}
              className="ios-pressable mt-2 flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Open media
            </button>
          )}
        </div>

        {/* Edit form — writes the same partial fields the web edit writes. */}
        <div className="border border-border/60 bg-card/50 p-3">
          <p className="pb-2 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Details</p>
          <div className="grid gap-2">
            <Input
              value={formState.title}
              onChange={(e) => setForm({ ...formState, title: e.target.value })}
              placeholder="Title / caption"
              aria-label="Title"
              className="h-11 rounded-none border-border bg-background"
            />
            <Input
              value={formState.event_label}
              onChange={(e) => setForm({ ...formState, event_label: e.target.value })}
              placeholder="Event label"
              aria-label="Event label"
              className="h-11 rounded-none border-border bg-background"
            />
            <Input
              type="number"
              inputMode="numeric"
              value={formState.sort_order}
              onChange={(e) => setForm({ ...formState, sort_order: e.target.value })}
              placeholder="Sort order"
              aria-label="Sort order"
              className="h-11 rounded-none border-border bg-background"
            />
          </div>
          <button
            type="button"
            disabled={!hasChanges || updateMutation.isPending}
            onClick={saveChanges}
            className="ios-pressable mt-3 flex min-h-12 w-full items-center justify-center bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>

        {/* Visibility + delete */}
        <div className="border border-border/60 bg-card/50 p-3">
          <p className="pb-2 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Visibility</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={updateMutation.isPending}
              onClick={() => {
                emitHaptic("action.primary");
                updateMutation.mutate({ id: item.id, data: buildGalleryPublishTogglePayload(item) });
              }}
              className={`ios-pressable flex min-h-11 items-center justify-center gap-1.5 border text-xs font-bold uppercase tracking-widest disabled:opacity-40 ${
                isGalleryItemPublished(item)
                  ? "border-border text-muted-foreground"
                  : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {isGalleryItemPublished(item) ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Hide
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Publish
                </>
              )}
            </button>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => {
                emitHaptic("mutation.warning");
                setConfirmDelete(true);
              }}
              className="ios-pressable flex min-h-11 items-center justify-center gap-1.5 border border-red-500/40 text-xs font-bold uppercase tracking-widest text-red-400 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
            </button>
          </div>
        </div>
      </div>

      <AdminConfirmSheet
        open={confirmDelete}
        title="Delete this gallery item?"
        description="It disappears from the public gallery immediately. This can't be undone."
        confirmLabel="Delete item"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={confirmDeleteItem}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
