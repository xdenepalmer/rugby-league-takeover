import React from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { DollarSign } from "lucide-react";
import { motion } from "framer-motion";

function ChartTooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 border border-border p-3 shadow-xl backdrop-blur-sm">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm font-bold" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
}

const PIE_COLORS = ["hsl(15, 95%, 55%)", "hsl(45, 93%, 47%)", "#3b82f6", "#10b981", "#8b5cf6"];

export default function AdminOverviewCharts({ regData, revData, pieData }) {
  return (
    <>
      {/* ── Charts Grid ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Registrations Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="border border-border bg-card/60 cmd-glass overflow-hidden"
        >
          <div className="h-[2px] w-full bg-gradient-to-r from-primary via-primary/60 to-primary" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-200">
                  Registration Signups
                </h3>
                <p className="text-[9px] font-mono text-slate-300 mt-0.5">
                  Last 7 data points
                </p>
              </div>
            </div>

            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={regData}>
                  <defs>
                    <linearGradient id="cmdRegGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(15, 95%, 55%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(15, 95%, 55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 12%)" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="Signups"
                    stroke="hsl(15, 95%, 55%)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#cmdRegGrad)"
                    dot={{ r: 3, fill: "hsl(15, 95%, 55%)", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "hsl(15, 95%, 55%)", stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="border border-border bg-card/60 cmd-glass overflow-hidden"
        >
          <div className="h-[2px] w-full bg-gradient-to-r from-accent via-accent/60 to-accent" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-200">
                  Revenue Stream (AUD)
                </h3>
                <p className="text-[9px] font-mono text-slate-300 mt-0.5">
                  Last 7 data points
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-accent/5 border border-accent/10">
                <DollarSign className="h-3 w-3 text-accent" />
                <span className="text-[8px] font-bold uppercase tracking-wider text-accent">Stripe</span>
              </div>
            </div>

            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revData}>
                  <defs>
                    <linearGradient id="cmdRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 12%)" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="Sales" fill="url(#cmdRevGrad)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Pie Chart */}
      {pieData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="border border-border bg-card/60 cmd-glass overflow-hidden"
        >
          <div className="h-[2px] w-full bg-gradient-to-r from-blue-500 via-violet-500 to-blue-500" />
          <div className="p-5">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-4">
              Order Status Distribution
            </h3>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend
                    formatter={(value) => (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}
