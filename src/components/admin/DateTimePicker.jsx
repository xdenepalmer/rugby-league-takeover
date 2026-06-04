import React, { useState, useMemo } from "react";
import { format, isValid } from "date-fns";
import { CalendarClock, Clock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";

const pad = (n) => String(n).padStart(2, "0");

// The admin enters times in **Pacific Time** (Las Vegas).
// We store an ISO-8601 string with the PT offset so Base44/frontend shows it
// correctly regardless of the viewer's local timezone.
const VEGAS_TZ = "America/Los_Angeles";

// Format a Date in PT for display
const fmtPT = (d) => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
      timeZone: VEGAS_TZ,
    }).format(d);
  } catch {
    return format(d, "EEE d MMM yyyy 'at' h:mm a");
  }
};

// Get the hours and minutes of a Date as they appear in PT
const getPTTime = (d) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit", minute: "2-digit", hour12: false,
      timeZone: VEGAS_TZ,
    }).formatToParts(d);
    const h = parts.find((p) => p.type === "hour")?.value ?? "19";
    const m = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${pad(Number(h))}:${pad(Number(m))}`;
  } catch {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
};

// Get the calendar date parts as they appear in PT
const getPTDate = (d) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      year: "numeric", month: "2-digit", day: "2-digit",
      timeZone: VEGAS_TZ,
    }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value;
    const mo = parts.find((p) => p.type === "month")?.value;
    const da = parts.find((p) => p.type === "day")?.value;
    return `${y}-${mo}-${da}`;
  } catch {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
};

// Build an ISO string that represents a specific date+time **in PT**.
// E.g. the admin picks Feb 28, 7:00 PM → "2026-02-28T19:00:00-08:00"
// We use a temporary Intl trick to find the PT offset at that moment.
const buildPTIso = (dateStr, timeStr) => {
  // dateStr: "YYYY-MM-DD", timeStr: "HH:MM"
  const [h, m] = (timeStr || "19:00").split(":");
  // Create a rough Date in UTC for that wall-clock, then find PT offset
  const rough = new Date(`${dateStr}T${pad(Number(h))}:${pad(Number(m))}:00Z`);
  // Get the PT offset in minutes at this instant
  try {
    const localStr = rough.toLocaleString("en-US", { timeZone: VEGAS_TZ });
    const localDate = new Date(localStr + " UTC"); // treat the PT wall-clock as UTC
    const offsetMin = (rough.getTime() - localDate.getTime()) / 60000;
    const sign = offsetMin <= 0 ? "+" : "-";
    const absH = Math.floor(Math.abs(offsetMin) / 60);
    const absM = Math.abs(offsetMin) % 60;
    return `${dateStr}T${pad(Number(h))}:${pad(Number(m))}:00${sign}${pad(absH)}:${pad(absM)}`;
  } catch {
    // Fallback: store as-is with a PT-ish offset
    return `${dateStr}T${pad(Number(h))}:${pad(Number(m))}:00-07:00`;
  }
};

export default function DateTimePicker({ value, onChange, placeholder = "Pick a date & time" }) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const current = value ? new Date(value) : null;
  const valid = current && isValid(current);
  const timeStr = valid ? getPTTime(current) : "19:00";

  // Calendar selected day should reflect the PT date, not local date
  const calendarDate = useMemo(() => {
    if (!valid) return undefined;
    const ptDate = getPTDate(current);
    // Parse as noon local to avoid day-boundary issues in the calendar widget
    return new Date(ptDate + "T12:00:00");
  }, [valid, current]);

  const applyDate = (day) => {
    if (!day) return;
    const dateStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    onChange(buildPTIso(dateStr, timeStr));
  };

  const applyTime = (t) => {
    if (!t) return;
    const dateStr = valid ? getPTDate(current) : (() => { const n = new Date(); return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`; })();
    onChange(buildPTIso(dateStr, t));
  };

  if (isMobile) {
    return (
      <label className="grid gap-1.5">
        <span className="sr-only">{placeholder}</span>
        <div className="relative">
          <Input
            type="datetime-local"
            value={valid ? `${getPTDate(current)}T${timeStr}` : ""}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) { onChange(""); return; }
              const [d, t] = v.split("T");
              onChange(buildPTIso(d, t));
            }}
            className="h-11 rounded-none border-border bg-background text-sm"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wider text-primary pointer-events-none">PT</span>
        </div>
      </label>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-11 w-full items-center gap-2 rounded-none border border-border bg-background px-3 text-left text-sm transition-colors hover:border-primary"
        >
          <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
          {valid
            ? <span className="text-foreground">{fmtPT(current)} <span className="text-[9px] font-bold uppercase tracking-wider text-primary ml-1">PT</span></span>
            : <span className="text-muted-foreground">{placeholder}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto rounded-none p-0">
        <Calendar mode="single" selected={calendarDate} onSelect={applyDate} initialFocus />
        <div className="flex items-center gap-2 border-t border-border p-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Time <span className="text-primary">(PT)</span></span>
          <Input type="time" value={timeStr} onChange={(e) => applyTime(e.target.value)} className="ml-auto h-9 w-36 rounded-none" />
        </div>
        {valid && (
          <div className="flex justify-end border-t border-border p-2">
            <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-destructive">
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
