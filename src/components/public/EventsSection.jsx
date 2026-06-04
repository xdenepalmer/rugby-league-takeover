import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Clock, MapPin, ArrowUpRight, Ticket } from "lucide-react";
import SectionHeader from "./SectionHeader";
import PublicDetailSheet from "./PublicDetailSheet";
import { formatVegasDate, formatVegasEventTime } from "@/lib/vegas-time";

const formatPrice = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? `$${number.toFixed(2)}` : "";
};

function EventDetailTickets({ event }) {
  if (!event) return null;
  const tickets = (event.tickets || []).filter((ticket) => ticket && (ticket.name || ticket.url));
  const hasTicketUrl = Boolean(event.ticket_url);

  if (event.is_coming_soon || (!tickets.length && !hasTicketUrl)) {
    return (
      <div className="border border-border/50 bg-background/30 p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Tickets & purchase links</p>
        <div className="flex min-h-11 items-center justify-between border border-border/50 bg-background/30 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          <span>Ticket details coming soon</span>
          <span>Not on sale yet</span>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">A direct purchase link will appear here once this event has confirmed ticket sales.</p>
      </div>
    );
  }

  return (
    <div className="border border-primary/30 bg-primary/[0.045] p-4">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Tickets & purchase links</p>
      <div className="grid gap-2">
        {tickets.map((ticket, index) => (
          ticket.sold_out || !ticket.url ? (
            <div key={index} className="flex items-center justify-between border border-border/50 bg-background/30 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              <span>{ticket.name || "Ticket"} {formatPrice(ticket.price_aud) && `· ${formatPrice(ticket.price_aud)}`}</span>
              <span>{ticket.sold_out ? "Sold out" : "Soon"}</span>
            </div>
          ) : (
            <a key={index} href={ticket.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between border border-primary bg-primary/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
              <span>{ticket.name || "Buy tickets"} {formatPrice(ticket.price_aud) && `· ${formatPrice(ticket.price_aud)}`}</span>
              <span className="flex items-center gap-1">Buy <ArrowUpRight className="h-4 w-4" /></span>
            </a>
          )
        ))}
        {hasTicketUrl && (
          <a href={event.ticket_url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between border border-primary bg-primary/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
            <span>Official tickets & event info</span>
            <span className="flex items-center gap-1">Open <ArrowUpRight className="h-4 w-4" /></span>
          </a>
        )}
      </div>
    </div>
  );
}

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
        <Ticket className="h-4 w-4" /> Tickets & info <ArrowUpRight className="h-4 w-4" />
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

function EventCard({ event, featured, index, onClick }) {
  const photo = event.photo_urls?.[0];
  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      onClick={() => onClick(event)}
      className={`group flex flex-col overflow-hidden border border-border/40 bg-card/30 backdrop-blur-sm hover:border-primary/30 hover:-translate-y-1 hover:shadow-[0_8px_30px_hsl(var(--primary)/0.1)] transition-all duration-300 cursor-pointer ${featured ? "lg:col-span-2 lg:flex-row" : ""}`}
    >
      <div className="h-[2px] w-full origin-left scale-x-0 bg-gradient-to-r from-primary via-accent to-primary transition-transform duration-500 group-hover:scale-x-100" />
      <div className={`relative overflow-hidden bg-secondary ${featured ? "lg:w-1/2" : ""}`}>
        {photo ? (
          <img src={photo} alt={event.title} loading="lazy" className={`w-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105 ${featured ? "h-64 lg:h-full" : "h-52"}`} />
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
          {formatVegasDate(event.event_date) && <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {formatVegasDate(event.event_date)}</span>}
          {formatVegasEventTime(event) && <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> {formatVegasEventTime(event)}</span>}
          {event.location && <span className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /> {event.location}</span>}
        </div>
        {event.address && <p className="mt-2 text-xs text-muted-foreground">{event.address}</p>}
        {event.blurb && <p className="mt-4 flex-1 text-sm leading-6 text-muted-foreground">{event.blurb}</p>}
        <EventTickets event={event} />
      </div>
    </motion.article>
  );
}

export default function EventsSection({ events, event }) {
  const [selectedCat, setSelectedCat] = useState("All");
  const [selectedEvent, setSelectedEvent] = useState(null);

  const source = useMemo(() => {
    return events?.length ? events : (event ? [event] : fallbackEvents);
  }, [events, event]);

  const categories = ["All", "Official Events", "Supporter Meetups", "Pool Parties"];

  const list = useMemo(() => {
    return source.filter((item) => item && item.is_published !== false);
  }, [source]);

  const filteredEvents = useMemo(() => {
    return list.filter((item) => {
      if (selectedCat === "All") return true;
      const title = (item.title || "").toLowerCase();
      const desc = (item.blurb || "").toLowerCase();

      const isPool = title.includes("swim") || title.includes("pool") || desc.includes("pool");
      const isMeetup = title.includes("meetup") || title.includes("drinks") || title.includes("party") || desc.includes("meetup");

      if (selectedCat === "Pool Parties") return isPool;
      if (selectedCat === "Supporter Meetups") return isMeetup && !isPool;
      if (selectedCat === "Official Events") return !isPool && !isMeetup;
      return true;
    });
  }, [list, selectedCat]);

  const handleCalendarDownload = (item) => {
    if (!item) return;
    const buildIcsDate = (dateStr, timeStr) => {
      if (!dateStr) return null;
      const d = new Date(timeStr ? `${dateStr}T${timeStr}` : dateStr);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    };
    const dtStart = buildIcsDate(item.event_date, item.start_time);
    const dtEnd = dtStart
      ? buildIcsDate(new Date(new Date(dtStart.length ? `${item.event_date}T${item.start_time || "00:00"}` : item.event_date).getTime() + 7200000).toISOString())
      : null;
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `SUMMARY:${item.title} - NRL Vegas Takeover`,
      `DESCRIPTION:${item.blurb || ""}`,
      `LOCATION:${item.location || ""} - ${item.address || ""}`,
      ...(dtStart ? [`DTSTART:${dtStart}`] : []),
      ...(dtEnd ? [`DTEND:${dtEnd}`] : []),
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\n");
    
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${item.title.replace(/\s+/g, "_")}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getTimezoneConversionText = (item) => {
    if (!item) return "";
    return `📅 Las Vegas time: ${formatVegasDate(item.event_date) || "TBD"} @ ${formatVegasEventTime(item) || "TBD"}

📍 Venue Address: ${item.address || item.location || "Vegas Strip"}

${item.blurb || ""}`;
  };

  if (list.length === 0) return null;

  return (
    <section className="relative border-t border-border bg-secondary/80 px-5 py-24 md:px-8 md:py-32">
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[600px] bg-primary/[0.03] blur-[120px]" />
      <div className="mx-auto max-w-7xl">
        <SectionHeader eyebrow="Events" title="What's on in Vegas">
          From Stadium Swim to supporter meetups and match-week parties, here's where the takeover comes together.
        </SectionHeader>

        {/* Categories Tabs */}
        <div className="flex border-b border-border/60 overflow-x-auto cmd-scrollbar bg-neutral-900/60 p-1 mb-8 max-w-xl">
          {categories.map((cat) => {
            const isActive = selectedCat === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCat(cat)}
                className={`relative flex items-center justify-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 shrink-0 select-none cursor-pointer ${
                  isActive ? "text-foreground font-extrabold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{cat}</span>
                {isActive && (
                  <motion.div
                    layoutId="events-active-tab-glow"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    style={{ boxShadow: "0 0 10px hsl(var(--primary)/0.6)" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Events Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {filteredEvents.map((item, index) => (
            <EventCard 
              key={item.id || index} 
              event={item} 
              featured={filteredEvents.length > 1 && index === 0} 
              index={index} 
              onClick={setSelectedEvent}
            />
          ))}
        </div>

        {filteredEvents.length === 0 && (
          <div className="border border-dashed border-border/50 py-16 text-center">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">No events listed in this category yet.</p>
          </div>
        )}
      </div>

      <PublicDetailSheet
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.title}
        category="Match Event"
        date={selectedEvent ? formatVegasDate(selectedEvent.event_date) : undefined}
        author="Vegas Coordinator"
        image={selectedEvent?.photo_urls?.[0]}
        body={selectedEvent ? getTimezoneConversionText(selectedEvent) : undefined}
        extraContent={<EventDetailTickets event={selectedEvent} />}
        ctaLabel="Add to Calendar (ICS)"
        onCtaClick={() => handleCalendarDownload(selectedEvent)}
      />
    </section>
  );
}