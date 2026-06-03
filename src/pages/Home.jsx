import React, { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import AdSlot from "@/components/ads/AdSlot";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import HeroSection from "@/components/public/HeroSection";
import BackgroundVideo from "@/components/public/BackgroundVideo";
import CountdownTimer from "@/components/public/CountdownTimer";
import MatchupsSection from "@/components/public/MatchupsSection";
import LazySection from "@/components/public/LazySection";

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
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <CountdownTimer settings={settings} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <MatchupsSection />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Sponsored — mid content */}
          <div className="mx-auto max-w-5xl px-4 py-8">
            <AdSlot position="in-feed" size="leaderboard" className="w-full" />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <LazySection height={450}>
            <Suspense fallback={<div className="h-[450px]" />}>
              <NewsSection articles={visibleNews} settings={settings} />
            </Suspense>
          </LazySection>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <LazySection height={350}>
            <Suspense fallback={<div className="h-[350px]" />}>
              <AboutSection settings={settings} />
            </Suspense>
          </LazySection>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <LazySection height={500}>
            <Suspense fallback={<div className="h-[500px]" />}>
              <TravelSection packages={visiblePackages} settings={settings} />
            </Suspense>
          </LazySection>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <LazySection height={500}>
            <Suspense fallback={<div className="h-[500px]" />}>
              <EventsSection events={events.length ? events : [defaultEvent]} event={event} />
            </Suspense>
          </LazySection>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Sponsored — mid content */}
          <div className="mx-auto max-w-5xl px-4 py-8">
            <AdSlot position="banner-bottom" size="leaderboard" className="w-full" />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <LazySection height={450}>
            <Suspense fallback={<div className="h-[450px]" />}>
              <MerchSection settings={settings} />
            </Suspense>
          </LazySection>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <LazySection height={250}>
            <Suspense fallback={<div className="h-[250px]" />}>
              <PartnersSection settings={settings} />
            </Suspense>
          </LazySection>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <LazySection height={350}>
            <Suspense fallback={<div className="h-[350px]" />}>
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
                    {["Latest News", "About Us", "Travel Packages", "Events"].map((link) => (
                      <li key={link}><a href={`/#${link.toLowerCase().replace(/\s+/g, '-')}`} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">{link}</a></li>
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
                    {[{label:"Sign In", href:"/login"}, {label:"Register", href:"/register"}, {label:"My Account", href:"/account"}].map((link) => (
                      <li key={link.label}><a href={link.href} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">{link.label}</a></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-primary mb-3">Connect</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Join the movement. Rugby League's biggest fan invasion of Las Vegas.</p>
                  <a
                    href="https://www.facebook.com/groups/663237792349090"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 flex items-center gap-2.5 border border-border/40 bg-card/20 px-3 py-2.5 group hover:border-[#1877F2]/40 hover:bg-[#1877F2]/5 transition-all duration-300"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#1877F2] shrink-0" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-foreground group-hover:text-[#1877F2] transition-colors truncate">NRL Las Vegas</p>
                      <p className="text-[9px] text-muted-foreground font-mono">16.8k members</p>
                    </div>
                    <svg viewBox="0 0 24 24" className="h-3 w-3 ml-auto text-muted-foreground group-hover:text-[#1877F2] group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                  </a>
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
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Powered by <span className="text-foreground/80">{settings.footer_powered_by || "DENEO.AI"}</span></p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}