import { useId, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Newspaper,
  Plus,
  Upload,
  X,
  Trash2,
  Eye,
  EyeOff,
  Save,
  ImageIcon,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import AdminConfirmSheet from "@/components/admin/shared/AdminConfirmSheet";
import PullToRefresh from "@/components/PullToRefresh";
import { emitHaptic } from "@/lib/native/haptic-events";
import { useWindowedList } from "@/hooks/use-windowed-list";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  NEWS_FILTERS,
  filterNews,
  newsCounts,
  emptyNewsArticle,
  buildArticleEditPayload,
  buildPublishTogglePayload,
  canCreateArticle,
  isArticlePublished,
} from "./news-helpers.js";

/**
 * Native News workflow — payload parity with the web NewsManager: same
 * entity (NewsArticle), same query key (["news"], shared with the web
 * panel's cache), same full-field update payloads, same upload call. The
 * web manager dispatches no rlt_admin_log events for news, so none are
 * emitted here either.
 */
const useNews = () =>
  useQuery({
    queryKey: ["news"],
    queryFn: () => base44.entities.NewsArticle.list("-published_date", 50),
    enabled: appParams.hasBase44Config,
    staleTime: 60000,
  });

/** Web parity: NewsManager invalidates AND refetches ["news"] after every write. */
const useNewsRefresh = () => {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ["news"] });
    await queryClient.refetchQueries({ queryKey: ["news"] });
  };
};

