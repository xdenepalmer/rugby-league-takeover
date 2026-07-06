import React from "react";
import { useQuery } from "@tanstack/react-query";
import { HelpCircle, MessageCircle, ShoppingBag, Plane, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import BackgroundVideo, { DEFAULT_BACKGROUND_VIDEO_SOURCES } from "@/components/public/BackgroundVideo";

const fallbackFaqs = [
  {
    id: "travel",
    question: "What is Rugby League Takeover Las Vegas?",
    answer: "Rugby League Takeover Las Vegas is a supporter hub for fans travelling to Las Vegas for rugby league week, with official updates, travel interest registration, event information, merch and community links.",
  },
  {
    id: "packages",
    question: "Where can I register interest for travel packages?",
    answer: "Use the travel registration form on the homepage to tell us your preferred trip details, dates, hotel style and team support. The team can then follow up with relevant package information.",
  },
  {
    id: "events",
    question: "Where do I find official event and ticket information?",
    answer: "Event listings are available on the homepage in the Events section. Where official ticket or purchase links are available, they are shown directly on each event card and detail panel.",
  },
  {
    id: "store",
    question: "How do I buy merchandise?",
    answer: "Visit the Merch Shop, add items to your cart, enter your checkout details, and complete payment securely through Stripe from the published site.",
  },
];

export default function Faq() {
  const { data: faqs = [] } = useQuery({
    queryKey: ["faqs"],
    queryFn: () => base44.entities.Faq.list("sort_order", 200),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });
  const { data: settingsRecords = [] } = useQuery({
    queryKey: ["siteSettings"],
    queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

  // The public FAQ page shows the "general" (website) FAQs, managed under
  // Admin → Content → FAQs. Store-only FAQs live on the merch page instead.
  const visibleFaqs = faqs.filter((faq) => faq.is_published !== false && faq.question && faq.category === "general");
  // The DB is the source of truth: the default website FAQs are seeded as real,
  // editable "general" rows (migration 0009), so the admin can add/edit/delete
  // them freely. Only fall back to the hard-coded copy when there is no backend
  // to read from — otherwise deleting a FAQ in the admin would "come back".
  const items = visibleFaqs.length
    ? visibleFaqs
    : (appParams.hasBase44Config ? [] : fallbackFaqs);
  const videoSources = settingsRecords[0]?.background_video_urls?.length
    ? settingsRecords[0].background_video_urls
    : DEFAULT_BACKGROUND_VIDEO_SOURCES;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background px-5 pb-20 pt-[calc(7.25rem+env(safe-area-inset-top,0px))] text-foreground md:px-8">
      <BackgroundVideo sources={videoSources} />
      <div className="absolute inset-0 cmd-grid-bg opacity-25 pointer-events-none" />
      <div className="absolute left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="border border-border/60 bg-card/40 p-6 cmd-glass md:p-10">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.32em] text-primary">
            <HelpCircle className="h-4 w-4" /> Official FAQ
          </p>
          <h1 className="mt-4 font-display text-5xl uppercase leading-none tracking-wide md:text-7xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            Official answers for travel interest, Vegas events, merchandise, checkout and community features.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[{ icon: Plane, label: "Travel" }, { icon: ShieldCheck, label: "Events" }, { icon: ShoppingBag, label: "Store" }, { icon: MessageCircle, label: "Community" }].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="border border-border/50 bg-background/35 p-3">
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        <section className="mt-8 border border-border bg-card/35 p-4 cmd-glass md:p-6" aria-label="Frequently asked questions">
          {items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No FAQs published yet. Check back soon or register your travel interest below.
            </p>
          )}
          <Accordion type="single" collapsible className="w-full">
            {items.map((faq, index) => (
              <AccordionItem key={faq.id || index} value={String(faq.id || index)} className="border-border/70">
                <AccordionTrigger className="text-left font-display text-xl uppercase tracking-wide text-foreground hover:text-primary">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {faq.answer || "More details coming soon."}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Button asChild className="h-12 rounded-none bg-primary font-bold uppercase tracking-widest text-primary-foreground hover:bg-primary/90">
            <Link to="/#travel">Register travel interest</Link>
          </Button>
          <Button asChild variant="outline" className="h-12 rounded-none border-border font-bold uppercase tracking-widest">
            <Link to="/store">Visit merch shop</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}