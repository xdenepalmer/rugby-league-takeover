import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, ArrowUpRight } from "lucide-react";

const UNITS = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Mins" },
  { key: "seconds", label: "Secs" },
];

function getRemaining(target) {
  const diff = target - Date.now();
  if (diff <= 0) return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const seconds = Math.floor(diff / 1000);
  return {
    done: false,
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

const pad = (n) => String(n).padStart(2, "0");

function FlipUnit({ value, label }) {
  const display = pad(value);
  return (
    <div className="relative flex flex-col items-center">
      {/* Unit container box with premium glassmorphism and subtle primary shadow glow */}
      <div className="relative w-[72px] overflow-hidden border border-border bg-card/65 cmd-glass sm:w-24 md:w-28 shadow-[0_4px_20px_rgba(0,0,0,0.35)] hover:border-primary/45 transition-colors duration-300">
        
        {/* Glowing top line */}
        <div className="cmd-accent-bar h-[2px] w-full" />
        
        <div className="relative flex h-[72px] items-center justify-center sm:h-24 md:h-28">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={display}
              initial={{ y: "-50%", opacity: 0, scale: 0.95 }}
              animate={{ y: "0%", opacity: 1, scale: 1 }}
              exit={{ y: "50%", opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="absolute font-display text-4xl tabular-nums text-foreground sm:text-5xl md:text-6xl drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]"
            >
              {display}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
      <span className="mt-3.5 text-[9px] font-bold uppercase tracking-[0.35em] text-muted-foreground">{label}</span>
    </div>
  );
}

export default function CountdownTimer({ settings = {} }) {
  const target = useMemo(() => {
    const t = settings.countdown_date ? new Date(settings.countdown_date).getTime() : NaN;
    return Number.isFinite(t) ? t : null;
  }, [settings.countdown_date]);

  const [remaining, setRemaining] = useState(() => (target ? getRemaining(target) : null));

  useEffect(() => {
    if (!target) return undefined;
    setRemaining(getRemaining(target));
    const id = setInterval(() => setRemaining(getRemaining(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  // Hidden if disabled or no valid future/!date configured.
  if (settings.countdown_enabled === false || !target || !remaining) return null;

  return (
    <section className="relative overflow-hidden border-y border-border bg-background/85 px-5 py-20 md:px-8 md:py-28">
      {/* Laser glow highlight */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.12),transparent_60%)] shadow-inner" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px] opacity-15 pointer-events-none" />

      <div className="relative mx-auto max-w-5xl text-center z-10">
        <p className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.45em] text-primary">
          <CalendarClock className="h-4 w-4 animate-pulse text-accent" /> {settings.countdown_subtitle || "Las Vegas • NRL Takeover"}
        </p>
        
        <h2 className="mt-5 font-display text-4xl uppercase leading-[0.9] tracking-tight text-foreground sm:text-5xl md:text-6xl max-w-2xl mx-auto">
          {remaining.done ? "The takeover is live" : (settings.countdown_title || "The takeover begins in")}
        </h2>

        {remaining.done ? (
          <p className="mt-8 inline-flex border border-primary bg-primary/10 px-8 py-4 text-xs font-bold uppercase tracking-[0.25em] text-foreground shadow-[0_0_15px_rgba(249,115,22,0.2)]">
            🏉 It's happening now in Las Vegas
          </p>
        ) : (
          <div className="mt-10 flex items-start justify-center gap-2 sm:gap-4 md:gap-5 select-none">
            {UNITS.map((unit, i) => (
              <React.Fragment key={unit.key}>
                {i > 0 && (
                  <span className="pt-4 font-display text-2xl text-primary/45 sm:text-4xl md:pt-6 md:text-5xl animate-pulse self-center">
                    :
                  </span>
                )}
                <FlipUnit value={remaining[unit.key]} label={unit.label} />
              </React.Fragment>
            ))}
          </div>
        )}

        {settings.countdown_cta_url && settings.countdown_cta_label && (
          <a
            href={settings.countdown_cta_url}
            target="_blank"
            rel="noreferrer"
            className="mt-10 inline-flex items-center gap-2 border border-primary px-8 py-4 text-xs font-bold uppercase tracking-[0.25em] text-primary transition-all duration-300 hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] rounded-none"
          >
            {settings.countdown_cta_label} <ArrowUpRight className="h-4 w-4" />
          </a>
        )}
      </div>
    </section>
  );
}
