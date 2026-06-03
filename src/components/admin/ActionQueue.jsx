import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  PackageCheck,
  MessageSquare,
  UserPlus,
  AlertTriangle,
  PackageX,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

/* ─── Color map for left accent borders & icon tints ────── */
const COLOR_MAP = {
  primary:     { border: "border-l-primary",       icon: "text-primary" },
  amber:       { border: "border-l-amber-500",     icon: "text-amber-400" },
  emerald:     { border: "border-l-emerald-500",   icon: "text-emerald-400" },
  red:         { border: "border-l-red-500",        icon: "text-red-400" },
  destructive: { border: "border-l-destructive",    icon: "text-destructive" },
  slate:       { border: "border-l-slate-500",      icon: "text-slate-400" },
};

/* ─── Single Action Card ────────────────────────────────── */
function ActionCard({ icon: Icon, label, count, description, color, panel, onNavigate, index }) {
  const c = COLOR_MAP[color] || COLOR_MAP.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.08 * index, duration: 0.35, ease: "easeOut" }}
      className={`border border-border border-l-4 ${c.border} bg-card/40 cmd-glass hover:bg-card/60 transition-all duration-300`}
    >
      <div className="p-4 flex items-start gap-4">
        {/* Icon */}
        <div className="shrink-0 p-2 border border-border/50 bg-muted/30">
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 font-display text-3xl leading-none text-foreground tabular-nums">
            {count}
          </p>
          {description && (
            <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug truncate">
              {description}
            </p>
          )}
        </div>

        {/* Navigate button */}
        <button
          type="button"
          onClick={() => onNavigate(panel)}
          className="shrink-0 mt-1 flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-primary hover:text-accent transition-colors"
        >
          View
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Main ActionQueue ──────────────────────────────────── */
export default function ActionQueue({
  orders = [],
  forumPosts = [],
  registrations = [],
  products = [],
  news = [],
  testimonials = [],
  onNavigate = () => {},
}) {
  const actions = useMemo(() => {
    const now = Date.now();
    const DAY_MS = 86_400_000;

    /* 1 ── Orders to Fulfil */
    const toFulfil = orders.filter((o) => o.status === "paid");
    const fulfilNames = toFulfil
      .slice(0, 3)
      .map((o) => o.customer_name || o.customer_email || "—")
      .join(", ");

    /* 2 ── Posts to Moderate */
    const toModerate = forumPosts.filter((p) => p.is_published !== true);

    /* 3 ── New Registrations (24h) */
    const recentRegs = registrations.filter(
      (r) => r.created_date && now - new Date(r.created_date).getTime() < DAY_MS
    );

    /* 4 ── Low Stock Alerts */
    const lowStock = products.filter(
      (p) => p.is_active && p.stock_quantity <= 3 && p.stock_quantity > 0
    );
    const lowNames = lowStock.map((p) => p.name).join(", ");

    /* 5 ── Out of Stock */
    const outOfStock = products.filter(
      (p) => p.is_active && p.stock_quantity === 0
    );

    /* 6 ── Unpublished Content */
    const unpubNews = news.filter((n) => n.is_published !== true);
    const unpubTestimonials = testimonials.filter((t) => t.is_published !== true);
    const unpubCount = unpubNews.length + unpubTestimonials.length;

    /* 7 ── Problem Orders */
    const problemOrders = orders.filter(
      (o) => o.status === "cancelled" || o.status === "refunded"
    );

    return [
      {
        id: "fulfil",
        icon: PackageCheck,
        label: "Orders to Fulfil",
        count: toFulfil.length,
        description: fulfilNames || undefined,
        color: "primary",
        panel: "orders",
      },
      {
        id: "moderate",
        icon: MessageSquare,
        label: "Posts to Moderate",
        count: toModerate.length,
        description: undefined,
        color: "amber",
        panel: "forum",
      },
      {
        id: "registrations",
        icon: UserPlus,
        label: "New Registrations (24h)",
        count: recentRegs.length,
        description: undefined,
        color: "emerald",
        panel: "registrations",
      },
      {
        id: "lowstock",
        icon: AlertTriangle,
        label: "Low Stock Alerts",
        count: lowStock.length,
        description: lowNames || undefined,
        color: "red",
        panel: "store",
      },
      {
        id: "outofstock",
        icon: PackageX,
        label: "Out of Stock",
        count: outOfStock.length,
        description: undefined,
        color: "destructive",
        panel: "store",
      },
      {
        id: "unpublished",
        icon: FileText,
        label: "Unpublished Content",
        count: unpubCount,
        description: unpubCount > 0
          ? `${unpubNews.length} news, ${unpubTestimonials.length} testimonials`
          : undefined,
        color: "slate",
        panel: "news",
      },
      {
        id: "problems",
        icon: AlertCircle,
        label: "Problem Orders",
        count: problemOrders.length,
        description: undefined,
        color: "destructive",
        panel: "orders",
      },
    ];
  }, [orders, forumPosts, registrations, products, news, testimonials]);

  const visible = actions.filter((a) => a.count > 0);

  /* ── All-clear state ── */
  if (visible.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="border border-border bg-card/40 cmd-glass"
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" />
        <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
          <div className="p-3 border border-emerald-500/30 bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400">
            All Clear
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Nothing needs your attention right now.
          </p>
        </div>
      </motion.div>
    );
  }

  /* ── Action cards grid ── */
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {visible.map((action, i) => (
        <ActionCard
          key={action.id}
          index={i}
          icon={action.icon}
          label={action.label}
          count={action.count}
          description={action.description}
          color={action.color}
          panel={action.panel}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}
