import React, { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import AdSlot from "@/components/ads/AdSlot";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import HeroSection from "@/components/public/HeroSection";
import BackgroundVideo from "@/components/public/BackgroundVideo";
import SocialLinks from "@/components/public/SocialLinks";
import CountdownTimer from "@/components/public/CountdownTimer";
import MatchupsSection from "@/components/public/MatchupsSection";
import LazySection from "@/components/public/LazySection";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, MessageSquare, Plane, Radio, ShoppingBag, Users } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

function PublicActionCard({ icon: Icon, eyebrow, title, body, action, to, href, onClick, tone = "primary" }) {
  const toneClass = {
    primary: "border-primary/25 bg-primary/[0.045] text-primary hover:border-primary/55 hover:bg-primary/[0.075]",
    accent: "border-accent/25 bg-accent/[0.045] text-accent hover:border-accent/55 hover:bg-accent/[0.075]",
    emerald: "border-emerald-400/25 bg-emerald-400/[0.045] text-emerald-400 hover:border-emerald-400/55 hover:bg-emerald-400/[0.075]",
    blue: "border-sky-400/25 bg-sky-400/[0.045] text-sky-300 hover:border-sky-400/55 hover:bg-sky-400/[0.075]",
  }[tone];

  const content = (
    <>
      <div className="flex min-w-0 items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center border bg-background/45 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-muted-foreground/70">{eyebrow}</p>
          <h3 className="mt-1 font-display text-xl uppercase leading-none tracking-wide text-foreground sm:text-2xl">{title}</h3>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">{body}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-foreground">{action}</span>
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
      </div>
    </>
  );

  const className = `group block min-w-0 border p-4 text-left transition-all duration-200 ${toneClass}`;

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <a href={href} onClick={onClick} className={className}>
      {content}
    </a>
  );
}

