import React from "react";
import SectionHeader from "./SectionHeader";

export default function EventsSection({ event }) {
  const photos = event?.photo_urls?.length ? event.photo_urls : ["https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80"];

  return (
    <section id="events" className="border-t border-border bg-secondary/80 px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionHeader eyebrow="Events" title={event?.title || "Coming soon"}>
              {event?.blurb || "More Rugby League Takeover events are coming soon, including fan meetups, game day gatherings and Vegas supporter experiences."}
            </SectionHeader>
            <div className="inline-flex border border-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.28em] text-primary">Coming Soon</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 aspect-[16/9] overflow-hidden border border-border">
              <img src={photos[0]} alt="Rugby League Takeover event" className="h-full w-full object-cover grayscale" />
            </div>
            <div className="border border-border p-6">
              <p className="font-display text-4xl uppercase leading-none text-foreground">Stadium Swim March</p>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Photos and event details can be added by the admin team as they become available.</p>
            </div>
            <div className="border border-border bg-background p-6">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Next wave</p>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Watch this space for official event announcements.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}