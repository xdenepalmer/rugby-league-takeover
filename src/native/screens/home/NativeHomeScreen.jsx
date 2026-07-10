import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plane, MessageSquare, Bell, LogIn, CalendarDays, Swords } from "lucide-react";
import PullToRefresh from "@/components/PullToRefresh";
import CountdownTimer from "@/components/public/CountdownTimer";
import { useAuth } from "@/lib/AuthContext";
import {
  useSiteSettings,
  useNewsArticles,
  useProducts,
  useMatchups,
  useEventContents,
  useForumPosts,
  useNotifications,
} from "@/hooks/data/use-fan-data";
import { buildForumThreads, countReplies } from "@/lib/public-forms";
import { getEngagement, getRecencyScore, timeAgo } from "@/components/forum/feed/forumHelpers";
import { articlePath } from "@/lib/news-articles";
import { productPath, formatAud } from "@/lib/store-products";
import { hideBrokenImage } from "@/lib/img-fallback";
import { emitHaptic } from "@/lib/native/haptic-events";
import { NativeSkeleton, NativeSectionHeader, NativeSponsorCard } from "../../components/NativePrimitives.jsx";

function ModuleCard({ children, className = "" }) {
  return <div className={`border border-border/60 bg-card/50 ${className}`}>{children}</div>;
}

/**
 * Native Home: a concise, personalised fan dashboard — countdown, latest
 * headline, trending thread, next matchup, upcoming event, merch drop and
 * the trip-planning CTA. The long marketing homepage stays web-only.
 */
