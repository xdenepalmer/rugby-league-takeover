import { Eye, Users } from "lucide-react";
import { useVisitorStats } from "@/hooks/use-visitor-count";

const StatTile = ({ label, value, hint, icon: Icon, accent }) => (
  <div className="group relative overflow-hidden border border-border bg-card/60 cmd-glass transition-all duration-300 hover:border-primary/30">
    <div className={`h-[2px] w-full bg-gradient-to-r ${accent}`} />
    <div className="flex items-center justify-between p-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-3xl tabular-nums text-foreground">{value.toLocaleString()}</p>
        <p className="mt-1 text-[9px] font-mono text-muted-foreground">{hint}</p>
      </div>
      <div className="border border-border/50 bg-muted/30 p-2">
        <Icon className="h-5 w-5 text-cyan-400" aria-hidden="true" />
      </div>
    </div>
  </div>
);

const sinceLabel = (iso) => {
  if (!iso) return "Distinct devices";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Distinct devices";
  return `Distinct devices since ${date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
};

/**
 * The two site traffic counters, for the team only — this deliberately does not
 * appear on the public site.
 *
 * They measure different things and will diverge: total views counts every page
 * a person opens, so one enthusiastic supporter clicking through the store adds
 * a dozen. Unique visitors counts the device once, however long they stay. Views
 * divided by visitors is roughly how deep people are browsing.
 *
 * Renders nothing until real numbers are known, so it never shows a placeholder
 * or a zero it can't stand behind.
 */
export default function VisitorCounter({ className = "" }) {
  const stats = useVisitorStats();
  if (!stats || !Number.isFinite(stats.totalViews) || !Number.isFinite(stats.uniqueVisitors)) {
    return null;
  }

  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${className}`}>
      <StatTile
        label="Total views"
        value={stats.totalViews}
        hint="Every page opened"
        icon={Eye}
        accent="from-cyan-500 via-cyan-400 to-cyan-500"
      />
      <StatTile
        label="Unique visitors"
        value={stats.uniqueVisitors}
        hint={sinceLabel(stats.uniqueSince)}
        icon={Users}
        accent="from-sky-500 via-sky-400 to-sky-500"
      />
    </div>
  );
}
