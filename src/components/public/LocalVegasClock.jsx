import React, { useEffect, useState } from "react";
import { Clock, MapPin } from "lucide-react";

const VEGAS_TZ = "America/Los_Angeles"; // Las Vegas observes Pacific Time (incl. DST)

const fmt = (date, timeZone) => {
  const opts = { timeZone, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true };
  const dateOpts = { timeZone, weekday: "short", day: "numeric", month: "short", year: "numeric" };
  return {
    time: new Intl.DateTimeFormat(undefined, opts).format(date),
    date: new Intl.DateTimeFormat(undefined, dateOpts).format(date),
  };
};

// Short timezone label, e.g. "GMT+1" / "PDT", derived from the formatter.
const tzLabel = (date, timeZone) => {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: "short" }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value || "";
  } catch {
    return "";
  }
};

function ClockRow({ icon: Icon, label, sublabel, time, date, accent }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <Icon className={`h-5 w-5 shrink-0 ${accent ? "text-primary" : "text-accent"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">{label}{sublabel ? ` · ${sublabel}` : ""}</p>
        <p className="font-display text-2xl tabular-nums leading-tight text-foreground sm:text-3xl">{time}</p>
      </div>
      <p className="text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:text-[11px]">{date}</p>
    </div>
  );
}

export default function LocalVegasClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const local = fmt(now, localTz);
  const vegas = fmt(now, VEGAS_TZ);

  return (
    <div role="status" aria-label="Current Las Vegas time" className="mx-auto mt-12 max-w-md divide-y divide-border border border-border bg-card/95 text-left shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
      <ClockRow icon={Clock} label="Your time" sublabel={tzLabel(now, localTz)} time={local.time} date={local.date} />
      <ClockRow icon={MapPin} label="Las Vegas" sublabel={tzLabel(now, VEGAS_TZ)} time={vegas.time} date={vegas.date} accent />
    </div>
  );
}