export default function NativeHomeScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { settings, isLoading: settingsLoading } = useSiteSettings();
  const { data: news = [], isLoading: newsLoading } = useNewsArticles();
  const { data: products = [] } = useProducts();
  const { data: matchups = [] } = useMatchups();
  const { data: events = [] } = useEventContents();
  const { data: forumPosts = [] } = useForumPosts();
  const { data: notifications = [] } = useNotifications(user?.id);

  const headline = news.find((a) => a.is_published !== false) || null;
  const nextMatchup = matchups.find((m) => m.is_published !== false && m.home_team && m.away_team) || null;
  const upcomingEvent = events[0] || null;
  const drops = products.filter((p) => p.image_url).slice(0, 6);
  const unread = notifications.filter((n) => n.is_read !== true).length;

  const trendingThread = useMemo(() => {
    const threads = buildForumThreads(forumPosts);
    return (
      [...threads].sort(
        (a, b) =>
          getEngagement(b) * getRecencyScore(b.created_date) -
          getEngagement(a) * getRecencyScore(a.created_date)
      )[0] || null
    );
  }, [forumPosts]);

  const openPlanSheet = () => {
    emitHaptic("action.primary");
    window.dispatchEvent(new CustomEvent("rlt_open_plan"));
  };

  return (
    <PullToRefresh queryKeys={[["news"], ["forumPosts"], ["matchups"], ["events"], ["siteSettings"]]}>
      <div className="mx-auto w-full max-w-2xl px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        {/* Brand header */}
        <header className="pb-1 pr-28">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary">NRL · Las Vegas</p>
          <h1 className="font-display text-2xl font-bold uppercase tracking-widest">
            Rugby League <span className="text-primary">Takeover</span>
          </h1>
        </header>

        {/* Personal strip */}
        {isAuthenticated ? (
          <Link to="/account/notifications" className="ios-pressable mt-2 flex min-h-12 items-center gap-3 border border-border/60 bg-card/50 px-4">
            <Bell className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-widest">
              G'day {String(user?.full_name || "legend").split(" ")[0]}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {unread > 0 ? `${unread > 9 ? "9+" : unread} new` : "All caught up"}
            </span>
          </Link>
        ) : (
          <Link to="/login" className="ios-pressable mt-2 flex min-h-12 items-center gap-3 border border-primary/50 bg-primary/10 px-4">
            <LogIn className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-xs font-bold uppercase tracking-widest">
              Sign in to join the takeover crew
            </span>
          </Link>
        )}

        {/* Countdown (SiteSettings-driven, same component as the web) */}
        <div className="pt-3 [&_section]:!py-0">
          <CountdownTimer settings={settings} />
        </div>

        {/* Latest headline */}
        <NativeSectionHeader eyebrow="Latest" title="Headline" to="/news" />
        {newsLoading && !headline ? (
          <NativeSkeleton className="h-40 w-full" />
        ) : headline ? (
          <Link to={articlePath(headline)} className="ios-pressable block border border-border/60 bg-card/50">
            {headline.image_url && (
              <img src={headline.image_url} alt="" onError={hideBrokenImage} className="h-40 w-full object-cover" />
            )}
            <div className="p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-primary">
                {headline.category || "News"} · {timeAgo(headline.published_date)}
              </p>
              <p className="line-clamp-2 pt-1 font-display text-lg font-bold uppercase leading-tight tracking-wide">
                {headline.title}
              </p>
            </div>
          </Link>
        ) : null}

        {/* Trending thread */}
        {trendingThread && (
          <>
            <NativeSectionHeader eyebrow="Fan zone" title="Trending" to="/forum" />
            <Link
              to={`/forum/thread/${encodeURIComponent(trendingThread.id)}`}
              className="ios-pressable flex items-start gap-3 border border-border/60 bg-card/50 p-3"
            >
              <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm font-bold leading-snug">{trendingThread.title}</span>
                <span className="block pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {trendingThread.author_name} · {countReplies(trendingThread) - 1} replies · {getEngagement(trendingThread)} engagement
                </span>
              </span>
            </Link>
          </>
        )}

        {/* Next matchup + upcoming event */}
        {(nextMatchup || upcomingEvent) && (
          <div className="grid grid-cols-1 gap-2 pt-4">
            {nextMatchup && (
              <ModuleCard className="flex items-center gap-3 p-3">
                <Swords className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Next matchup</p>
                  <p className="truncate text-sm font-bold uppercase tracking-wide">
                    {nextMatchup.home_team} <span className="text-primary">v</span> {nextMatchup.away_team}
                  </p>
                  {nextMatchup.kickoff_label && (
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{nextMatchup.kickoff_label}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/forum")}
                  className="ios-pressable min-h-10 shrink-0 border border-primary/50 px-2.5 text-[9px] font-black uppercase tracking-widest text-primary"
                >
                  Tip it
                </button>
              </ModuleCard>
            )}
            {upcomingEvent && (
              <ModuleCard className="flex items-center gap-3 p-3">
                <CalendarDays className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">On the calendar</p>
                  <p className="truncate text-sm font-bold uppercase tracking-wide">{upcomingEvent.title || "Takeover event"}</p>
                  {upcomingEvent.subtitle && (
                    <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">{upcomingEvent.subtitle}</p>
                  )}
                </div>
              </ModuleCard>
            )}
          </div>
        )}

        {/* Trip planning CTA */}
        <button
          type="button"
          onClick={openPlanSheet}
          className="ios-pressable mt-4 flex min-h-14 w-full items-center gap-3 border border-primary/60 bg-primary/10 px-4 text-left"
        >
          <Plane className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black uppercase tracking-widest text-primary">Plan the trip</span>
            <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
              Flights, stays, tickets — the full Vegas run
            </span>
          </span>
        </button>

        {/* Merch drops */}
        {drops.length > 0 && (
          <>
            <NativeSectionHeader eyebrow="Official merch" title="Latest drop" to="/store" linkLabel="Shop" />
            <div className="ios-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
              {drops.map((product) => (
                <Link
                  key={product.id}
                  to={productPath(product)}
                  className="ios-pressable w-36 shrink-0 border border-border/60 bg-card/50"
                >
                  <img src={product.image_url} alt={product.name} onError={hideBrokenImage} loading="lazy" className="aspect-square w-full object-cover" />
                  <span className="block p-2">
                    <span className="line-clamp-1 text-[10px] font-bold uppercase tracking-wide">{product.name}</span>
                    <span className="block pt-0.5 text-xs font-black text-primary">{formatAud(product.price_aud)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}

        <div className="py-4">
          <NativeSponsorCard />
        </div>

        {settingsLoading && !headline && (
          <div className="space-y-3 pb-6">
            <NativeSkeleton className="h-24 w-full" />
            <NativeSkeleton className="h-24 w-full" />
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