const formatDate = (value) => {
  if (!value) return "No date";
  try {
    return new Date(value + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "No date";
  }
};

function StatusBadge({ article }) {
  const published = isArticlePublished(article);
  return (
    <span
      className={`border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
        published ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-border bg-muted/20 text-muted-foreground"
      }`}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

/**
 * Native image control: paste a URL or upload from the photo library through
 * the EXACT client call the web ImageField uses
 * (base44.integrations.Core.UploadFile). Remove is always visible — no
 * hover-gated affordances on touch.
 */
function NativeImageField({ value, onChange }) {
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
      toast({ title: "Image upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Article image</p>
      {value ? (
        <div className="flex items-start gap-3">
          <div className="h-20 w-20 shrink-0 overflow-hidden border border-border bg-secondary">
            <img src={value} alt="Article" className="h-full w-full object-cover" />
          </div>
          <button
            type="button"
            onClick={() => {
              emitHaptic("action.primary");
              onChange("");
            }}
            className="ios-pressable flex min-h-11 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Remove image
          </button>
        </div>
      ) : null}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste image URL"
        aria-label="Image URL"
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
        {uploading ? "Uploading…" : "Upload image"}
      </label>
    </div>
  );
}

/** Shared field set — the same six fields the web create/edit forms write. */
function ArticleFields({ draft, setDraft, idPrefix }) {
  const set = (patch) => setDraft({ ...draft, ...patch });
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-title`}>
          Title
        </label>
        <Input
          id={`${idPrefix}-title`}
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Article title"
          className="h-11 rounded-none border-border bg-background"
        />
      </div>
      <div className="grid gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-date`}>
          Published date
        </label>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          value={draft.published_date}
          onChange={(e) => set({ published_date: e.target.value })}
          className="h-11 rounded-none border-border bg-background"
        />
      </div>
      <div className="grid gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-author`}>
          Author
        </label>
        <Input
          id={`${idPrefix}-author`}
          value={draft.author}
          onChange={(e) => set({ author: e.target.value })}
          placeholder="Author name"
          className="h-11 rounded-none border-border bg-background"
        />
      </div>
      <div className="flex min-h-11 items-center justify-between border border-border/60 bg-card/50 px-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {draft.is_published ? "Published (live)" : "Draft (hidden)"}
        </span>
        <Switch
          checked={draft.is_published}
          onCheckedChange={(value) => set({ is_published: value })}
          aria-label="Published"
        />
      </div>
      <NativeImageField value={draft.image_url} onChange={(url) => set({ image_url: url })} />
      <div className="grid gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-body`}>
          Article body
        </label>
        <Textarea
          id={`${idPrefix}-body`}
          value={draft.body}
          onChange={(e) => set({ body: e.target.value })}
          placeholder="Write the article body…"
          className="min-h-36 rounded-none border-border bg-background"
        />
      </div>
    </div>
  );
}

/** Native news list — /admin/content/news */
export default function NativeNewsList() {
  const navigate = useNavigate();
  const { data: articles = [], isLoading } = useNews();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const counts = useMemo(() => newsCounts(articles), [articles]);
  const visible = useMemo(() => filterNews(articles, { query, filter }), [articles, query, filter]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, { initial: 15, step: 15, restoreKey: "admin-news" });

  return (
    <div>
      <NativeTopBar
        title="News"
        fallback="/admin/content"
        right={
          <button
            type="button"
            aria-label="New article"
            onClick={() => {
              emitHaptic("action.primary");
              navigate("/admin/content/news/new");
            }}
            className="ios-pressable flex h-11 min-w-11 items-center justify-center text-primary"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        }
      />
      <PullToRefresh queryKeys={[["news"]]}>
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 border border-border bg-card/50 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, body, author"
              aria-label="Search articles"
              className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="ios-scroll flex gap-2 overflow-x-auto py-2">
            {NEWS_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => {
                  emitHaptic("tab.select");
                  setFilter(f.key);
                }}
                className={`ios-pressable min-h-9 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                  filter === f.key ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
                }`}
              >
                {f.label} ({counts[f.key] ?? 0})
              </button>
            ))}
          </div>
        </div>

        {isLoading && articles.length === 0 ? (
          <div className="space-y-2 px-4">
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState
              icon={Newspaper}
              title="No articles here"
              description="Nothing matches this filter. Tap + to write the first story."
            />
          </div>
        ) : (
          <div>
            {windowed.map((article) => (
              <button
                key={article.id}
                type="button"
                onClick={() => {
                  emitHaptic("tab.select");
                  navigate(`/admin/content/news/${encodeURIComponent(article.id)}`);
                }}
                className="ios-pressable flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left"
              >
                {article.image_url ? (
                  <img src={article.image_url} alt="" className="h-12 w-12 shrink-0 border border-border/40 object-cover" />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-border/40 bg-muted/20">
                    <ImageIcon className="h-5 w-5 text-muted-foreground/40" aria-hidden="true" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{article.title || "Untitled Article"}</span>
                  <span className="block truncate pt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {formatDate(article.published_date)} {article.author ? `· ${article.author}` : ""}
                  </span>
                </span>
                <StatusBadge article={article} />
              </button>
            ))}
            {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}

/** Native article compose — /admin/content/news/new */
export function NativeNewsCompose() {
  const navigate = useNavigate();
  const refreshNews = useNewsRefresh();
  const [draft, setDraft] = useState(emptyNewsArticle);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.NewsArticle.create(data),
    onSuccess: async () => {
      emitHaptic("save.success");
      await refreshNews();
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Could not create article", description: error.message, variant: "destructive" });
    },
  });

  const submit = async () => {
    if (!canCreateArticle(draft) || createMutation.isPending) return;
    emitHaptic("action.primary");
    try {
      await createMutation.mutateAsync(draft);
    } catch {
      return; // onError already surfaced the failure; stay on the form
    }
    navigate("/admin/content/news", { replace: true });
  };

  return (
    <div className="pb-10">
      <NativeTopBar title="New Article" fallback="/admin/content/news" />
      <div className="space-y-4 px-4 pt-3">
        <div className="border border-border/60 bg-card/50 p-3">
          <ArticleFields draft={draft} setDraft={setDraft} idPrefix="native-news-new" />
        </div>
        <button
          type="button"
          disabled={!canCreateArticle(draft) || createMutation.isPending}
          onClick={submit}
          className="ios-pressable flex min-h-12 w-full items-center justify-center gap-2 bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {createMutation.isPending ? "Saving…" : draft.is_published ? "Publish article" : "Save draft"}
        </button>
        {!canCreateArticle(draft) && (
          <p className="text-[10px] uppercase tracking-widest text-amber-300">Add a title before saving</p>
        )}
      </div>
    </div>
  );
}

/** Native article detail + editor — /admin/content/news/:articleId */
export function NativeNewsDetail() {
  const { articleId } = useParams();
  const navigate = useNavigate();
  const refreshNews = useNewsRefresh();
  const { data: articles = [], isLoading } = useNews();
  const article = useMemo(() => articles.find((a) => String(a.id) === String(articleId)) || null, [articles, articleId]);

  const [draft, setDraft] = useState(null); // lazily seeded from the article
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editDraft = draft ?? buildArticleEditPayload(article || {});

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.NewsArticle.update(id, data),
    onSuccess: async () => {
      emitHaptic("save.success");
      await refreshNews();
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Could not save article", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.NewsArticle.delete(id),
    onSuccess: refreshNews,
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Could not delete article", description: error.message, variant: "destructive" });
    },
  });

  if (!isLoading && !article) {
    return (
      <div>
        <NativeTopBar title="Article" fallback="/admin/content/news" />
        <div className="px-4 pt-6">
          <NativeEmptyState icon={Newspaper} title="Article not found" description="It may have been deleted, or you're offline." />
        </div>
      </div>
    );
  }
  if (!article) {
    return (
      <div>
        <NativeTopBar title="Article" fallback="/admin/content/news" />
        <div className="space-y-2 px-4 pt-4">
          <NativeSkeleton className="h-24 w-full" />
          <NativeSkeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const published = isArticlePublished(article);

  const save = () => {
    emitHaptic("action.primary");
    // Full six-field payload, exactly like the web EditForm save.
    updateMutation.mutate({ id: article.id, data: editDraft });
  };

  const togglePublish = () => {
    emitHaptic("action.primary");
    updateMutation.mutate({ id: article.id, data: buildPublishTogglePayload(article) });
    setDraft(null); // re-seed the form from the fresh server state
  };

  const confirmDeleteArticle = async () => {
    try {
      await deleteMutation.mutateAsync(article.id);
    } catch {
      setConfirmDelete(false);
      return; // onError already surfaced the failure
    }
    emitHaptic("save.success");
    setConfirmDelete(false);
    navigate("/admin/content/news", { replace: true });
  };

  return (
    <div className="pb-10">
      <NativeTopBar title={article.title || "Article"} fallback="/admin/content/news" />
      <div className="space-y-4 px-4 pt-3">
        {/* Status + quick actions */}
        <div className="border border-border/60 bg-card/50 p-3">
          <div className="flex items-center justify-between">
            <StatusBadge article={article} />
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {formatDate(article.published_date)} {article.author ? `· ${article.author}` : ""}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-3">
            <button
              type="button"
              disabled={updateMutation.isPending}
              onClick={togglePublish}
              className={`ios-pressable flex min-h-11 items-center justify-center gap-1.5 border text-xs font-bold uppercase tracking-widest disabled:opacity-40 ${
                published ? "border-border text-muted-foreground" : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {published ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
              {published ? "Unpublish" : "Publish"}
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

        {/* Editor */}
        <div className="border border-border/60 bg-card/50 p-3">
          <p className="pb-3 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Edit article</p>
          <ArticleFields draft={editDraft} setDraft={setDraft} idPrefix="native-news-edit" />
          <button
            type="button"
            disabled={updateMutation.isPending}
            onClick={save}
            className="ios-pressable mt-4 flex min-h-12 w-full items-center justify-center gap-2 bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <AdminConfirmSheet
        open={confirmDelete}
        title="Delete this article?"
        description="Removes the article from the public site permanently. This cannot be undone."
        confirmLabel="Delete article"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={confirmDeleteArticle}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
