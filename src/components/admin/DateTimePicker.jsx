import React, { useState } from "react";
import { format, isValid } from "date-fns";
import { CalendarClock, Clock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

const pad = (n) => String(n).padStart(2, "0");
// Emits a local "YYYY-MM-DDTHH:mm" string (same shape the countdown/event fields use).
const toLocalValue = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function DateTimePicker({ value, onChange, placeholder = "Pick a date & time" }) {
  const [open, setOpen] = useState(false);
  const current = value ? new Date(value) : null;
  const valid = current && isValid(current);
  const timeStr = valid ? `${pad(current.getHours())}:${pad(current.getMinutes())}` : "19:00";

  const applyDate = (day) => {
    if (!day) return;
    const [h, m] = timeStr.split(":");
    const next = new Date(day);
    next.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
    onChange(toLocalValue(next));
  };

  const applyTime = (t) => {
    if (!t) return;
    const [h, m] = t.split(":");
    const base = valid ? new Date(current) : new Date();
    base.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
    onChange(toLocalValue(base));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-11 w-full items-center gap-2 rounded-none border border-border bg-background px-3 text-left text-sm transition-colors hover:border-primary"
        >
          <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
          {valid
            ? <span className="text-foreground">{format(current, "EEE d MMM yyyy 'at' h:mm a")}</span>
            : <span className="text-muted-foreground">{placeholder}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto rounded-none p-0">
        <Calendar mode="single" selected={valid ? current : undefined} onSelect={applyDate} initialFocus />
        <div className="flex items-center gap-2 border-t border-border p-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Time</span>
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
