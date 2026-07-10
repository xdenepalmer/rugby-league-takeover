import { Link } from "react-router-dom";
import { ChevronRight, WifiOff, RefreshCw } from "lucide-react";
import AdSlot from "@/components/ads/AdSlot";

/** Skeleton block matching the boxy card language (no rounded bubbles). */
export function NativeSkeleton({ className = "" }) {
  return <div aria-hidden="true" className={`animate-pulse border border-border/40 bg-card/60 ${className}`} />;
}

export function NativeSectionHeader({ eyebrow, title, to, linkLabel = "See all" }) {
  return (
    <div className="flex items-end justify-between px-1 pb-2 pt-5">
      <div>
        {eyebrow && (
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-primary">{eyebrow}</p>
        )}
        <h2 className="font-display text-lg font-bold uppercase tracking-widest">{title}</h2>
      </div>
      {to && (
        <Link to={to} className="ios-pressable flex min-h-11 items-center gap-0.5 px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {linkLabel}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export function NativeListRow({ icon: Icon, label, detail, badge, onClick, tone = "default" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ios-pressable flex min-h-14 w-full items-center gap-3 border-b border-border/40 bg-card/40 px-4 text-left ${
        tone === "danger" ? "text-red-400" : tone === "admin" ? "text-emerald-300" : ""
      }`}
    >
      {Icon && <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold uppercase tracking-wide">{label}</span>
        {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
      </span>
      {badge ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-primary-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
    </button>
  );
}

export function NativeEmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center gap-2 border border-dashed border-border/60 bg-card/30 px-6 py-10 text-center">
      {Icon && <Icon className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />}
      <p className="font-display text-sm font-bold uppercase tracking-widest">{title}</p>
      {description && <p className="max-w-xs text-xs text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function NativeErrorState({ title = "Couldn't load", description, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 border border-red-500/30 bg-red-500/5 px-6 py-8 text-center">
      <WifiOff className="h-7 w-7 text-red-400" aria-hidden="true" />
      <p className="font-display text-sm font-bold uppercase tracking-widest">{title}</p>
      {description && <p className="max-w-xs text-xs text-muted-foreground">{description}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ios-pressable flex min-h-11 items-center gap-2 border border-border px-4 text-xs font-bold uppercase tracking-widest"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
      )}
    </div>
  );
}

/**
 * Sponsor inventory placement for native feeds: the existing AdSlot system
 * (server/admin-configured creatives) inside a card frame that collapses
 * entirely when there's no fill.
 */
export function NativeSponsorCard({ position = "banner-top" }) {
  return (
    <div className="empty:hidden [&:not(:has(*))]:hidden">
      <div className="border border-border/50 bg-card/40 p-2 [&:not(:has(img,iframe,a,video))]:hidden">
        <p className="pb-1 text-[8px] font-bold uppercase tracking-[0.3em] text-muted-foreground/70">Partner</p>
        <AdSlot position={position} size="leaderboard" />
      </div>
    </div>
  );
}
