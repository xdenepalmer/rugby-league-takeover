import { useId, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Quote, Plus, Trash2, Check, Clock, Upload, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
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
  RATING_OPTIONS,
  ratingLabel,
  isPendingTestimonial,
  TESTIMONIAL_QUEUES,
  testimonialQueue,
  testimonialQueueCounts,
  emptyTestimonialDraft,
  canCreateTestimonial,
  buildTestimonialCreatePayload,
  buildTestimonialUpdatePayload,
  hasTestimonialChanges,
  buildApproveTestimonialPayload,
} from "./testimonials-helpers.js";

// Same query the web admin panels (and the wrapped TestimonialsModule) run —
// shared ["testimonials"] cache key, so both surfaces stay in sync.
const useTestimonials = () =>
  useQuery({
    queryKey: ["testimonials"],
    queryFn: () => base44.entities.Testimonial.list("sort_order", 200),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

// Every write is Testimonial.create/update/delete with the web manager's
// field set, and every success invalidates the same ["testimonials"] key the
// web invalidates. The web TestimonialsManager dispatches no admin-log
// audit events and calls no edge functions, so neither do we.
const useTestimonialMutations = () => {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["testimonials"] });
  const onError = (title) => (error) => {
    emitHaptic("mutation.error");
    toast({ title, description: error.message, variant: "destructive" });
  };
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Testimonial.create(data),
    onSuccess: () => {
      emitHaptic("save.success");
      refresh();
      toast({ title: "Testimonial added" });
    },
    onError: onError("Could not add testimonial"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Testimonial.update(id, data),
    onSuccess: () => {
      emitHaptic("save.success");
      refresh();
    },
    onError: onError("Could not save testimonial"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Testimonial.delete(id),
    onSuccess: () => {
      emitHaptic("save.success");
      refresh();
      toast({ title: "Testimonial removed" });
    },
    onError: onError("Could not delete testimonial"),
  });
  return { createMutation, updateMutation, deleteMutation };
};

/**
 * Native avatar control: paste a URL or upload from the photo library through
 * the EXACT client call the web ImageField uses
 * (base44.integrations.Core.UploadFile). Remove is always visible — no
 * hover-gated affordances on touch.
 */
function NativeAvatarField({ value, onChange }) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
      emitHaptic("save.success");
    } catch (error) {
      emitHaptic("mutation.error");
      toast({ title: "Avatar upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Photo / avatar (optional)</p>
      {value ? (
        <div className="flex items-start gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden border border-border bg-secondary">
            <img src={value} alt="Avatar" className="h-full w-full object-cover" />
          </div>
          <button
            type="button"
            onClick={() => {
              emitHaptic("action.primary");
              onChange("");
            }}
            className="ios-pressable flex min-h-11 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Remove photo
          </button>
        </div>
      ) : null}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste image URL"
        aria-label="Avatar URL"
        className="h-11 rounded-none border-border bg-background"
      />
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={inputId}
        className={`ios-pressable flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 border border-border text-[10px] font-bold uppercase tracking-widest ${
          uploading ? "pointer-events-none opacity-40" : ""
        }`}
      >
        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
        {uploading ? "Uploading…" : "Upload photo"}
      </label>
    </div>
  );
}

/** Touch-first rating picker over the web's 0–5 select (0 hides the stars). */
function RatingPicker({ value, onChange }) {
  const current = Number(value ?? 0);
  return (
    <div className="grid gap-1.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Rating</p>
      <div className="flex flex-wrap gap-2">
        {RATING_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={current === r}
            onClick={() => {
              emitHaptic("tab.select");
              onChange(r);
            }}
            className={`ios-pressable min-h-11 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
              current === r ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
            }`}
          >
            {ratingLabel(r)}
          </button>
        ))}
      </div>
    </div>
  );
}

function PendingBadge({ testimonial }) {
  if (!isPendingTestimonial(testimonial)) return null;
  return (
    <span className="flex shrink-0 items-center gap-1 border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-300">
      <Clock className="h-3 w-3" aria-hidden="true" /> Pending
    </span>
  );
}

/**
 * Native testimonials publish queue — /admin/content/testimonials. Visitor
 * submissions arrive pending (is_published:false) and surface first; approve
 * publishes them to the homepage Testimonials section. Every write sends the
 * exact payloads the web TestimonialsManager sends; server RLS stays the
 * authority.
 */
