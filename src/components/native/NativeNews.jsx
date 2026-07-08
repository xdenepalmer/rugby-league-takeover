/**
 * Native iOS News — a purpose-built native reader for the Rugby League Takeover
 * app, NOT the web News page. Reached via the isNativeApp() branch in
 * src/pages/News.jsx; the web News tree is untouched.
 *
 * Reuses the EXACT same React Query key (["news"]) and query as the web News
 * page, so the cache is shared and hydrates instantly, and reuses the same
 * NewsArticle data shape, published filtering, offline fallback (recent-news),
 * and article reader affordance (PublicDetailSheet — the same bottom sheet the
 * web NewsSection opens on tap).
 */
import React, { lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Newspaper, Calendar, Clock, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { getRecentNews, saveRecentNews } from "@/lib/recent-news";
import { hideBrokenImage } from "@/lib/img-fallback";
import { lightImpact } from "@/lib/native/haptics";
import PullToRefresh from "@/components/PullToRefresh";

// Same detail affordance the web NewsSection uses — lazy so the sheet's cost is
// only paid the first time a fan opens an article.
const PublicDetailSheet = lazy(() => import("@/components/public/PublicDetailSheet"));

// Offline/first-launch copy — mirrors the web News page's fallback shape so the
// native reader is never blank on a cold, connection-less launch.
const fallbackNews = [
  {
    title: "Rugby League Takeover lands in Las Vegas",
    body: "The supporter invasion is building. Rugby League fans from across Australia and around the world are preparing for another unforgettable Vegas week.",
    image_url: "https://images.unsplash.com/photo-1605833556294-ea5c7a74f57d?auto=format&fit=crop&w=1200&q=80",
    published_date: "2026-03-01",
    author: "RLT Vegas",
    is_published: true,
  },
  {
    title: "Travel packages coming soon",
    body: "Air, accommodation, events and supporter extras are being prepared. Register your interest to be first to hear when packages drop.",
    image_url: "https://images.unsplash.com/photo-1581351721010-8cf859cb14a4?auto=format&fit=crop&w=1200&q=80",
    published_date: "2026-02-15",
    author: "RLT Vegas",
    is_published: true,
  },
  {
    title: "Vegas event plans taking shape",
    body: "From supporter meetups to poolside celebrations, more details will be revealed as the annual takeover approaches.",
    image_url: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1200&q=80",
    published_date: "2026-02-01",
    author: "RLT Vegas",
    is_published: true,
  },
];

const safeFormatDate = (dateStr, fmt = "dd MMM yyyy") => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : format(d, fmt);
  } catch {
    return null;
  }
};

const readingTime = (text) => {
  if (!text) return "1 min read";
  const words = text.trim().split(/\s+/).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
};

