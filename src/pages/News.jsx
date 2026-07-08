import React, { lazy, Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Newspaper } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { getRecentNews, saveRecentNews } from "@/lib/recent-news";
import { isNativeApp } from "@/lib/native/native-env";
import PullToRefresh from "@/components/PullToRefresh";

const NewsSection = lazy(() => import("@/components/public/NewsSection"));

// The native iOS app ships its own News reader — a purpose-built native surface
// rather than the web News page. Lazy so the web bundle never pays for it.
// isNativeApp() is fixed for the session, so the early return in News() can't
// change hook order between renders.
const NativeNews = lazy(() => import("@/components/native/NativeNews"));

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

export default function News() {
  if (isNativeApp()) {
    return (
      <Suspense fallback={<div className="min-h-dvh bg-background" />}>
        <NativeNews />
      </Suspense>
    );
  }
  return <WebNews />;
}

function WebNews() {
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
    // Offline/error fallback order: last successful fetch, then static copy.
    const source = articles.length ? articles : (getRecentNews().length ? getRecentNews() : fallbackNews);
    return source.filter((article) => article.is_published !== false);
  }, [articles]);

  return (
    <PullToRefresh queryKeys={[["news"]]}>
    <main className="min-h-screen bg-background pt-[calc(6rem+env(safe-area-inset-top,0px))] text-foreground">
      <h1 className="sr-only">Rugby League Takeover — Latest News</h1>
      {isLoading ? (
        <section className="px-5 py-24 md:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex items-center gap-3 text-primary">
              <Newspaper className="h-6 w-6" />
              <span className="text-[10px] font-bold uppercase tracking-[0.35em]">Latest News</span>
            </div>
            <div className="mb-6 h-[380px] animate-pulse border border-border bg-card/40" />
            <div className="grid gap-6 md:grid-cols-3">
              {[1, 2, 3].map((item) => <div key={item} className="h-80 animate-pulse border border-border bg-card/40" />)}
            </div>
          </div>
        </section>
      ) : (
        <Suspense fallback={<div className="mx-auto h-[450px] max-w-7xl animate-pulse border-y border-border/20 bg-muted/5" />}>
          <NewsSection articles={visibleArticles} settings={{ news_eyebrow: "Latest News", news_title: "Rugby League Takeover news", news_description: "Official updates, announcements and supporter stories for the Las Vegas takeover." }} />
        </Suspense>
      )}
    </main>
    </PullToRefresh>
  );
}