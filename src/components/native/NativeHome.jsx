/**
 * Native iOS Home — "Takeover HQ". A personalized companion dashboard for a fan
 * heading to the Vegas takeover, NOT the web marketing landing. Native-only:
 * reached via the isNativeApp() branch in src/pages/Home.jsx; the web Home is
 * untouched. Reuses the exact same React Query keys as the web app, so the
 * cache is shared and hydrates instantly.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight, CalendarDays, Coins, Flame, MapPin, MessageSquare, Newspaper,
  Plane, ShoppingBag, Ticket, Trophy, Zap,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import { formatVegasDateTime } from "@/lib/vegas-time";
import { hideBrokenImage } from "@/lib/img-fallback";
import { lightImpact } from "@/lib/native/haptics";
import PullToRefresh from "@/components/PullToRefresh";
import SocialLinks from "@/components/public/SocialLinks";

const UNITS = [
  ["days", 86400000],
  ["hours", 3600000],
  ["mins", 60000],
  ["secs", 1000],
];
function getRemaining(target) {
  const diff = target - Date.now();
  if (!(diff > 0)) return { done: true };
  let rem = diff;
  const out = {};
  for (const [key, ms] of UNITS) {
    out[key] = Math.floor(rem / ms);
    rem -= out[key] * ms;
  }
  return { done: false, ...out };
}

function Card({ children, className = "" }) {
  return (
    <div className={`nt-raised nt-e2 border border-border/50 ${className}`}>{children}</div>
  );
}

function Eyebrow({ children, tone = "text-primary" }) {
  return (
    <p className={`nt-caption font-bold uppercase tracking-[0.22em] ${tone}`}>{children}</p>
  );
}

export default function NativeHome() {
  const { user, isAuthenticated } = useAuth();
  const enabled = appParams.hasBase44Config;

  const { data: settingsRecords = [] } = useQuery({ queryKey: ["siteSettings"], queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1), enabled });
  const { data: matchups = [] } = useQuery({ queryKey: ["matchups"], queryFn: () => base44.entities.Matchup.list("sort_order", 50), enabled, retry: false, meta: { silent: true } });
  const { data: news = [] } = useQuery({ queryKey: ["news"], queryFn: () => base44.entities.NewsArticle.list("-published_date", 20), enabled });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.EventContent.list("-updated_date", 5), enabled });
  const { data: packages = [] } = useQuery({ queryKey: ["packages"], queryFn: () => base44.entities.TravelPackage.list("sort_order", 20), enabled, retry: false, meta: { silent: true } });

  const settings = settingsRecords[0] || {};

  const countdownTarget = useMemo(() => {
    const t = settings.countdown_date ? new Date(settings.countdown_date).getTime() : NaN;
    return Number.isFinite(t) ? t : null;
  }, [settings.countdown_date]);
  const [remaining, setRemaining] = useState(() => (countdownTarget ? getRemaining(countdownTarget) : null));
  useEffect(() => {
    if (!countdownTarget) { setRemaining(null); return undefined; }
    setRemaining(getRemaining(countdownTarget));
    const id = setInterval(() => setRemaining(getRemaining(countdownTarget)), 1000);
    return () => clearInterval(id);
  }, [countdownTarget]);

  const nextMatch = useMemo(() => {
    const live = (matchups || []).filter((m) => m.is_published !== false && m.home_team && m.away_team);
    const upcoming = live
      .filter((m) => m.status !== "final")
      .sort((a, b) => new Date(a.kickoff || 0) - new Date(b.kickoff || 0));
    return upcoming[0] || live[0] || null;
  }, [matchups]);

  const visibleNews = (news || []).filter((a) => a.is_published !== false).slice(0, 6);
  const firstName = (user?.full_name || user?.email || "").split(/[ @]/)[0] || "Punter";

  const chips = Number(user?.casino_chips || 0);
  const xp = Number(user?.casino_xp || 0);
  const streak = Number(user?.casino_streak || 0);
  const rankName = user?.casino_rank || "Rookie Punter";

  return (
    <PullToRefresh queryKeys={[["siteSettings"], ["matchups"], ["news"], ["events"], ["packages"]]}>
      <main className="min-h-dvh bg-background text-foreground nt-legible-floor pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto w-full max-w-xl nt-gutter-x nt-stack">
          {/* ① Greeting */}
          <div className="flex items-center justify-between gap-3 pb-1">
            <div className="min-w-0">
              <Eyebrow>Takeover HQ</Eyebrow>
              <h1 className="nt-large-title mt-0.5 truncate text-foreground">
                {isAuthenticated ? `G'day, ${firstName}` : "Welcome"}
              </h1>
            </div>
            {isAuthenticated ? (
              <div className="shrink-0 border border-accent/30 bg-accent/10 px-2.5 py-1 text-accent">
                <span className="nt-caption font-bold uppercase tracking-wider">{rankName}</span>
              </div>
            ) : (
              <div className="flex shrink-0 gap-2">
                <Link to="/login" onClick={() => lightImpact()} className="ios-pressable inline-flex min-h-11 items-center border border-border/70 bg-card/50 px-3 py-2 nt-caption font-bold uppercase tracking-wider text-foreground">Sign in</Link>
              </div>
            )}
          </div>

          {/* ② Countdown hero */}
          {remaining && settings.countdown_enabled !== false && (
            <Card className="relative overflow-hidden p-5">
              <div className="cmd-accent-bar absolute inset-x-0 top-0 h-[2px]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.14),transparent_60%)]" />
              <div className="relative">
                <Eyebrow>{settings.countdown_subtitle || "Las Vegas • NRL Takeover"}</Eyebrow>
                <p className="nt-callout mt-1 font-semibold text-slate-200">
                  {remaining.done ? "It's happening now in Las Vegas 🏉" : (settings.countdown_title || "The takeover begins in")}
                </p>
                {!remaining.done && (
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {UNITS.map(([key]) => (
                      <div key={key} className="border border-border/60 bg-background/50 py-3 text-center">
                        <div className="font-display text-2xl font-black tabular-nums text-foreground">{String(remaining[key]).padStart(2, "0")}</div>
                        <div className="nt-caption uppercase tracking-widest text-muted-foreground">{key}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* ③ Next match */}
          {nextMatch && (
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-accent" />
                <Eyebrow tone="text-slate-300">{nextMatch.status === "final" ? "Latest result" : "Next match"}</Eyebrow>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-right font-display text-lg uppercase text-foreground">{nextMatch.home_team}</span>
                <span className="shrink-0 font-mono text-xs font-bold text-primary">VS</span>
                <span className="min-w-0 flex-1 truncate font-display text-lg uppercase text-foreground">{nextMatch.away_team}</span>
              </div>
              <div className="mt-3 flex items-center justify-center gap-4 nt-footnote text-muted-foreground">
                {nextMatch.kickoff && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatVegasDateTime(nextMatch.kickoff)}</span>}
                {nextMatch.venue && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{nextMatch.venue}</span>}
              </div>
              {nextMatch.ticket_url && (
                <a href={nextMatch.ticket_url} className="ios-pressable mt-3 flex min-h-11 items-center justify-center gap-2 bg-primary nt-footnote font-bold uppercase tracking-wider text-white">
                  <Ticket className="h-4 w-4" /> Get tickets
                </a>
              )}
            </Card>
          )}

          {/* ④ Fan snapshot / start earning */}
          {isAuthenticated ? (
            <Link to="/account" onClick={() => lightImpact()} className="block">
              <Card className="p-4">
                <Eyebrow tone="text-accent">Your fan card</Eyebrow>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="border border-accent/20 bg-accent/[0.06] p-3 text-center">
                    <Coins className="mx-auto h-4 w-4 text-accent" />
                    <div className="mt-1 font-display text-xl font-black tabular-nums text-foreground">{chips.toLocaleString()}</div>
                    <div className="nt-caption uppercase tracking-wider text-muted-foreground">Chips</div>
                  </div>
                  <div className="border border-primary/20 bg-primary/[0.06] p-3 text-center">
                    <Zap className="mx-auto h-4 w-4 text-primary" />
                    <div className="mt-1 font-display text-xl font-black tabular-nums text-foreground">{xp.toLocaleString()}</div>
                    <div className="nt-caption uppercase tracking-wider text-muted-foreground">XP</div>
                  </div>
                  <div className="border border-orange-500/20 bg-orange-500/[0.06] p-3 text-center">
                    <Flame className="mx-auto h-4 w-4 text-orange-400" />
                    <div className="mt-1 font-display text-xl font-black tabular-nums text-foreground">{streak}</div>
                    <div className="nt-caption uppercase tracking-wider text-muted-foreground">Streak</div>
                  </div>
                </div>
              </Card>
            </Link>
          ) : (
            <Link to="/register" onClick={() => lightImpact()} className="block">
              <Card className="flex items-center gap-3 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-accent/30 bg-accent/10 text-accent"><Trophy className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="nt-subhead font-bold text-foreground">Start earning</p>
                  <p className="nt-footnote text-slate-300">Sign up to track XP, chips & your fan rank.</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
              </Card>
            </Link>
          )}

          {/* ⑤ Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: "/store", icon: ShoppingBag, label: "Store", sub: "Supporter gear" },
              { to: "/forum", icon: MessageSquare, label: "Forum", sub: "Match talk" },
              { to: "/#travel", icon: Plane, label: "Travel", sub: `${packages.length || ""} packages`.trim() },
              { to: "/#events", icon: CalendarDays, label: "Events", sub: `${events.length || ""} planned`.trim() },
            ].map(({ to, icon: Icon, label, sub }) => (
              <Link key={label} to={to} onClick={() => lightImpact()} className="ios-pressable">
                <Card className="flex flex-col gap-2 p-4">
                  <div className="flex h-9 w-9 items-center justify-center border border-border bg-background/50 text-primary"><Icon className="h-4 w-4" /></div>
                  <div>
                    <p className="nt-subhead font-bold text-foreground">{label}</p>
                    <p className="nt-caption text-muted-foreground">{sub}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* ⑥ Latest news rail */}
          {visibleNews.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Eyebrow tone="text-slate-300"><span className="inline-flex items-center gap-1.5"><Newspaper className="h-3.5 w-3.5 text-primary" /> Latest news</span></Eyebrow>
                <Link to="/news" onClick={() => lightImpact()} className="ios-pressable inline-flex min-h-11 items-center nt-caption font-bold uppercase tracking-wider text-primary">All →</Link>
              </div>
              <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 store-category-rail">
                {visibleNews.map((a, i) => (
                  <Link key={a.id || i} to="/news" onClick={() => lightImpact()} className="w-64 shrink-0 snap-start">
                    <Card className="overflow-hidden">
                      <div className="aspect-video overflow-hidden border-b border-border/40 bg-muted/20">
                        {a.image_url && <img src={a.image_url} alt={a.title} loading="lazy" onError={hideBrokenImage} className="h-full w-full object-cover" />}
                      </div>
                      <div className="p-3">
                        <p className="nt-subhead line-clamp-2 font-bold text-foreground">{a.title}</p>
                        {a.author && <p className="nt-caption mt-1 text-muted-foreground">{a.author}</p>}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ⑦ Social */}
          <div className="pt-2">
            <SocialLinks settings={settings} compact />
          </div>
        </div>
      </main>
    </PullToRefresh>
  );
}