function Skeleton() {
  return (
    <div className="nt-stack" aria-hidden="true">
      <div className="nt-raised nt-e2 overflow-hidden border border-border/50">
        <div className="skeleton-shimmer aspect-[16/9] w-full" />
        <div className="space-y-2 p-4">
          <div className="skeleton-shimmer h-5 w-3/4" />
          <div className="skeleton-shimmer h-4 w-full" />
          <div className="skeleton-shimmer h-4 w-2/5" />
        </div>
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 border-b border-border/40 pb-4">
          <div className="skeleton-shimmer h-16 w-24 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2 py-0.5">
            <div className="skeleton-shimmer h-4 w-11/12" />
            <div className="skeleton-shimmer h-4 w-1/2" />
            <div className="skeleton-shimmer h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NativeNews() {
  const [selected, setSelected] = useState(null);

  // EXACT same key + query as src/pages/News.jsx — the cache entry is shared.
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["news"],
    queryFn: async () => {
      const fetched = await base44.entities.NewsArticle.list("-published_date", 50);
      saveRecentNews(fetched);
      return fetched;
    },
    enabled: appParams.hasBase44Config,
  });

  const visibleArticles = useMemo(() => {
    // Offline/error fallback order: live fetch, then last successful fetch, then static copy.
    const source = articles.length ? articles : (getRecentNews().length ? getRecentNews() : fallbackNews);
    return source.filter((article) => article.is_published !== false);
  }, [articles]);

  const [lead, ...rest] = visibleArticles;

  const open = (article) => {
    lightImpact();
    setSelected(article);
  };

  return (
    <PullToRefresh queryKeys={[["news"]]}>
      <main className="min-h-dvh bg-background text-foreground nt-legible-floor pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto w-full max-w-xl nt-gutter-x nt-stack">
          {/* Large-title header */}
          <div className="pb-1">
            <p className="nt-caption font-bold uppercase tracking-[0.22em] text-primary">
              <span className="inline-flex items-center gap-1.5">
                <Newspaper className="h-3.5 w-3.5" /> Latest
              </span>
            </p>
            <h1 className="nt-large-title mt-0.5 text-foreground">News</h1>
          </div>

          {isLoading ? (
            <Skeleton />
          ) : visibleArticles.length === 0 ? (
            <div className="nt-raised nt-e1 flex flex-col items-center justify-center border border-border/50 px-6 py-20 text-center">
              <Newspaper className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="nt-subhead font-bold text-foreground">No stories yet</p>
              <p className="nt-footnote mt-1 text-muted-foreground">
                Fresh takeover news lands here. Pull to refresh or check back soon.
              </p>
            </div>
          ) : (
            <>
              {/* Featured lead story */}
              {lead && (
                <button
                  type="button"
                  onClick={() => open(lead)}
                  className="ios-pressable block w-full text-left"
                >
                  <div className="nt-raised nt-e2 overflow-hidden border border-border/50">
                    <div className="relative aspect-[16/9] overflow-hidden border-b border-border/40 bg-muted/20">
                      {lead.image_url && (
                        <img
                          src={lead.image_url}
                          alt={lead.title}
                          loading="lazy"
                          onError={hideBrokenImage}
                          className="h-full w-full object-cover"
                        />
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                      {lead.category && (
                        <span className="absolute left-3 top-3 border border-primary/25 bg-primary/10 px-2 py-0.5 nt-caption font-bold uppercase tracking-wider text-primary">
                          {lead.category}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <h2 className="nt-title font-bold text-foreground">{lead.title}</h2>
                      {lead.body && (
                        <p className="nt-subhead mt-1.5 line-clamp-2 text-slate-300">{lead.body}</p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 nt-footnote text-muted-foreground">
                        {safeFormatDate(lead.published_date) && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            {safeFormatDate(lead.published_date)}
                          </span>
                        )}
                        {lead.author && <span>By {lead.author}</span>}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {readingTime(lead.body)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* Remaining articles — native list */}
              {rest.length > 0 && (
                <div className="nt-raised nt-e1 overflow-hidden border border-border/50">
                  {rest.map((article, i) => (
                    <button
                      key={article.id || i}
                      type="button"
                      onClick={() => open(article)}
                      className={`ios-pressable flex w-full items-center gap-3 p-3 text-left ${i > 0 ? "border-t border-border/40" : ""}`}
                    >
                      <div className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden border border-border/40 bg-muted/20">
                        {article.image_url ? (
                          <img
                            src={article.image_url}
                            alt={article.title}
                            loading="lazy"
                            onError={hideBrokenImage}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Newspaper className="h-5 w-5 text-primary/40" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="nt-subhead line-clamp-2 font-bold text-foreground">{article.title}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 nt-caption text-muted-foreground">
                          {safeFormatDate(article.published_date) && (
                            <span>{safeFormatDate(article.published_date)}</span>
                          )}
                          <span className="text-muted-foreground/40">·</span>
                          <span>{readingTime(article.body)}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {selected && (
        <Suspense fallback={null}>
          <PublicDetailSheet
            isOpen={!!selected}
            onClose={() => setSelected(null)}
            title={selected.title}
            category={selected.category || "News"}
            date={safeFormatDate(selected.published_date) || undefined}
            author={selected.author || "RLT Staff"}
            image={selected.image_url}
            body={selected.body}
            readingTime={readingTime(selected.body)}
          />
        </Suspense>
      )}
    </PullToRefresh>
  );
}
