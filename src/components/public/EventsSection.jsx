import React from "react";
import SectionHeader from "./SectionHeader";

const stadiumSwimPhotos = [
  "https://media.base44.com/images/public/6a18d49a2b8f40f0f81cc26e/f0655d20b_57895bb2-6bf0-4062-bbf3-78c2b309651a.jpeg",
  "https://media.base44.com/images/public/6a18d49a2b8f40f0f81cc26e/ac7fcf2a7_e3e79af1-bdf3-43c5-81a9-13e918072b94.jpg"
];

export default function EventsSection({ event }) {
  const photos = event?.photo_urls?.length ? event.photo_urls : stadiumSwimPhotos;

  return (
    <section id="events" className="border-t border-border bg-secondary/80 px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionHeader eyebrow="Events" title={event?.title || "Stadium Swim"}>
              {event?.blurb || "Stadium Swim plans are building for the end of February, with more fan meetups and Vegas supporter experiences to be announced soon."}
            </SectionHeader>
            <div className="inline-flex border border-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.28em] text-primary">End of February</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 aspect-[16/9] overflow-hidden border border-border">
              <img src={photos[0]} alt="Rugby League fans at Stadium Swim" className="h-full w-full object-cover" />
            </div>
            <div className="overflow-hidden border border-border">
              <img src={photos[1] || photos[0]} alt="Stadium Swim poolside fans" className="h-72 w-full object-cover" />
            </div>
            <div className="border border-border p-6">
              <p className="font-display text-4xl uppercase leading-none text-foreground">Stadium Swim</p>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">End of February. Poolside footy, Vegas energy and supporter groups from around the world.</p>
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