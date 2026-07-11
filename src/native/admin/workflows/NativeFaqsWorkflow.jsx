import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HelpCircle, Plus, Trash2, EyeOff } from "lucide-react";
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
  FAQ_SCOPES,
  faqScope,
  faqsForScope,
  faqScopeCounts,
  emptyFaqDraft,
  canCreateFaq,
  buildFaqCreatePayload,
  buildFaqUpdatePayload,
  hasFaqChanges,
} from "./faqs-helpers.js";

// Same query the web admin panels (and the wrapped FaqsModule) run — shared
// ["faqs"] cache key, so both surfaces stay in sync.
const useFaqs = () =>
  useQuery({
    queryKey: ["faqs"],
    queryFn: () => base44.entities.Faq.list("sort_order", 200),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

/**
 * Native FAQs workflow — /admin/content/faqs. Every write sends the exact
 * payloads the web FaqManager sends (Faq.create / Faq.update / Faq.delete)
 * and invalidates the same ["faqs"] key; server RLS stays the authority.
 * Both web scopes are covered: Store FAQs (merch store block, legacy
 * no-category rows included) and Website FAQs (the public /faq page).
 */
export default function NativeFaqsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: faqs = [], isLoading } = useFaqs();
  const [scopeKey, setScopeKey] = useState("store");
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(() => emptyFaqDraft("store"));
  const scope = faqScope(scopeKey);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Faq.create(data),
    onSuccess: () => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
      toast({ title: "FAQ added" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Could not add FAQ", description: error.message, variant: "destructive" });
    },
  });

  const counts = useMemo(() => faqScopeCounts(faqs), [faqs]);
  const visible = useMemo(() => faqsForScope(faqs, scopeKey), [faqs, scopeKey]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, {
    initial: 15,
    step: 15,
    restoreKey: `admin-faqs-${scopeKey}`,
  });

  const openAdd = () => {
    emitHaptic("action.primary");
    setDraft(emptyFaqDraft(scopeKey));
    setAddOpen(true);
  };

  // The add drawer awaits settlement so it only closes on a real save.
  const submitCreate = async () => {
    if (!canCreateFaq(draft) || createMutation.isPending) return;
    emitHaptic("action.primary");
    try {
      await createMutation.mutateAsync(buildFaqCreatePayload(draft, scope.key));
      setDraft(emptyFaqDraft(scope.key));
      setAddOpen(false);
    } catch {
      // onError already surfaced the failure; keep the drawer open.
    }
  };

  return (
    <div className="pb-8">
      <NativeTopBar
        title="FAQs"
        fallback="/admin/content"
        right={
          <button type="button" onClick={openAdd} aria-label="Add FAQ" className="ios-pressable flex h-11 min-w-11 items-center justify-center text-primary">
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        }
      />
      <PullToRefresh queryKeys={[["faqs"]]}>
        <div className="px-4 pt-3">
          <div className="ios-scroll flex gap-2 overflow-x-auto pb-2">
            {FAQ_SCOPES.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={scopeKey === s.key}
                onClick={() => {
                  emitHaptic("tab.select");
                  setScopeKey(s.key);
                }}
                className={`ios-pressable min-h-11 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                  scopeKey === s.key ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
                }`}
              >
                {s.label} ({counts[s.key] ?? 0})
              </button>
            ))}
          </div>
          <p className="pb-2 text-[10px] uppercase tracking-widest text-muted-foreground">{scope.description}</p>
        </div>

        {isLoading && faqs.length === 0 ? (
          <div className="space-y-2 px-4">
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-2">
            <NativeEmptyState
              icon={HelpCircle}
              title="No FAQs yet"
              description={`Nothing in ${scope.title} yet. Add your first question with the + button.`}
            />
          </div>
        ) : (
          <div>
            {windowed.map((faq) => (
              <button
                key={faq.id}
                type="button"
                onClick={() => {
                  emitHaptic("tab.select");
                  navigate(`/admin/content/faqs/${encodeURIComponent(faq.id)}`);
                }}
                className="ios-pressable flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left"
              >
                <span className="mt-0.5 shrink-0 border border-border bg-card/50 px-1.5 py-0.5 font-mono text-[10px] font-black text-muted-foreground">
                  {Number(faq.sort_order || 0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{faq.question || "Untitled question"}</span>
                  <span className="line-clamp-2 block pt-0.5 text-xs text-muted-foreground">{faq.answer || "No answer yet"}</span>
                </span>
                {faq.is_published === false && (
                  <span className="mt-0.5 flex shrink-0 items-center gap-1 border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-300">
                    <EyeOff className="h-3 w-3" aria-hidden="true" /> Draft
                  </span>
                )}
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
        title={`Add to ${scope.title}`}
        description={scope.description}
      >
        <div className="grid gap-3 py-2">
          <Input
            placeholder={scope.placeholder}
            aria-label="Question"
            value={draft.question}
            onChange={(e) => setDraft({ ...draft, question: e.target.value })}
            className="h-11 rounded-none border-border bg-background"
          />
          <Textarea
            placeholder="Answer"
            aria-label="Answer"
            value={draft.answer}
            onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
            className="min-h-24 rounded-none border-border bg-background"
          />
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
            disabled={!canCreateFaq(draft) || createMutation.isPending}
            onClick={submitCreate}
            className="ios-pressable flex min-h-11 items-center justify-center bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            {createMutation.isPending ? "Adding…" : "Add FAQ"}
          </button>
        </div>
      </MobileActionDrawer>
    </div>
  );
}

/** Native FAQ editor — /admin/content/faqs/:faqId */
export function NativeFaqDetail() {
  const { faqId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: faqs = [], isLoading } = useFaqs();
  const faq = useMemo(() => faqs.find((f) => String(f.id) === String(faqId)) || null, [faqs, faqId]);

  const [draft, setDraft] = useState(null); // lazily seeded from the record
  const [confirmDelete, setConfirmDelete] = useState(false);
  const form = draft ?? {
    question: faq?.question || "",
    answer: faq?.answer || "",
    sort_order: faq?.sort_order ?? 1,
    is_published: faq?.is_published !== false,
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Faq.update(id, data),
    onSuccess: () => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
      toast({ title: "FAQ saved" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Could not save FAQ", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Faq.delete(id),
    onSuccess: () => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
      toast({ title: "FAQ removed" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Could not delete FAQ", description: error.message, variant: "destructive" });
    },
  });

  const saveChanges = async () => {
    if (!faq || !hasFaqChanges(faq, form) || updateMutation.isPending) return;
    emitHaptic("action.primary");
    try {
      await updateMutation.mutateAsync({ id: faq.id, data: buildFaqUpdatePayload(faq, form) });
      setDraft(null); // re-seed from the fresh record
    } catch {
      // onError already surfaced the failure; edits stay in the form.
    }
  };

  const confirmDeleteFaq = async () => {
    if (!faq || deleteMutation.isPending) return;
    try {
      await deleteMutation.mutateAsync(faq.id);
      setConfirmDelete(false);
      navigate("/admin/content/faqs", { replace: true });
    } catch {
      setConfirmDelete(false);
    }
  };

  if (!isLoading && !faq) {
    return (
      <div>
        <NativeTopBar title="FAQ" fallback="/admin/content/faqs" />
        <div className="px-4 pt-6">
          <NativeEmptyState icon={HelpCircle} title="FAQ not found" description="It may have been removed, or you're offline." />
        </div>
      </div>
    );
  }
  if (!faq) {
    return (
      <div>
        <NativeTopBar title="FAQ" fallback="/admin/content/faqs" />
        <div className="space-y-2 px-4 pt-4">
          <NativeSkeleton className="h-24 w-full" />
          <NativeSkeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const scope = faqScope(faq.category === "general" ? "general" : "store");
  const dirty = hasFaqChanges(faq, form);

  return (
    <div className="pb-10">
      <NativeTopBar title="Edit FAQ" fallback="/admin/content/faqs" />
      <div className="space-y-4 px-4 pt-3">
        <div className="border border-border/60 bg-card/50 p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">{scope.title}</p>
          <p className="pt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{scope.description}</p>
        </div>

        <div className="border border-border/60 bg-card/50 p-3">
          <div className="grid gap-3">
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-faq-question">
              Question
            </label>
            <Input
              id="native-faq-question"
              placeholder={scope.placeholder}
              value={form.question}
              onChange={(e) => setDraft({ ...form, question: e.target.value })}
              className="h-11 rounded-none border-border bg-background"
            />
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-faq-answer">
              Answer
            </label>
            <Textarea
              id="native-faq-answer"
              placeholder="Answer"
              value={form.answer}
              onChange={(e) => setDraft({ ...form, answer: e.target.value })}
              className="min-h-32 rounded-none border-border bg-background"
            />
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-faq-sort">
              Sort order
            </label>
            <Input
              id="native-faq-sort"
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
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete FAQ
        </button>
      </div>

      <AdminConfirmSheet
        open={confirmDelete}
        title="Delete this FAQ?"
        description="Removes it from the site immediately. This can't be undone."
        confirmLabel="Yes, delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={confirmDeleteFaq}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
