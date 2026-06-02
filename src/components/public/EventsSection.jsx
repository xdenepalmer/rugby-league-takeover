import React from "react";
import { CalendarDays, Clock, MapPin, ArrowUpRight, Ticket } from "lucide-react";
import SectionHeader from "./SectionHeader";

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value; // free-text dates pass through
  return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

const formatPrice = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? `$${number.toFixed(2)}` : "";
};

function EventTickets({ event }) {
  const tickets = (event.tickets || []).filter((t) => t && (t.name || t.url));

  if (event.is_coming_soon) {
    return <div className="mt-6 inline-flex w-fit border border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Details coming soon</div>;
  }

  if (tickets.length > 0) {
    return (
      <div className="mt-6 grid gap-2">
        {tickets.map((ticket, i) => (
          ticket.sold_out || !ticket.url ? (
            <div key={i} className="flex items-center justify-between border border-border px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              <span>{ticket.name || "Ticket"} {formatPrice(ticket.price_aud) && `· ${formatPrice(ticket.price_aud)}`}</span>
              <span>{ticket.sold_out ? "Sold out" : "Soon"}</span>
            </div>
          ) : (
            <a key={i} href={ticket.url} target="_blank" rel="noreferrer" className="flex items-center justify-between border border-primary px-4 py-3 min-h-[44px] text-xs font-bold uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
              <span>{ticket.name || "Buy tickets"} {formatPrice(ticket.price_aud) && `· ${formatPrice(ticket.price_aud)}`}</span>
              <span className="flex items-center gap-1">Buy <ArrowUpRight className="h-4 w-4" /></span>
            </a>
          )
        ))}
      </div>
    );
  }

  if (event.ticket_url) {
    return (
      <a href={event.ticket_url} target="_blank" rel="noreferrer" className="mt-6 inline-flex w-fit items-center gap-2 border border-primary px-5 py-3 min-h-[44px] text-xs font-bold uppercase tracking-[0.2em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
        <Ticket className="h-4 w-4" /> Tickets &amp; info <ArrowUpRight className="h-4 w-4" />
      </a>
    );
  }

  return <div className="mt-6 inline-flex w-fit border border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">More info soon</div>;
}

const fallbackEvents = [
  {
    title: "Stadium Swim",
    event_date: "End of February",
    location: "Las Vegas",
    blurb: "Poolside footy, Vegas energy and supporter groups from around the world. Official announcements coming soon.",
    photo_urls: [
      "https://media.base44.com/images/public/6a18d49a2b8f40f0f81cc26e/f0655d20b_57895bb2-6bf0-4062-bbf3-78c2b309651a.jpeg",
      "https://media.base44.com/images/public/6a18d49a2b8f40f0f81cc26e/ac7fcf2a7_e3e79af1-bdf3-43c5-81a9-13e918072b94.jpg",
    ],
    is_coming_soon: true,
  },
];

function EventCard({ event, featured }) {
  const photo = event.photo_urls?.[0];
  return (
    <article className={`group flex flex-col overflow-hidden border border-border bg-card ${featured ? "lg:col-span-2 lg:flex-row" : ""}`}>
      <div className={`relative overflow-hidden bg-secondary ${featured ? "lg:w-1/2" : ""}`}>
        {photo ? (
          <img src={photo} alt={event.title} loading="lazy" className={`w-full object-cover transition-transform duration-700 group-hover:scale-105 ${featured ? "h-64 lg:h-full" : "h-52"}`} />
        ) : (
          <div className={`flex items-center justify-center ${featured ? "h-64 lg:h-full" : "h-52"}`}><CalendarDays className="h-10 w-10 text-muted-foreground" /></div>
        )}
        {event.is_coming_soon && (
          <span className="absolute left-0 top-0 bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground">Coming soon</span>
        )}
      </div>
      <div className={`flex flex-1 flex-col p-6 ${featured ? "lg:w-1/2 lg:p-8" : ""}`}>
        <h3 className="font-display text-3xl uppercase leading-none text-foreground md:text-4xl">{event.title}</h3>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          {formatDate(event.event_date) && <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {formatDate(event.event_date)}</span>}
          {event.start_time && <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> {event.start_time}</span>}
          {event.location && <span className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /> {event.location}</span>}
        </div>
        {event.address && <p className="mt-2 text-xs text-muted-foreground">{event.address}</p>}
        {event.blurb && <p className="mt-4 flex-1 text-sm leading-6 text-muted-foreground">{event.blurb}</p>}
        <EventTickets event={event} />
      </div>
    </article>
  );
}

// Accepts `events` (array, preferred) or a legacy single `event` prop.
export default function EventsSection({ events, event }) {
  const source = events?.length ? events : (event ? [event] : fallbackEvents);
  const list = source.filter((item) => item && item.is_published !== false);
  if (list.length === 0) return null;

  return (
    <section id="events" className="border-t border-border bg-secondary/80 px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeader eyebrow="Events" title="What's on in Vegas">
          From Stadium Swim to supporter meetups and match-week parties, here's where the takeover comes together.
        </SectionHeader>
        <div className="grid gap-6 lg:grid-cols-2">
          {list.map((item, index) => (
            <EventCard key={item.id || index} event={item} featured={list.length > 1 && index === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
