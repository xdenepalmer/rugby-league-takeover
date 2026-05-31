import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import HeroSection from "@/components/public/HeroSection";
import BackgroundVideo from "@/components/public/BackgroundVideo";
import CountdownTimer from "@/components/public/CountdownTimer";
import NewsSection from "@/components/public/NewsSection";
import AboutSection from "@/components/public/AboutSection";
import TravelSection from "@/components/public/TravelSection";
import EventsSection from "@/components/public/EventsSection";
import MerchSection from "@/components/public/MerchSection";

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

export default function Home() {
  const queriesEnabled = appParams.hasBase44Config;
  const { data: settingsRecords = [] } = useQuery({ queryKey: ["siteSettings"], queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1), enabled: queriesEnabled });
  const { data: news = [] } = useQuery({ queryKey: ["news"], queryFn: () => base44.entities.NewsArticle.list("-published_date", 20), enabled: queriesEnabled });
  const { data: packages = [] } = useQuery({ queryKey: ["packages"], queryFn: () => base44.entities.TravelPackage.list("sort_order", 20), enabled: queriesEnabled });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.EventContent.list("-updated_date", 5), enabled: queriesEnabled });

  const settings = settingsRecords[0] || {};
  const visibleNews = (news.length ? news : defaultNews).filter((article) => article.is_published !== false).slice(0, 6);
  const visiblePackages = packages.length ? packages : defaultPackages;
  const event = events[0] || defaultEvent;
  const videoSources = settings.background_video_urls?.length ? settings.background_video_urls : stadiumVideoUrls;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <BackgroundVideo sources={videoSources} />
      <div className="relative z-10">
        <HeroSection settings={settings} />
        <div className="relative w-full overflow-hidden border-y border-border bg-secondary/80 py-4 backdrop-blur-md">
          <div className="animate-marquee flex gap-12 text-xs font-bold uppercase tracking-[0.3em] text-accent">
            {Array(4).fill([
              "LAS VEGAS TAKEOVER 2026",
              "RUGBY LEAGUE GLOBAL INVASION",
              "VIP TRAVEL PACKAGES DROPPING SOON",
              "EXCLUSIVE FAN EVENTS & MEETUPS",
              "STADIUM SWIM PARTIES",
            ]).flat().map((text, idx) => (
              <span key={idx} className="flex items-center gap-12">
                <span>{text}</span>
                <span className="text-primary font-extrabold">•</span>
              </span>
            ))}
          </div>
        </div>
        <CountdownTimer settings={settings} />
        <NewsSection articles={visibleNews} settings={settings} />
        <AboutSection settings={settings} />
        <TravelSection packages={visiblePackages} settings={settings} />
        <EventsSection events={events.length ? events : [defaultEvent]} event={event} />
        <MerchSection settings={settings} />
        <footer className="border-t border-border bg-secondary/90 px-5 py-10 text-center backdrop-blur-sm">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">{settings.footer_text || "Rugby League Takeover Las Vegas © 2026"}</p>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Powered by <span className="text-foreground">{settings.footer_powered_by || "DENEO.AI"}</span></p>
        </footer>
      </div>
    </main>
  );
}