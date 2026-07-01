import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import { format, subDays, parseISO, startOfDay } from "date-fns";

function buildTimeSeries(registrations, days = 60) {
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const key = format(subDays(new Date(), i), "MMM d");
    buckets[key] = { date: key, signups: 0, travelInterests: 0 };
  }

  registrations.forEach((r) => {
    const date = r.created_date ? parseISO(r.created_date) : null;
    if (!date) return;
    const key = format(startOfDay(date), "MMM d");
    if (buckets[key]) {
      if (r.fan_events_only) {
        buckets[key].signups += 1;
      } else {
        buckets[key].travelInterests += 1;
        buckets[key].signups += 1;
      }
    }
  });

  // Build cumulative totals
  let cumSignups = 0;
  let cumTravel = 0;
  return Object.values(buckets).map((d) => {
    cumSignups += d.signups;
    cumTravel += d.travelInterests;
    return { ...d, cumSignups, cumTravel };
  });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-border bg-card/95 backdrop-blur-sm px-3 py-2 text-xs shadow-xl">
      <p className="font-bold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-mono">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function GrowthChart({ registrations = [] }) {
  const data = useMemo(() => buildTimeSeries(registrations, 60), [registrations]);
  const totalSignups = registrations.length;
  const travelCount = registrations.filter((r) => !r.fan_events_only).length;
  const last7 = registrations.filter((r) => {
    if (!r.created_date) return false;
    return parseISO(r.created_date) >= subDays(new Date(), 7);
  }).length;

  return (
    <div className="border border-border bg-card/60 cmd-glass overflow-hidden">
      <div className="h-[2px] w-full bg-gradient-to-r from-primary via-accent to-primary" />
      <div className="p-5">
        <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 border border-border/50 bg-muted/30">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Event Growth</p>
              <p className="text-sm font-bold text-foreground">Fan Signups & Travel Interests</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Total Signups</p>
              <p className="font-display text-2xl text-primary">{totalSignups}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Travel Interest</p>
              <p className="font-display text-2xl text-accent">{travelCount}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Last 7 Days</p>
              <p className="font-display text-2xl text-emerald-400">+{last7}</p>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradSignups" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(15 95% 55%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(15 95% 55%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradTravel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(45 93% 47%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(45 93% 47%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 15%)" />
            <XAxis
              dataKey="date"
              tick={{ fill: "hsl(215 20% 55%)", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              interval={9}
            />
            <YAxis
              tick={{ fill: "hsl(215 20% 55%)", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "10px", paddingTop: "8px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em" }}
            />
            <Area
              type="monotone"
              dataKey="cumSignups"
              name="Total Fan Signups"
              stroke="hsl(15 95% 55%)"
              strokeWidth={2}
              fill="url(#gradSignups)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="cumTravel"
              name="Travel Interests"
              stroke="hsl(45 93% 47%)"
              strokeWidth={2}
              fill="url(#gradTravel)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        <p className="mt-2 text-[9px] text-muted-foreground text-right font-mono">Cumulative totals · last 60 days</p>
      </div>
    </div>
  );
}