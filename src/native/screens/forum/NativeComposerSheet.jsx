import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import MentionTextarea from "@/components/forum/MentionTextarea";
import MediaAttach from "@/components/forum/MediaAttach";
import { FORUM_CATEGORIES } from "@/lib/public-forms";
import { useAuth } from "@/lib/AuthContext";
import { useSubmitForumPost } from "@/hooks/data/use-forum-actions";
import { emitHaptic } from "@/lib/native/haptic-events";

export const NATIVE_THREAD_DRAFT_KEY = "rlt_native_forum_draft";
const EMPTY = { title: "", body: "", category: "General", media_url: "", author_name: "" };

const loadDraft = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(NATIVE_THREAD_DRAFT_KEY) || "null");
    return parsed && typeof parsed === "object" ? { ...EMPTY, ...parsed } : EMPTY;
  } catch {
    return EMPTY;
  }
};

/**
 * Full-screen native thread composer. Draft auto-persists (debounced) under
 * its own native key so an interrupted post survives an app kill; posting
 * goes through the shared submitForumPost contract.
 */
export default function NativeComposerSheet({ open, onClose, prefill }) {
  const { isAuthenticated } = useAuth();
  const [draft, setDraft] = useState(EMPTY);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!open) return;
    const base = loadDraft();
    setDraft(prefill ? { ...base, ...prefill } : base);
  }, [open, prefill]);

  useEffect(() => {
    if (!open) return undefined;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(NATIVE_THREAD_DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // best-effort
      }
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [draft, open]);

  const submitMutation = useSubmitForumPost({
    onSuccess: () => {
      try {
        localStorage.removeItem(NATIVE_THREAD_DRAFT_KEY);
      } catch {
        // best-effort
      }
      setDraft(EMPTY);
      onClose();
    },
  });

  const canPost = draft.title.trim() && draft.body.trim() && (isAuthenticated || draft.author_name.trim());
  const update = (field, value) => setDraft((d) => ({ ...d, [field]: value }));

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="New discussion">
          <motion.div
            className="absolute inset-0 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.section
            className="ios-sheet absolute inset-x-0 bottom-0 flex max-h-[94dvh] flex-col border-t border-border bg-card"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 380 }}
            onAnimationComplete={() => open && emitHaptic("sheet.snap")}
          >
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))]">
              <button type="button" onClick={onClose} className="ios-pressable min-h-11 px-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Cancel
              </button>
              <h2 className="font-display text-sm font-bold uppercase tracking-widest">New Discussion</h2>
              <button
                type="button"
                disabled={!canPost || submitMutation.isPending}
                onClick={() => {
                  emitHaptic("action.primary");
                  submitMutation.mutate(draft);
                }}
                className="ios-pressable min-h-11 bg-primary px-4 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
              >
                {submitMutation.isPending ? "Posting…" : "Post"}
              </button>
            </div>

            <div className="ios-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4 pb-[max(1.5rem,var(--safe-bottom))]">
              {!isAuthenticated && (
                <Input
                  value={draft.author_name}
                  onChange={(e) => update("author_name", e.target.value)}
                  placeholder="Your name"
                  aria-label="Your name"
                  className="h-12 rounded-none border-border bg-background"
                />
              )}
              <Input
                value={draft.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Thread title"
                aria-label="Thread title"
                maxLength={120}
                className="h-12 rounded-none border-border bg-background font-bold"
              />
              <div className="ios-scroll flex gap-2 overflow-x-auto py-1" role="radiogroup" aria-label="Category">
                {FORUM_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    role="radio"
                    aria-checked={draft.category === cat}
                    onClick={() => update("category", cat)}
                    className={`ios-pressable min-h-10 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                      draft.category === cat ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <MentionTextarea
                value={draft.body}
                onChange={(e) => update("body", e.target.value)}
                placeholder="What's happening, legend?"
                aria-label="Message"
                rows={7}
                maxLength={2000}
                className="w-full resize-none border border-border bg-background p-3 text-sm leading-relaxed outline-none focus:border-primary"
              />
              <MediaAttach value={draft.media_url} onChange={(url) => update("media_url", url)} />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Posts go live instantly — keep it in the spirit of the takeover.
              </p>
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
