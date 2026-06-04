import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Swords, MapPin, ArrowUpRight, Calendar } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import TeamCrest from "./TeamCrest";
import { formatVegasDateTime } from "@/lib/vegas-time";

const norm = (s) => String(s || "").trim().toLowerCase();

const handleCalendarDownload = (m) => {
  if (!m) return;
  const summary = `${m.home_team} vs ${m.away_team} - NRL Las Vegas`;
  const description = `Watch ${m.home_team} take on ${m.away_team} at ${m.venue || "Las Vegas"}.`;
  const location = m.venue || "Las Vegas, NV";
  const formatIcsDate = (date) => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };
  const dtStart = formatIcsDate(m.kickoff);
  const dtEnd = dtStart ? formatIcsDate(new Date(new Date(m.kickoff).getTime() + 3600000)) : null;
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    ...(dtStart ? [`DTSTART:${dtStart}`] : []),
    ...(dtEnd ? [`DTEND:${dtEnd}`] : []),
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\n");
  
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `${m.home_team}_vs_${m.away_team}.ics`.replace(/\s+/g, "_");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};


function TeamBadge({ name, logo, won }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      <TeamCrest name={name} logo={logo} className={`h-16 w-16 text-lg md:h-20 md:w-20 md:text-2xl ${won ? "" : ""}`} />
      <span className={`font-display text-sm uppercase leading-tight md:text-base ${won ? "text-primary" : "text-foreground"}`}>{name}{won && <span className="ml-1 align-middle text-[9px] tracking-widest text-emerald-400">▲</span>}</span>
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
          {visible.map((m) => {
            const isFinal = m.status === "final" && m.home_score != null && m.away_score != null;
            const homeWon = isFinal && Number(m.home_score) > Number(m.away_score);
            const awayWon = isFinal && Number(m.away_score) > Number(m.home_score);
            return (
            <article key={m.id} className="border border-border bg-card p-6">
              {m.label && <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-accent">{m.label}</p>}
              <div className="flex items-center justify-between gap-4">
                <TeamBadge name={m.home_team} logo={logoFor(m.home_team, m.home_logo)} won={homeWon} />
                {isFinal ? (
                  <span className="font-display text-2xl tabular-nums text-foreground md:text-4xl"><span className={homeWon ? "text-primary" : ""}>{m.home_score}</span><span className="mx-1.5 text-muted-foreground">–</span><span className={awayWon ? "text-primary" : ""}>{m.away_score}</span></span>
                ) : (
                  <span className="font-display text-2xl text-primary md:text-3xl">VS</span>
                )}
                <TeamBadge name={m.away_team} logo={logoFor(m.away_team, m.away_logo)} won={awayWon} />
              </div>
              {isFinal ? (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border pt-4 text-xs font-bold uppercase tracking-[0.18em]">
                  <span className="border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-emerald-400">{m.result_note || "Full Time"}</span>
                  {m.venue && <span className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {m.venue}</span>}
                </div>
              ) : (m.kickoff || m.venue) && (
                <div className="mt-5 border-t border-border pt-4 text-xs tracking-wider text-muted-foreground">
                  {m.kickoff && (
                    <div className="mb-3 flex items-center justify-center gap-1.5 font-bold uppercase text-accent">
                      <span className="text-[10px]">Las Vegas:</span>
                      <span>{formatVegasDateTime(m.kickoff)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-4 text-[11px] font-bold uppercase tracking-[0.15em]">
                    {m.venue && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {m.venue}</span>}
                    {m.kickoff && (
                      <button
                        type="button"
                        onClick={() => handleCalendarDownload(m)}
                        className="flex items-center gap-1 text-primary hover:text-accent transition-colors duration-200 cursor-pointer bg-transparent border-0 p-0"
                      >
                        <Calendar className="h-3.5 w-3.5" /> Add to Cal
                      </button>
                    )}
                  </div>
                </div>
              )}
              {m.ticket_url && (
                <div className="mt-4 text-center">
                  <a href={m.ticket_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 border border-primary px-5 py-3 min-h-[44px] text-[10px] font-bold uppercase tracking-[0.2em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
                    Tickets <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}