/* ━━━ AdminSkeleton ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Skeleton loader variants for admin loading states.
 *
 * Usage:
 *   <AdminSkeleton variant="card" count={3} />
 *   <AdminSkeleton variant="stat-card" count={4} />
 *   <AdminSkeleton variant="table-row" count={5} />
 *   <AdminSkeleton variant="list-item" count={6} />
 */
import React from "react";

function SkeletonCard() {
  return (
    <div className="border border-border/30 bg-card/20 p-5 animate-pulse">
      <div className="flex justify-between mb-4">
        <div className="h-4 w-28 bg-muted/20 rounded" />
        <div className="h-5 w-16 bg-muted/15 rounded" />
      </div>
      <div className="h-3 w-full bg-muted/10 rounded mb-3" />
      <div className="h-3 w-3/4 bg-muted/10 rounded mb-3" />
      <div className="h-3 w-1/2 bg-muted/10 rounded" />
    </div>
  );
}

function SkeletonStatCard() {
  return (
    <div className="border border-border/30 bg-card/20 p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 bg-muted/15 rounded" />
        <div className="h-3 w-20 bg-muted/15 rounded" />
      </div>
      <div className="h-7 w-16 bg-muted/20 rounded" />
    </div>
  );
}

function SkeletonTableRow() {
  return (
    <div className="flex items-center gap-4 border-b border-border/20 px-4 py-3 animate-pulse">
      <div className="h-4 w-4 bg-muted/15 rounded" />
      <div className="h-4 w-32 bg-muted/15 rounded" />
      <div className="h-4 w-24 bg-muted/10 rounded ml-auto" />
      <div className="h-4 w-16 bg-muted/10 rounded" />
    </div>
  );
}

function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="h-10 w-10 bg-muted/15 rounded shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 bg-muted/15 rounded" />
        <div className="h-3 w-56 bg-muted/10 rounded" />
      </div>
    </div>
  );
}

const variants = {
  card: SkeletonCard,
  "stat-card": SkeletonStatCard,
  "table-row": SkeletonTableRow,
  "list-item": SkeletonListItem,
};

export default function AdminSkeleton({ variant = "card", count = 3, className = "" }) {
  const Component = variants[variant] || SkeletonCard;
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <Component key={i} />
      ))}
    </div>
  );
}
