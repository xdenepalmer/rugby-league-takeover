import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Quote, Star } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import SectionHeader from "./SectionHeader";

const defaultTestimonials = [
  { id: "d1", author_name: "Jacko", author_role: "Eels fan · Western Sydney", quote: "Best week of my life. Footy, mates and Vegas — the Takeover crew sorted everything.", rating: 5, is_published: true, sort_order: 1 },
  { id: "d2", author_name: "Mel & Dave", author_role: "Vegas 2025 travellers", quote: "Stadium Swim, the games, the meetups — unreal vibe the whole time. Already booking the next one.", rating: 5, is_published: true, sort_order: 2 },
  { id: "d3", author_name: "Tom", author_role: "Storm supporter", quote: "Travel, tickets and accommodation all in one place. Couldn't fault it.", rating: 5, is_published: true, sort_order: 3 },
];

const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function Stars({ rating }) {
  const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  if (!r) return null;
  return (
    <div className="flex gap-0.5" aria-label={`${r} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < r ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

export default function TestimonialsSection({ settings = {} }) {
  const { data: testimonials = [] } = useQuery({
    queryKey: ["testimonials"],
    queryFn: () => base44.entities.Testimonial.list("sort_order", 200),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

  const visible = testimonials.filter((t) => t.is_published !== false && t.quote);
  const display = visible.length > 0 ? visible : defaultTestimonials;
  if (display.length === 0) return null;

  return (
    <section id="testimonials" className="border-t border-border bg-background/80 px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeader eyebrow={settings.testimonials_eyebrow || "Testimonials"} title={settings.testimonials_title || "What the fans say"}>
          {settings.testimonials_description || "Real words from the supporters who've made the trip."}
        </SectionHeader>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {display.map((t, index) => (
            <figure key={t.id || index} className="flex h-full flex-col border border-border bg-card p-6">
              <Quote className="h-7 w-7 text-primary/40" />
              <blockquote className="mt-4 flex-1 text-sm leading-7 text-foreground/90">{t.quote}</blockquote>
              {t.rating ? <div className="mt-4"><Stars rating={t.rating} /></div> : null}
              <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                {t.avatar_url ? (
                  <img src={t.avatar_url} alt={t.author_name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 font-display text-sm text-primary">{initials(t.author_name)}</span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-display text-sm uppercase text-foreground">{t.author_name}</p>
                  {t.author_role && <p className="truncate text-xs text-muted-foreground">{t.author_role}</p>}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
