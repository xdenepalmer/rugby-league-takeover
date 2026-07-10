import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Share2, Bookmark, BookmarkCheck, ALargeSmall, WifiOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import ArticleReader from "@/components/news/ArticleReader";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import { useNewsArticles } from "@/hooks/data/use-fan-data";
import {
  findArticle,
  findCachedArticle,
  relatedArticles,
  isArticleSaved,
  toggleSavedArticle,
  articlePath,
} from "@/lib/news-articles";
import { shareArticle } from "@/lib/native/share";
import { emitHaptic } from "@/lib/native/haptic-events";
import { hideBrokenImage } from "@/lib/img-fallback";

const TEXT_SCALES = [1, 1.125, 1.25];

/** Thin reading-progress bar under the top bar. */
function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? Math.min(1, window.scrollY / total) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="sticky top-[calc(env(safe-area-inset-top,0px)+3rem)] z-30 h-0.5 w-full bg-border/40" aria-hidden="true">
      <div className="h-full bg-primary transition-[width]" style={{ width: `${progress * 100}%` }} />
    </div>
  );
}

export default function NativeArticleScreen() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data: articles = [], isLoading, isError } = useNewsArticles();

  // Live list → cached list (react-query) → bounded offline cache.
  const article = useMemo(() => {
    const live = findArticle(articles, id);
    if (live) return live;
    const cachedList = queryClient.getQueryData(["news"]);
    return findArticle(cachedList, id) || findCachedArticle(id);
  }, [articles, id, queryClient]);

  const offlineOnly = !isLoading && !findArticle(articles, id) && !!article;
  const related = useMemo(() => relatedArticles(articles, article), [articles, article]);
  const [saved, setSaved] = useState(() => isArticleSaved(id));
  const [scaleIdx, setScaleIdx] = useState(0);

  useEffect(() => setSaved(isArticleSaved(id)), [id]);

  const actions = (
    <div className="flex items-center">
      <button
        type="button"
        aria-label="Text size"
        onClick={() => setScaleIdx((i) => (i + 1) % TEXT_SCALES.length)}
        className="ios-pressable flex h-11 w-11 items-center justify-center text-muted-foreground"
      >
        <ALargeSmall className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={saved ? "Remove bookmark" : "Bookmark article"}
        aria-pressed={saved}
        onClick={() => {
          const next = toggleSavedArticle(id);
          setSaved(next);
          emitHaptic("action.primary");
        }}
        className="ios-pressable flex h-11 w-11 items-center justify-center text-muted-foreground"
      >
        {saved ? <BookmarkCheck className="h-5 w-5 text-primary" aria-hidden="true" /> : <Bookmark className="h-5 w-5" aria-hidden="true" />}
      </button>
      <button
        type="button"
        aria-label="Share article"
        onClick={() => {
          emitHaptic("action.primary");
          shareArticle(article);
        }}
        className="ios-pressable flex h-11 w-11 items-center justify-center text-muted-foreground"
      >
        <Share2 className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <NativeTopBar title="Article" fallback="/news" right={article ? actions : null} />
      {article && <ReadingProgress />}

      {isLoading && !article && (
        <div className="space-y-3 px-4 pt-4">
          <NativeSkeleton className="h-48 w-full" />
          <NativeSkeleton className="h-6 w-3/4" />
          <NativeSkeleton className="h-4 w-1/2" />
          <NativeSkeleton className="h-40 w-full" />
        </div>
      )}

      {!isLoading && !article && (
        <div className="px-4 pt-8">
          <NativeEmptyState
            icon={WifiOff}
            title={isError ? "Article unavailable" : "Article not found"}
            description="It may have been unpublished, or you're offline and it isn't in your recent reads."
          />
        </div>
      )}

      {article && (
        <>
          {offlineOnly && (
            <p className="mx-4 mt-3 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-300">
              Offline copy — reconnect for the latest version
            </p>
          )}
          <ArticleReader article={article} textScale={TEXT_SCALES[scaleIdx]} />

          {related.length > 0 && (
            <div className="mx-auto w-full max-w-2xl px-4 pb-10">
              <p className="pb-3 text-[10px] font-black uppercase tracking-[0.25em] text-primary">More like this</p>
              <div className="space-y-2">
                {related.map((rel) => (
                  <Link
                    key={rel.id}
                    to={articlePath(rel)}
                    className="ios-pressable flex items-center gap-3 border border-border/50 bg-card/40 p-3"
                  >
                    {rel.image_url && (
                      <img src={rel.image_url} alt="" onError={hideBrokenImage} className="h-14 w-20 shrink-0 border border-border/40 object-cover" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{rel.category || "News"}</span>
                      <span className="line-clamp-2 text-sm font-bold leading-snug">{rel.title}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
