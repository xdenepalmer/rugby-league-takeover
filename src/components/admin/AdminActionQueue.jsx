import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingBag, MessageSquare, PackageX, Heart, FileText, ChevronRight, CheckCircle2 } from "lucide-react";

/* ━━━ Owner Command Center — "what needs me now" ━━━━━━━━━━━━━━━━━━━━━━
 * Turns the overview into a prioritised action queue. Pure: derives counts
 * from data the panel already fetched (no extra requests). Each row links to
 * the relevant admin section and is touch-friendly (>=44px).
 */
const ORDER_OPEN = ["pending", "paid", "processing"]; // not yet shipped/closed
const LOW_STOCK_AT = 5;
const NEW_REG_DAYS = 7;

export default function AdminActionQueue({
  orders = [],
  forumPosts = [],
  registrations = [],
  products = [],
  news = [],
  testimonials = [],
}) {
  const items = useMemo(() => {
    const since = Date.now() - NEW_REG_DAYS * 86400000;

    const ordersToFulfil = orders.filter((o) => ORDER_OPEN.includes(String(o?.status || "pending"))).length;
    const postsToModerate = forumPosts.filter((p) => p?.is_published !== true).length;
    const lowStock = products.filter(
      (p) => p?.stock_quantity != null && Number(p.stock_quantity) <= LOW_STOCK_AT
    ).length;
    const newRegistrations = registrations.filter((r) => {
      const t = new Date(r?.created_date).getTime();
      return Number.isFinite(t) && t >= since;
    }).length;
    const draftContent =
      news.filter((n) => n?.is_published === false).length +
      testimonials.filter((t) => t?.is_published === false).length;

    return [
      { key: "orders", count: ordersToFulfil, label: "Orders to fulfil", to: "/admin/store", icon: ShoppingBag, tone: "text-primary", bar: "from-primary/70 to-primary/20" },
      { key: "posts", count: postsToModerate, label: "Posts to moderate", to: "/admin/community", icon: MessageSquare, tone: "text-amber-400", bar: "from-amber-500/70 to-amber-500/20" },
      { key: "stock", count: lowStock, label: "Products low on stock", to: "/admin/store", icon: PackageX, tone: "text-red-400", bar: "from-red-500/70 to-red-500/20" },
      { key: "regs", count: newRegistrations, label: `New registrations (${NEW_REG_DAYS}d)`, to: "/admin/people", icon: Heart, tone: "text-violet-400", bar: "from-violet-500/70 to-violet-500/20" },
      { key: "drafts", count: draftContent, label: "Unpublished content", to: "/admin/content", icon: FileText, tone: "text-sky-400", bar: "from-sky-500/70 to-sky-500/20" },
    ].filter((i) => i.count > 0);
  }, [orders, forumPosts, registrations, products, news, testimonials]);

  return (
    <div className="border border-border bg-card/60 cmd-glass">
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Needs you now</p>
        {items.length > 0 && (
          <span className="border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
            {items.reduce((s, i) => s + i.count, 0)} open
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-6">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-bold text-foreground">All clear</p>
            <p className="text-[11px] text-muted-foreground/60">No orders, posts, stock, registrations, or drafts need attention.</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border/30">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.li
                key={item.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <Link
                  to={item.to}
                  className="group flex min-h-[52px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/20"
                >
                  <div className="relative shrink-0 overflow-hidden border border-border/40 bg-muted/20 p-2">
                    <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${item.bar}`} />
                    <Icon className={`h-4 w-4 ${item.tone}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">{item.label}</p>
                  </div>
                  <span className={`font-display text-xl font-black tabular-nums ${item.tone}`}>{item.count}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
