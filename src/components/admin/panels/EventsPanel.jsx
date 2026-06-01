import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarDays, Eye, Ticket, Activity } from "lucide-react";
import { base44 } from "@/api/base44Client";
import EventsManager from "../EventsManager";
import TeamsManager from "../TeamsManager";
import MatchupsManager from "../MatchupsManager";

function Stat({ icon: Icon, label, value, color = "from-primary to-primary/60", delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="group relative overflow-hidden border border-border bg-card/60 cmd-glass hover:border-primary/30 transition-all duration-300"
    >
      <div className={`h-[2px] w-full bg-gradient-to-r ${color}`} />
      <div className="p-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-3xl text-foreground">{value}</p>
        </div>
        <div className="p-2 border border-border/50 bg-muted/30">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </motion.div>
  );
}

export default function EventsPanel() {
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.EventContent.list("sort_order", 100) });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list("sort_order", 100), retry: false, meta: { silent: true } });
  const { data: matchups = [] } = useQuery({ queryKey: ["matchups"], queryFn: () => base44.entities.Matchup.list("sort_order", 100), retry: false, meta: { silent: true } });

  const published = events.filter((e) => e.is_published !== false).length;
  const withTickets = events.filter((e) => (e.tickets || []).some((t) => t?.url) || e.ticket_url).length;

  return (
    <div className="grid gap-5">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden border border-border bg-card/60 cmd-glass"
      >
        <div className="cmd-accent-bar h-[2px] w-full" />
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-primary font-mono">
              Events Module
            </p>
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-primary/5 border border-primary/10">
              <Activity className="h-2.5 w-2.5 text-primary cmd-pulse" />
              <span className="text-[8px] font-bold uppercase tracking-wider text-primary">Live</span>
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl uppercase leading-none tracking-wide">
            Event Management
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Build out the full Vegas calendar — meetups, Stadium Swim, match-week parties and more.
            Each event can carry its own date, venue, photos, description and external ticket links across multiple price tiers.
          </p>
        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={CalendarDays} label="Total events" value={events.length} color="from-primary to-primary/60" delay={0.1} />
        <Stat icon={Eye} label="Published (live)" value={published} color="from-emerald-500 to-emerald-500/60" delay={0.15} />
        <Stat icon={Ticket} label="With ticket links" value={withTickets} color="from-accent to-accent/60" delay={0.2} />
      </div>

      {/* Manager */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        <EventsManager events={events} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <TeamsManager teams={teams} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
      >
        <MatchupsManager matchups={matchups} teams={teams} />
      </motion.div>
    </div>
  );
}
