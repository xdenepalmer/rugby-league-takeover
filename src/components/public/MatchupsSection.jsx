import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Swords, CalendarDays, MapPin, ArrowUpRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import TeamCrest from "./TeamCrest";

const norm = (s) => String(s || "").trim().toLowerCase();

const formatKickoff = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

function TeamBadge({ name, logo }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      <TeamCrest name={name} logo={logo} className="h-16 w-16 text-lg md:h-20 md:w-20 md:text-2xl" />
      <span className="font-display text-sm uppercase leading-tight text-foreground md:text-base">{name}</span>
    </div>
  );
}

export default function MatchupsSection() {
  const { data: matchups = [] } = useQuery({
    queryKey: ["matchups"],
    queryFn: () => base44.entities.Matchup.list("sort_order", 50),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list("name", 200),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

  // Prefer the club's current uploaded crest (resolved by name), then the snapshot
  // stored on the match-up, then fall back to the auto monogram in TeamCrest.
  const logoByName = new Map((teams || []).map((t) => [norm(t.name), t.logo_url || ""]));
  const logoFor = (name, snapshot) => logoByName.get(norm(name)) || snapshot || "";

  const visible = matchups.filter((m) => m.is_published !== false && m.home_team && m.away_team);
  if (visible.length === 0) return null;

  return (
    <section id="matchups" className="border-b border-border bg-background/90 px-5 py-16 md:px-8 md:py-20">
      <div className="mx-auto max-w-5xl">
        <p className="flex items-center justify-center gap-2 text-center text-xs font-bold uppercase tracking-[0.4em] text-primary">
          <Swords className="h-4 w-4" /> The Match-ups
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {visible.map((m) => (
            <article key={m.id} className="border border-border bg-card p-6">
              {m.label && <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-accent">{m.label}</p>}
              <div className="flex items-center justify-between gap-4">
                <TeamBadge name={m.home_team} logo={logoFor(m.home_team, m.home_logo)} />
                <span className="font-display text-2xl text-primary md:text-3xl">VS</span>
                <TeamBadge name={m.away_team} logo={logoFor(m.away_team, m.away_logo)} />
              </div>
              {(m.kickoff || m.venue) && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border pt-4 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {m.kickoff && <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-primary" /> {formatKickoff(m.kickoff)}</span>}
                  {m.venue && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {m.venue}</span>}
                </div>
              )}
              {m.ticket_url && (
                <div className="mt-4 text-center">
                  <a href={m.ticket_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 border border-primary px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
                    Tickets <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
