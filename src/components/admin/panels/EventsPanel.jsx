import React from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Eye, Ticket } from "lucide-react";
import { base44 } from "@/api/base44Client";
import EventsManager from "../EventsManager";

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between border border-border bg-card/40 p-5">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-3xl text-foreground">{value}</p>
      </div>
      <Icon className="h-8 w-8 stroke-1 text-primary" />
    </div>
  );
}

export default function EventsPanel() {
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.EventContent.list("sort_order", 100) });

  const published = events.filter((e) => e.is_published !== false).length;
  const withTickets = events.filter((e) => (e.tickets || []).some((t) => t?.url) || e.ticket_url).length;

  return (
    <div className="grid gap-6">
      <div className="border border-border bg-card p-6">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-accent">Events</p>
        <h2 className="mt-2 font-display text-4xl uppercase leading-none">Event management</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Build out the full Vegas calendar — meetups, Stadium Swim, match-week parties and more. Each event can carry its own date, venue, photos, description and external ticket links across multiple price tiers.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={CalendarDays} label="Total events" value={events.length} />
        <Stat icon={Eye} label="Published (live)" value={published} />
        <Stat icon={Ticket} label="With ticket links" value={withTickets} />
      </div>

      <EventsManager events={events} />
    </div>
  );
}