export default function NativeTestimonialsList() {
  const navigate = useNavigate();
  const { data: testimonials = [], isLoading } = useTestimonials();
  const { createMutation } = useTestimonialMutations();
  const [queue, setQueue] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(() => emptyTestimonialDraft());

  const counts = useMemo(() => testimonialQueueCounts(testimonials), [testimonials]);
  const visible = useMemo(() => testimonialQueue(testimonials, queue), [testimonials, queue]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, {
    initial: 15,
    step: 15,
    restoreKey: `admin-testimonials-${queue}`,
  });

  const openAdd = () => {
    emitHaptic("action.primary");
    setDraft(emptyTestimonialDraft());
    setAddOpen(true);
  };

  // The add drawer awaits settlement so it only closes on a real save.
  const submitCreate = async () => {
    if (!canCreateTestimonial(draft) || createMutation.isPending) return;
    emitHaptic("action.primary");
    try {
      await createMutation.mutateAsync(buildTestimonialCreatePayload(draft));
      setDraft(emptyTestimonialDraft());
      setAddOpen(false);
    } catch {
      // onError already surfaced the failure; keep the drawer open.
    }
  };

  return (
    <div className="pb-8">
      <NativeTopBar
        title="Testimonials"
        fallback="/admin/content"
        right={
          <button type="button" onClick={openAdd} aria-label="Add testimonial" className="ios-pressable flex h-11 min-w-11 items-center justify-center text-primary">
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        }
      />
      <PullToRefresh queryKeys={[["testimonials"]]}>
        <div className="px-4 pt-3">
          <div className="ios-scroll flex gap-2 overflow-x-auto pb-2">
            {TESTIMONIAL_QUEUES.map((q) => (
              <button
                key={q.key}
                type="button"
                aria-pressed={queue === q.key}
                onClick={() => {
                  emitHaptic("tab.select");
                  setQueue(q.key);
                }}
                className={`ios-pressable min-h-11 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                  queue === q.key ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
                }`}
              >
                {q.label} ({counts[q.key] ?? 0})
              </button>
            ))}
          </div>
          <p className="pb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            Fan quotes on the homepage. Visitor submissions arrive pending — approve to publish.
          </p>
        </div>

        {isLoading && testimonials.length === 0 ? (
          <div className="space-y-2 px-4">
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-2">
            <NativeEmptyState
              icon={Quote}
              title={queue === "pending" ? "Queue clear" : "No testimonials yet"}
              description={
                queue === "pending"
                  ? "No visitor submissions are waiting for approval."
                  : "Add your first fan quote with the + button."
              }
            />
          </div>
        ) : (
          <div>
            {windowed.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  emitHaptic("tab.select");
                  navigate(`/admin/content/testimonials/${encodeURIComponent(t.id)}`);
                }}
                className="ios-pressable flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left"
              >
                {t.avatar_url ? (
                  <img src={t.avatar_url} alt="" className="mt-0.5 h-10 w-10 shrink-0 border border-border object-cover" />
                ) : (
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-card/50">
                    <Quote className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold">{t.author_name || "Anonymous"}</span>
                    <PendingBadge testimonial={t} />
                  </span>
                  <span className="block truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t.author_role || "—"} · {ratingLabel(t.rating)} · #{Number(t.sort_order || 0)}
                    {isPendingTestimonial(t) && t.user_email ? ` · ${t.user_email}` : ""}
                  </span>
                  <span className="line-clamp-2 block pt-0.5 text-xs text-muted-foreground">{t.quote || "No quote yet"}</span>
                </span>
              </button>
            ))}
            {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
          </div>
        )}
      </PullToRefresh>

      <MobileActionDrawer
        open={addOpen}
        onOpenChange={(open) => {
          if (!open) setAddOpen(false);
        }}
        title="Add a testimonial"
        description="Shown in the Testimonials section at the bottom of the homepage. Rating is optional — set No stars to hide them."
      >
        <div className="grid gap-3 py-2">
          <Input
            placeholder="Name (e.g. Jacko)"
            aria-label="Name"
            value={draft.author_name}
            onChange={(e) => setDraft({ ...draft, author_name: e.target.value })}
            className="h-11 rounded-none border-border bg-background"
          />
          <Input
            placeholder="Role / location (optional, e.g. Eels fan · Sydney)"
            aria-label="Role / location"
            value={draft.author_role}
            onChange={(e) => setDraft({ ...draft, author_role: e.target.value })}
            className="h-11 rounded-none border-border bg-background"
          />
          <Textarea
            placeholder="What they said…"
            aria-label="Quote"
            value={draft.quote}
            onChange={(e) => setDraft({ ...draft, quote: e.target.value })}
            className="min-h-24 rounded-none border-border bg-background"
          />
          <RatingPicker value={draft.rating} onChange={(rating) => setDraft({ ...draft, rating })} />
          <NativeAvatarField value={draft.avatar_url} onChange={(avatar_url) => setDraft({ ...draft, avatar_url })} />
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
            disabled={!canCreateTestimonial(draft) || createMutation.isPending}
            onClick={submitCreate}
            className="ios-pressable flex min-h-11 items-center justify-center bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            {createMutation.isPending ? "Adding…" : "Add testimonial"}
          </button>
        </div>
      </MobileActionDrawer>
    </div>
  );
}

