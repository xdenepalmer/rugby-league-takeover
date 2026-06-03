import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  ShoppingBag,
  UserPlus,
  MessageSquare,
  Hourglass,
  Filter,
} from "lucide-react";

/* ─── Relative Time Helper ──────────────────────────────── */
function relativeTime(dateStr) {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

/* ─── Mask email for privacy ────────────────────────────── */
function maskEmail(email) {
  if (!email || typeof email !== "string") return "unknown";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.charAt(0)}***@${domain}`;
}

/* ─── Filter Buttons ────────────────────────────────────── */
const FILTERS = [
  { key: "all", label: "All" },
  { key: "order", label: "Orders" },
  { key: "signup", label: "Signups" },
  { key: "post", label: "Posts" },
];

/* ─── Item config by type ───────────────────────────────── */
const TYPE_CONFIG = {
  order: {
    icon: ShoppingBag,
    dotClass: "bg-emerald-400",
    iconClass: "text-emerald-400",
    borderHover: "hover:border-emerald-500/30",
  },
  signup: {
    icon: UserPlus,
    dotClass: "bg-primary",
    iconClass: "text-primary",
    borderHover: "hover:border-primary/30",
  },
  post: {
    icon: MessageSquare,
    dotClass: "bg-blue-400",
    iconClass: "text-blue-400",
    borderHover: "hover:border-blue-500/30",
  },
};

/* ─── Main Component ────────────────────────────────────── */
export default function ActivityFeed({ orders = [], registrations = [], forumPosts = [] }) {
  const [activeFilter, setActiveFilter] = useState("all");

  // Merge all data sources into a single timeline
  const allActivity = useMemo(() => {
    const items = [];

    // Orders
    orders.forEach((o) => {
      const orderId = o.id ? String(o.id).substring(0, 6).toUpperCase() : "???";
      const total = Number(o.total_aud || 0).toFixed(2);
      items.push({
        type: "order",
        created_date: o.created_date,
        description: `New order #${orderId} — $${total} AUD`,
      });
    });

    // Registrations
    registrations.forEach((r) => {
      const email = r.email || r.Email || "";
      items.push({
        type: "signup",
        created_date: r.created_date,
        description: `New signup: ${maskEmail(email)}`,
      });
    });

    // Forum posts
    forumPosts.forEach((p) => {
      const title = p.title || p.content || "Untitled";
      const truncated = title.length > 40 ? title.substring(0, 40) + "…" : title;
      items.push({
        type: "post",
        created_date: p.created_date,
        description: `New forum post: ${truncated}`,
      });
    });

    // Sort descending by created_date
    items.sort((a, b) => {
      const aTime = a.created_date ? new Date(a.created_date).getTime() : 0;
      const bTime = b.created_date ? new Date(b.created_date).getTime() : 0;
      return bTime - aTime;
    });

    return items;
  }, [orders, registrations, forumPosts]);

  // Apply filter
  const filtered = useMemo(() => {
    const base = activeFilter === "all" ? allActivity : allActivity.filter((i) => i.type === activeFilter);
    return base.slice(0, 20);
  }, [allActivity, activeFilter]);

  const totalCount = allActivity.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="border border-border bg-card/60 cmd-glass overflow-hidden"
    >
      {/* Top accent bar */}
      <div className="cmd-accent-bar h-[2px] w-full" />

      <div className="p-5">
        {/* ── Header row ── */}
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-primary cmd-pulse" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground font-display">
            Activity Feed
          </h3>
          {totalCount > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary cmd-blink" />
              {totalCount}
            </span>
          )}
        </div>

        {/* ── Filter buttons ── */}
        <div className="flex items-center gap-1.5 mb-4">
          <Filter className="h-3 w-3 text-muted-foreground mr-1" />
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider font-mono transition-all border ${
                activeFilter === f.key
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Scrollable list ── */}
        <div className="max-h-[400px] overflow-y-auto cmd-scrollbar">
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <Hourglass className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No activity yet</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Orders, signups and posts will appear here
                </p>
              </motion.div>
            ) : (
              <div className="grid gap-1.5">
                {filtered.map((item, i) => {
                  const config = TYPE_CONFIG[item.type];
                  const Icon = config.icon;

                  return (
                    <motion.div
                      key={`${item.type}-${item.created_date}-${i}`}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16, height: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04, ease: "easeOut" }}
                      className={`group flex items-center gap-3 border border-border/40 bg-muted/10 p-3 transition-colors ${config.borderHover}`}
                    >
                      {/* Color-coded dot */}
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className={`absolute inset-0 rounded-full ${config.dotClass} opacity-30 animate-ping`} />
                        <span className={`relative inline-flex h-2 w-2 rounded-full ${config.dotClass}`} />
                      </span>

                      {/* Icon */}
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center border border-border/50 bg-muted/30 ${config.iconClass}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>

                      {/* Description */}
                      <span className="min-w-0 flex-1 text-sm text-foreground leading-snug truncate">
                        {item.description}
                      </span>

                      {/* Relative time */}
                      <span className="shrink-0 text-[10px] font-mono text-muted-foreground/70 tabular-nums whitespace-nowrap">
                        {relativeTime(item.created_date)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
