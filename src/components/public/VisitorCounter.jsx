import { Eye } from "lucide-react";
import { useVisitorCount } from "@/hooks/use-visitor-count";

/**
 * Compact site-wide visitor counter for the footer. Renders nothing until a real
 * count is known (and nothing at all if the backend is unreachable), so it never
 * shows a placeholder or a zero it can't stand behind.
 */
export default function VisitorCounter({ className = "" }) {
  const count = useVisitorCount();
  if (count === null || !Number.isFinite(count)) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 ${className}`}
      title="Total visitors to rugbyleaguetakeover.com"
    >
      <Eye className="h-3.5 w-3.5 text-primary/70" aria-hidden="true" />
      <span className="tabular-nums text-foreground/80">{count.toLocaleString()}</span>
      <span>visitors</span>
    </span>
  );
}