/** Native testimonial editor — /admin/content/testimonials/:testimonialId */
export function NativeTestimonialDetail() {
  const { testimonialId } = useParams();
  const navigate = useNavigate();
  const { data: testimonials = [], isLoading } = useTestimonials();
  const testimonial = useMemo(
    () => testimonials.find((t) => String(t.id) === String(testimonialId)) || null,
    [testimonials, testimonialId]
  );
  const { updateMutation, deleteMutation } = useTestimonialMutations();

  const [draft, setDraft] = useState(null); // lazily seeded from the record
  const [confirmDelete, setConfirmDelete] = useState(false);
  const form = draft ?? {
    author_name: testimonial?.author_name || "",
    author_role: testimonial?.author_role || "",
    quote: testimonial?.quote || "",
    avatar_url: testimonial?.avatar_url || "",
    rating: testimonial?.rating ?? 0,
    sort_order: testimonial?.sort_order ?? 1,
    is_published: testimonial?.is_published !== false,
  };

  const saveChanges = async () => {
    if (!testimonial || !hasTestimonialChanges(testimonial, form) || updateMutation.isPending) return;
    emitHaptic("action.primary");
    try {
      await updateMutation.mutateAsync({ id: testimonial.id, data: buildTestimonialUpdatePayload(testimonial, form) });
      toast({ title: "Testimonial saved" });
      setDraft(null); // re-seed from the fresh record
    } catch {
      // onError already surfaced the failure; edits stay in the form.
    }
  };

  // Web parity: the Approve button writes exactly { is_published: true }.
  const approve = async () => {
    if (!testimonial || updateMutation.isPending) return;
    emitHaptic("action.primary");
    try {
      await updateMutation.mutateAsync({ id: testimonial.id, data: buildApproveTestimonialPayload() });
      toast({ title: "Testimonial approved" });
      setDraft(null);
    } catch {
      // onError already surfaced the failure.
    }
  };

  const confirmDeleteTestimonial = async () => {
    if (!testimonial || deleteMutation.isPending) return;
    try {
      await deleteMutation.mutateAsync(testimonial.id);
      setConfirmDelete(false);
      navigate("/admin/content/testimonials", { replace: true });
    } catch {
      setConfirmDelete(false);
    }
  };

  if (!isLoading && !testimonial) {
    return (
      <div>
        <NativeTopBar title="Testimonial" fallback="/admin/content/testimonials" />
        <div className="px-4 pt-6">
          <NativeEmptyState icon={Quote} title="Testimonial not found" description="It may have been removed, or you're offline." />
        </div>
      </div>
    );
  }
  if (!testimonial) {
    return (
      <div>
        <NativeTopBar title="Testimonial" fallback="/admin/content/testimonials" />
        <div className="space-y-2 px-4 pt-4">
          <NativeSkeleton className="h-24 w-full" />
          <NativeSkeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const pending = isPendingTestimonial(testimonial);
  const dirty = hasTestimonialChanges(testimonial, form);

  return (
    <div className="pb-10">
      <NativeTopBar title="Edit testimonial" fallback="/admin/content/testimonials" />
      <div className="space-y-4 px-4 pt-3">
        {pending && (
          <div className="border border-amber-500/40 bg-amber-500/[0.04] p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-400">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Pending review{testimonial.user_email ? ` · ${testimonial.user_email}` : ""}
            </p>
            <p className="pt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              A visitor submitted this quote. Approve to publish it on the homepage.
            </p>
            <button
              type="button"
              disabled={updateMutation.isPending}
              onClick={approve}
              className="ios-pressable mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 border border-emerald-500/50 bg-emerald-500/10 text-xs font-bold uppercase tracking-widest text-emerald-300 disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> {updateMutation.isPending ? "Approving…" : "Approve & publish"}
            </button>
          </div>
        )}

        <div className="border border-border/60 bg-card/50 p-3">
          <div className="grid gap-3">
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-testimonial-name">
              Name
            </label>
            <Input
              id="native-testimonial-name"
              placeholder="Name (e.g. Jacko)"
              value={form.author_name}
              onChange={(e) => setDraft({ ...form, author_name: e.target.value })}
              className="h-11 rounded-none border-border bg-background"
            />
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-testimonial-role">
              Role / location
            </label>
            <Input
              id="native-testimonial-role"
              placeholder="Role / location (optional)"
              value={form.author_role}
              onChange={(e) => setDraft({ ...form, author_role: e.target.value })}
              className="h-11 rounded-none border-border bg-background"
            />
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-testimonial-quote">
              Quote
            </label>
            <Textarea
              id="native-testimonial-quote"
              placeholder="What they said…"
              value={form.quote}
              onChange={(e) => setDraft({ ...form, quote: e.target.value })}
              className="min-h-32 rounded-none border-border bg-background"
            />
            <RatingPicker value={form.rating} onChange={(rating) => setDraft({ ...form, rating })} />
            <NativeAvatarField value={form.avatar_url} onChange={(avatar_url) => setDraft({ ...form, avatar_url })} />
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-testimonial-sort">
              Sort order
            </label>
            <Input
              id="native-testimonial-sort"
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
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete testimonial
        </button>
      </div>

      <AdminConfirmSheet
        open={confirmDelete}
        title="Delete this testimonial?"
        description="Removes it from the homepage immediately. This can't be undone."
        confirmLabel="Yes, delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={confirmDeleteTestimonial}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
