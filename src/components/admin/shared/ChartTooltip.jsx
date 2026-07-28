/* ━━━ ChartTooltip ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Dark-theme recharts tooltip shared by the admin charts. Pass `formatValue` to
 * control how numbers render (currency, plain counts, or per-series rules).
 */
import React from "react";
import { formatCount } from "@/lib/format";

const defaultFormatValue = (value) => (typeof value === "number" ? formatCount(value) : value);

export default function ChartTooltip({ active, payload, label, formatValue = defaultFormatValue }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-none bg-card/95 border border-border p-3 shadow-xl backdrop-blur-sm">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm font-bold" style={{ color: entry.color }}>
          {entry.name}: {formatValue(entry.value, entry.name)}
        </p>
      ))}
    </div>
  );
}
