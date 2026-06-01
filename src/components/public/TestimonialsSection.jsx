import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Quote, Star, PenLine, Send, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
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

  const emptyDraft = { author_name: "", author_role: "", quote: "", rating: 5 };
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke("submitTestimonial", data),
    onSuccess: () => { setSubmitted(true); setDraft(emptyDraft); },
    onError: (err) => toast({ title: "Couldn't submit", description: err?.message || "Please try again.", variant: "destructive" }),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!draft.author_name.trim() || !draft.quote.trim()) return;
    submitMutation.mutate(draft);
  };

  const visible = testimonials.filter((t) => t.is_published !== false && t.quote);
  const display = visible.length > 0 ? visible : defaultTestimonials;

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

        {/* Visitor submission — created unpublished, then moderated in the admin panel */}
        <div className="mt-10 flex flex-col items-center">
          {submitted ? (
            <div className="flex items-center gap-3 border border-emerald-500/40 bg-emerald-500/10 px-6 py-4 text-sm text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>Thanks! Your testimonial has been sent for review and will appear once approved.</span>
            </div>
          ) : !formOpen ? (
            <Button onClick={() => setFormOpen(true)} variant="outline" className="rounded-none border-primary text-primary hover:bg-primary hover:text-primary-foreground">
              <PenLine className="mr-2 h-4 w-4" /> Share your experience
            </Button>
          ) : (
            <form onSubmit={submit} className="w-full max-w-2xl border border-border bg-card p-6">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><PenLine className="h-4 w-4" /> Leave a testimonial</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Input required placeholder="Your name" value={draft.author_name} onChange={(e) => setDraft({ ...draft, author_name: e.target.value })} className="rounded-none" />
                <Input placeholder="Team / location (optional)" value={draft.author_role} onChange={(e) => setDraft({ ...draft, author_role: e.target.value })} className="rounded-none" />
              </div>
              <Textarea required placeholder="Tell us about your experience…" value={draft.quote} onChange={(e) => setDraft({ ...draft, quote: e.target.value })} className="mt-3 min-h-28 rounded-none" />
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Rating</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button type="button" key={n} onClick={() => setDraft({ ...draft, rating: n })} aria-label={`${n} stars`}>
                    <Star className={`h-5 w-5 transition-colors ${n <= draft.rating ? "fill-primary text-primary" : "text-muted-foreground/40 hover:text-primary/60"}`} />
                  </button>
                ))}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="ghost" className="rounded-none" onClick={() => setFormOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!appParams.hasBase44Config || !draft.author_name.trim() || !draft.quote.trim() || submitMutation.isPending} className="rounded-none bg-primary hover:bg-primary/90">
                  <Send className="mr-2 h-4 w-4" /> {submitMutation.isPending ? "Sending…" : "Submit for review"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
