import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Share2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import ArticleReader from "@/components/news/ArticleReader";
import { useNewsArticles } from "@/hooks/data/use-fan-data";
import { findArticle, findCachedArticle, relatedArticles, articlePath } from "@/lib/news-articles";
import { shareArticle } from "@/lib/native/share";

/**
 * Web article page for the canonical /news/:id links (produced by the
 * native app's share sheet and push/deep links). Renders inside
 * PublicLayout; the list page at /news is unchanged.
 */
export default function NewsArticle() {
  const { id } = useParams();
  const { data: articles = [] } = useNewsArticles();

  const { data: fetchedById, isLoading } = useQuery({
    queryKey: ["newsArticle", id],
    queryFn: () => base44.entities.NewsArticle.get(id),
    enabled: appParams.hasBase44Config && !!id && !findArticle(articles, id),
    retry: 1,
    meta: { silent: true },
  });

  const article = useMemo(
    () => findArticle(articles, id) || fetchedById || findCachedArticle(id),
    [articles, id, fetchedById]
  );
  const related = useMemo(() => relatedArticles(articles, article), [articles, article]);

  return (
    <main className="min-h-dvh bg-background pb-16 pt-[calc(5.5rem+env(safe-area-inset-top,0px))]">
      <div className="mx-auto w-full max-w-2xl px-2">
        <div className="flex items-center justify-between px-2 pb-3">
          <Link
            to="/news"
            className="flex min-h-11 items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All news
          </Link>
          {article && (
            <button
              type="button"
              onClick={() => shareArticle(article)}
              className="flex min-h-11 items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" /> Share
            </button>
          )}
        </div>

        {!article && (
          <div className="border border-border bg-card px-6 py-12 text-center">
            <h1 className="font-display text-xl font-bold uppercase tracking-widest">
              {isLoading ? "Loading article…" : "Article not found"}
            </h1>
            {!isLoading && (
              <p className="pt-2 text-sm text-muted-foreground">
                It may have been unpublished. <Link to="/news" className="text-primary underline">Browse the latest news.</Link>
              </p>
            )}
          </div>
        )}

        {article && <ArticleReader article={article} />}

        {article && related.length > 0 && (
          <div className="px-4 pb-6">
            <p className="pb-3 text-[10px] font-black uppercase tracking-[0.25em] text-primary">More like this</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {related.map((rel) => (
                <Link key={rel.id} to={articlePath(rel)} className="border border-border/60 bg-card/40 p-3 hover:border-primary/60">
                  <span className="block text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{rel.category || "News"}</span>
                  <span className="line-clamp-2 pt-1 text-sm font-bold leading-snug">{rel.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
