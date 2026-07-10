import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Newspaper, BookmarkCheck } from "lucide-react";
import PullToRefresh from "@/components/PullToRefresh";
import { useNewsArticles } from "@/hooks/data/use-fan-data";
import { saveRecentNews, getRecentNews } from "@/lib/recent-news";
import { articlePath, readingTimeMinutes, getSavedArticleIds } from "@/lib/news-articles";
import { timeAgo } from "@/components/forum/feed/forumHelpers";
import { hideBrokenImage } from "@/lib/img-fallback";
import { useWindowedList } from "@/hooks/use-windowed-list";
import { NativeSkeleton, NativeEmptyState, NativeSponsorCard } from "../../components/NativePrimitives.jsx";

function LeadCard({ article }) {
  return (
    <Link to={articlePath(article)} className="ios-pressable block border border-border/60 bg-card/50">
      {article.image_url && (
        <img src={article.image_url} alt="" onError={hideBrokenImage} className="h-52 w-full object-cover" />
      )}
      <div className="p-4">
        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-primary">
          {article.category || "Latest"} · {timeAgo(article.published_date)}
        </p>
        <h2 className="pt-1 font-display text-xl font-bold uppercase leading-tight tracking-wide">
          {article.title}
        </h2>
        <p className="line-clamp-2 pt-2 text-sm text-muted-foreground">{article.body}</p>
      </div>
    </Link>
  );
}

function ArticleRow({ article, saved }) {
  return (
    <Link
      to={articlePath(article)}
      className="ios-pressable flex min-h-[5.5rem] items-center gap-3 border-b border-border/40 px-4 py-3"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          {article.category || "News"} · {timeAgo(article.published_date)} · {readingTimeMinutes(article.body)} min
          {saved && <BookmarkCheck className="h-3 w-3 text-primary" aria-label="Saved" />}
        </span>
        <span className="line-clamp-2 pt-0.5 text-sm font-bold leading-snug">{article.title}</span>
      </span>
      {article.image_url && (
        <img src={article.image_url} alt="" onError={hideBrokenImage} className="h-16 w-24 shrink-0 border border-border/40 object-cover" />
      )}
    </Link>
  );
}

/**
 * Native News tab: lead story + scannable rows, pull-to-refresh, offline
 * fallback to the bounded recent-news cache. Every article opens the real
 * /news/:id reader route (deep-linkable, shareable).
 */
export default function NativeNewsScreen() {
  const { data: fetched = [], isLoading, isSuccess } = useNewsArticles();
  const [categoryFilter, setCategoryFilter] = useState("All");

  useEffect(() => {
    if (isSuccess && fetched.length) saveRecentNews(fetched);
  }, [isSuccess, fetched]);

  const articles = useMemo(() => {
    const source = fetched.length ? fetched : getRecentNews();
    return source.filter((a) => a?.is_published !== false);
  }, [fetched]);

  const categories = useMemo(() => {
    const set = new Set(articles.map((a) => a.category).filter(Boolean));
    return ["All", ...set];
  }, [articles]);

  const visible = categoryFilter === "All" ? articles : articles.filter((a) => a.category === categoryFilter);
  const [lead, ...rest] = visible;
  const { visible: windowedRest, sentinelRef, done } = useWindowedList(rest, { initial: 10, step: 10 });
  const savedIds = useMemo(() => new Set(getSavedArticleIds()), []);
  const offline = !isLoading && fetched.length === 0 && articles.length > 0;

  return (
    <PullToRefresh queryKeys={[["news"]]}>
      <div className="mx-auto w-full max-w-2xl pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <header className="px-4 pb-1">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary">Rugby League Takeover</p>
          <h1 className="font-display text-2xl font-bold uppercase tracking-widest">News</h1>
        </header>

        {categories.length > 2 && (
          <div className="ios-scroll flex gap-2 overflow-x-auto px-4 py-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                aria-pressed={categoryFilter === cat}
                className={`ios-pressable min-h-9 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                  categoryFilter === cat ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {offline && (
          <p className="mx-4 my-2 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-300">
            Offline — showing your recent reads
          </p>
        )}

        {isLoading && articles.length === 0 ? (
          <div className="space-y-3 px-4 pt-2">
            <NativeSkeleton className="h-64 w-full" />
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
          </div>
        ) : visible.length === 0 ? (
          <div className="px-4 pt-6">
            <NativeEmptyState icon={Newspaper} title="No stories yet" description="Fresh Vegas takeover news lands here first." />
          </div>
        ) : (
          <>
            <div className="px-4 pt-2">{lead && <LeadCard article={lead} />}</div>
            <div className="px-0 pt-2">
              {windowedRest.slice(0, 4).map((article) => (
                <ArticleRow key={article.id} article={article} saved={savedIds.has(String(article.id))} />
              ))}
            </div>
            {windowedRest.length > 0 && (
              <div className="px-4 py-2">
                <NativeSponsorCard />
              </div>
            )}
            <div>
              {windowedRest.slice(4).map((article) => (
                <ArticleRow key={article.id} article={article} saved={savedIds.has(String(article.id))} />
              ))}
              {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
            </div>
          </>
        )}
      </div>
    </PullToRefresh>
  );
}