function LiveHudDashboard({ settings = {} }) {
  const scrollToSection = (id) => (event) => {
    event.preventDefault();
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
    window.history.replaceState(null, "", id);
  };

  return (
    <section className="relative z-20 mx-auto max-w-7xl px-5 py-8 md:px-8" aria-labelledby="takeover-actions-heading">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="border border-border/70 bg-card/45 p-4 cmd-glass sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-primary">Takeover Command</p>
              <h2 id="takeover-actions-heading" className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-foreground sm:text-4xl">
                Plan your Vegas week
              </h2>
            </div>
            <div className="flex items-center gap-2 border border-border/50 bg-background/45 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              <Users className="h-3.5 w-3.5 text-accent" />
              Fan hub live
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PublicActionCard
              icon={Plane}
              eyebrow="Travel"
              title="Register interest"
              body="Get ready for flights, hotels, events, and supporter package drops."
              action="View travel"
              href="#travel"
              onClick={scrollToSection("#travel")}
              tone="primary"
            />
            <PublicActionCard
              icon={CalendarDays}
              eyebrow="Events"
              title="Map the meetups"
              body="See what is coming for parties, stadium days, and fan gatherings."
              action="See events"
              href="#events"
              onClick={scrollToSection("#events")}
              tone="accent"
            />
            <PublicActionCard
              icon={ShoppingBag}
              eyebrow="Merch"
              title="Shop the drop"
              body="Browse official supporter gear and track orders from your profile."
              action="Open store"
              to="/store"
              tone="emerald"
            />
            <PublicActionCard
              icon={MessageSquare}
              eyebrow="Community"
              title="Join the forum"
              body="Ask questions, find other fans, and plan your Vegas group chat."
              action="Open forum"
              to="/forum"
              tone="blue"
            />
          </div>
        </div>

        <div className="grid gap-3">
          <a
            href={settings.social_facebook_url || "https://www.facebook.com/groups/663237792349090"}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-h-full flex-col justify-between border border-[#1877F2]/25 bg-[#1877F2]/[0.035] p-5 text-left transition-colors hover:bg-[#1877F2]/[0.07] cmd-glass"
          >
            <div>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center border border-[#1877F2]/35 bg-background/45 text-[#1877F2]">
                  <Radio className="h-5 w-5" />
                </div>
                <span className="border border-[#1877F2]/25 bg-[#1877F2]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.24em] text-[#8dbbff]">
                  16.8k fans
                </span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#8dbbff]">Facebook group</p>
              <h3 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-foreground">Meet the travelling crowd</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Jump into the bigger Las Vegas fan conversation for tickets, meetups, travel tips, and game-week chatter.
              </p>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-[#1877F2]/20 pt-4">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-foreground">Join group</span>
              <ArrowRight className="h-4 w-4 text-[#8dbbff] transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </a>
          <SocialLinks settings={settings} compact />
        </div>
      </div>
    </section>
  );
}


// Lazy-loaded sections
const NewsSection = lazy(() => import("@/components/public/NewsSection"));
const AboutSection = lazy(() => import("@/components/public/AboutSection"));
const TravelSection = lazy(() => import("@/components/public/TravelSection"));
const EventsSection = lazy(() => import("@/components/public/EventsSection"));
const MerchSection = lazy(() => import("@/components/public/MerchSection"));
const PartnersSection = lazy(() => import("@/components/public/PartnersSection"));
const TestimonialsSection = lazy(() => import("@/components/public/TestimonialsSection"));

const stadiumVideoUrls = [
  "https://media.base44.com/videos/public/6a18d49a2b8f40f0f81cc26e/7753542d9_b39f245c-2207-4f31-bd97-2cb52f47dc3a.mov",
  "https://media.base44.com/videos/public/6a18d49a2b8f40f0f81cc26e/bf55ac1e7_AllegiantStadiumParadiseNevadaclaytonhaamallegiantallegiantstadiumparadis.mp4"
];

const defaultNews = [
  {
    title: "Rugby League Takeover lands in Las Vegas",
    body: "The supporter invasion is building. Rugby League fans from across Australia are preparing for another unforgettable Vegas week.",
    image_url: "https://images.unsplash.com/photo-1605833556294-ea5c7a74f57d?auto=format&fit=crop&w=1200&q=80",
    published_date: "2026-03-01",
    author: "RLT Vegas",
    is_published: true,
  },
  {
    title: "Travel packages coming soon",
    body: "Air, accommodation, events and more are being prepared. Register your interest to be first to hear when packages drop.",
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

const defaultPackages = [
  { name: "Travel Package 1", description: "Flights, accommodation and event access details coming soon.", is_coming_soon: true, sort_order: 1 },
  { name: "Travel Package 2", description: "A premium Vegas supporter experience is being prepared.", is_coming_soon: true, sort_order: 2 },
  { name: "Travel Package 3", description: "More options for groups, families and passionate fans coming soon.", is_coming_soon: true, sort_order: 3 },
];

const defaultEvent = {
  title: "Stadium Swim",
  blurb: "Stadium Swim plans are building for the end of February, with more fan meetups and Vegas supporter experiences to be announced soon.",
  photo_urls: [
    "https://media.base44.com/images/public/6a18d49a2b8f40f0f81cc26e/4d882498b_57895bb2-6bf0-4062-bbf3-78c2b309651a.jpeg",
    "https://media.base44.com/images/public/6a18d49a2b8f40f0f81cc26e/d22e13269_e3e79af1-bdf3-43c5-81a9-13e918072b94.jpg"
  ],
  is_coming_soon: true,
};

const tickerItems = [
  { text: "LAS VEGAS TAKEOVER 2026", type: "gold" },
  { text: "RUGBY LEAGUE GLOBAL INVASION", type: "red" },
  { text: "VIP TRAVEL PACKAGES DROPPING SOON", type: "gold" },
  { text: "EXCLUSIVE FAN EVENTS & MEETUPS", type: "red" },
  { text: "STADIUM SWIM PARTIES", type: "gold" },
];

const slotSymbols = [
  ["🍒", "🎰", "🍒"],
  ["🏉", "🪙", "🏉"],
  ["⭐", "🍀", "⭐"],
  ["💎", "🔔", "💎"],
];

const BulbRow = React.memo(function BulbRow({ isTop }) {
  return (
    <div className={`absolute left-0 right-0 w-full flex justify-between px-2 pointer-events-none overflow-hidden h-2 ${isTop ? "top-1" : "bottom-1"}`}>
      {Array.from({ length: 40 }).map((_, i) => {
        const index = isTop ? i : i + 2;
        let animateClass = "";
        if (index % 4 === 0) animateClass = "animate-vegas-gold-1 bg-amber-400";
        else if (index % 4 === 1) animateClass = "animate-vegas-red-1 bg-red-500";
        else if (index % 4 === 2) animateClass = "animate-vegas-gold-2 bg-amber-400";
        else animateClass = "animate-vegas-red-2 bg-red-500";

        return (
          <span
            key={i}
            className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${animateClass} shadow-md transition-all duration-300`}
          />
        );
      })}
    </div>
  );
});

export default function Home() {
  const { isAuthenticated } = useAuth();
  const queriesEnabled = appParams.hasBase44Config;
  const { data: settingsRecords = [], isLoading: isLoadingSettings } = useQuery({ queryKey: ["siteSettings"], queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1), enabled: queriesEnabled });
  const { data: news = [] } = useQuery({ queryKey: ["news"], queryFn: () => base44.entities.NewsArticle.list("-published_date", 20), enabled: queriesEnabled });
  const { data: packages = [] } = useQuery({ queryKey: ["packages"], queryFn: () => base44.entities.TravelPackage.list("sort_order", 20), enabled: queriesEnabled });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.EventContent.list("-updated_date", 5), enabled: queriesEnabled });

  const settings = settingsRecords[0] || {};
  const visibleNews = (news.length ? news : defaultNews).filter((article) => article.is_published !== false).slice(0, 6);
  const visiblePackages = packages.length ? packages : defaultPackages;
  const event = events[0] || defaultEvent;
  const videoSources = settings.background_video_urls?.length ? settings.background_video_urls : stadiumVideoUrls;
  const accountLinks = isAuthenticated
    ? [{ label: "My Account", href: "/account" }]
    : [{ label: "Sign In", href: "/login" }, { label: "Register", href: "/register" }];

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <BackgroundVideo sources={videoSources} />
      <div className="relative z-10">
        <HeroSection settings={settings} settingsLoading={isLoadingSettings} />
        <div className="relative w-full overflow-hidden border-y-2 border-amber-500/60 bg-neutral-950 py-5 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
          <BulbRow isTop={true} />
          
          <div className="animate-marquee flex items-center gap-8">
            {Array(4).fill(tickerItems).flat().map((item, idx) => (
              <div key={idx} className="flex items-center gap-8">
                <span className={`font-display text-xs sm:text-[13px] font-bold uppercase tracking-[0.25em] whitespace-nowrap ${
                  item.type === "gold" ? "vegas-neon-text-gold" : "vegas-neon-text-red"
                }`}>
                  {item.text}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-neutral-900 border border-amber-500/30 rounded shadow-[inset_0_0_8px_rgba(0,0,0,0.9)] text-[10px] select-none whitespace-nowrap">
                  <span>{slotSymbols[idx % slotSymbols.length][0]}</span>
                  <span className="scale-110">{slotSymbols[idx % slotSymbols.length][1]}</span>
                  <span>{slotSymbols[idx % slotSymbols.length][2]}</span>
                </span>
              </div>
            ))}
          </div>

          <BulbRow isTop={false} />
        </div>

        {/* Live HUD Dashboard */}
        <LiveHudDashboard settings={settings} />

        {/* Countdown Timer */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <CountdownTimer settings={settings} />
        </motion.div>

        {/* Matchups HUD */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <MatchupsSection />
        </motion.div>

        {/* Travel Interest / Registration */}
        <motion.div
          id="travel"
          style={{ scrollMarginTop: "80px" }}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <LazySection height={500}>
            <Suspense fallback={<div className="animate-pulse bg-muted/5 border-y border-border/20 h-[500px]" />}>
              <TravelSection packages={visiblePackages} settings={settings} />
            </Suspense>
          </LazySection>
        </motion.div>

        {/* Match Day Events */}
        <motion.div
          id="events"
          style={{ scrollMarginTop: "80px" }}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <LazySection height={500}>
            <Suspense fallback={<div className="animate-pulse bg-muted/5 border-y border-border/20 h-[500px]" />}>
              <EventsSection events={events.length ? events : [defaultEvent]} event={event} />
            </Suspense>
          </LazySection>
        </motion.div>

        {/* Sponsored — mid content ad */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="mx-auto max-w-5xl px-4 py-8">
            <AdSlot position="in-feed" size="leaderboard" className="w-full" />
          </div>
        </motion.div>

        {/* Merch Store Highlight */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <LazySection height={450}>
            <Suspense fallback={<div className="animate-pulse bg-muted/5 border-y border-border/20 h-[450px]" />}>
              <MerchSection settings={settings} />
            </Suspense>
          </LazySection>
        </motion.div>

        {/* News Section */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <LazySection height={450}>
            <Suspense fallback={<div className="animate-pulse bg-muted/5 border-y border-border/20 h-[450px]" />}>
              <NewsSection articles={visibleNews} settings={settings} />
            </Suspense>
          </LazySection>
        </motion.div>

        {/* About Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <LazySection height={350}>
            <Suspense fallback={<div className="animate-pulse bg-muted/5 border-y border-border/20 h-[350px]" />}>
              <AboutSection settings={settings} />
            </Suspense>
          </LazySection>
        </motion.div>

        {/* Sponsored — bottom content ad */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="mx-auto max-w-5xl px-4 py-8">
            <AdSlot position="banner-bottom" size="leaderboard" className="w-full" />
          </div>
        </motion.div>

        {/* Partners Section */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <LazySection height={250}>
            <Suspense fallback={<div className="animate-pulse bg-muted/5 border-y border-border/20 h-64" />}>
              <PartnersSection settings={settings} />
            </Suspense>
          </LazySection>
        </motion.div>

        {/* Testimonials Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <LazySection height={350}>
            <Suspense fallback={<div className="animate-pulse bg-muted/5 border-y border-border/20 h-[350px]" />}>
              <TestimonialsSection settings={settings} />
            </Suspense>
          </LazySection>
        </motion.div>
        <footer className="border-t border-border bg-secondary/90 backdrop-blur-sm">
          {/* Footer nav links */}
          <div className="px-5 py-8 md:py-12">
            <div className="mx-auto max-w-5xl">
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-primary mb-3">Explore</p>
                  <ul className="space-y-2">
                    {[
                      { label: "Latest News", href: "/news" },
                      { label: "FAQs", href: "/faq" },
                      { label: "About Us", href: "/#about" },
                      { label: "Travel Packages", href: "/#travel" },
                      { label: "Events", href: "/#events" },
                    ].map((link) => (
                      <li key={link.label}><a href={link.href} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">{link.label}</a></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-primary mb-3">Community</p>
                  <ul className="space-y-2">
                    {[{label:"Forum", href:"/forum"}, {label:"Merch Store", href:"/store"}, {label:"Partners", href:"/#partners"}, {label:"Testimonials", href:"/#testimonials"}].map((link) => (
                      <li key={link.label}><a href={link.href} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">{link.label}</a></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-primary mb-3">Account</p>
                  <ul className="space-y-2">
                    {accountLinks.map((link) => (
                      <li key={link.label}><a href={link.href} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">{link.label}</a></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-primary mb-3">Connect</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Join the movement. Rugby League's biggest fan invasion of Las Vegas.</p>
                  <SocialLinks settings={settings} compact className="mt-3" />
                  <div className="mt-3 flex items-center gap-1">
                    <span className="inline-block h-1 w-6 bg-primary" />
                    <span className="inline-block h-1 w-4 bg-accent" />
                    <span className="inline-block h-1 w-2 bg-primary/50" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Bottom bar */}
          <div className="border-t border-border/50 px-5 py-5">
            <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 sm:flex-row sm:justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">{settings.footer_text || "Rugby League Takeover Las Vegas © 2026"}</p>
              <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                <span>Powered by</span>
                <span className="inline-flex items-center border border-sky-400/25 bg-white px-2.5 py-1.5 shadow-[0_0_18px_rgba(14,165,233,0.22)]">
                  <img
                    src="https://media.base44.com/images/public/6a18d49a2b8f40f0f81cc26e/830b4f67c_deneoailq.png"
                    alt="DENEO.AI"
                    className="h-5 w-auto object-contain sm:h-6"
                    loading="lazy"
                  />
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}