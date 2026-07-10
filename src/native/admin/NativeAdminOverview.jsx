import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DollarSign,
  ShoppingBag,
  UserCheck,
  MessageSquare,
  PackageOpen,
  AlertTriangle,
  RefreshCw,
  Newspaper,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { emitHaptic } from "@/lib/native/haptic-events";
import { NativeListRow, NativeSkeleton } from "../components/NativePrimitives.jsx";

const PAID_STATUSES = new Set(["paid", "completed", "packing", "shipped"]);
const DAY_MS = 24 * 60 * 60 * 1000;

function StatTile({ icon: Icon, label, value, hint }) {
  return (
    <div className="border border-border/60 bg-card/50 p-3">
      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" /> {label}
      </div>
      <p className="pt-1 font-display text-xl font-bold tracking-wide">{value}</p>
      {hint && <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Native admin Overview: the day's operational truth in one screen — key
 * stats plus an attention queue that deep-links straight into the module
 * that clears it. Mirrors the web dashboard's queries (same keys); the
 * chart-heavy analytics stay on the desktop dashboard.
 */
export default function NativeAdminOverview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const enabled = appParams.hasBase44Config;

  const { data: orders = [], isLoading } = useQuery({ queryKey: ["orders"], queryFn: () => base44.entities.StoreOrder.list("-created_date", 200), staleTime: 60000, enabled });
  const { data: registrations = [] } = useQuery({ queryKey: ["registrations"], queryFn: () => base44.entities.InterestRegistration.list("-created_date", 200), staleTime: 60000, enabled });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => base44.entities.Product.list("sort_order", 200), staleTime: 60000, enabled });
  const { data: news = [] } = useQuery({ queryKey: ["news"], queryFn: () => base44.entities.NewsArticle.list("-published_date", 50), staleTime: 60000, enabled });
  const { data: forumPosts = [] } = useQuery({ queryKey: ["forumPosts"], queryFn: () => base44.entities.ForumPost.list("-created_date", 200), staleTime: 60000, enabled });
  const { data: testimonials = [] } = useQuery({ queryKey: ["testimonials"], queryFn: () => base44.entities.Testimonial.list("sort_order", 200), staleTime: 60000, retry: false, meta: { silent: true }, enabled });

  const now = Date.now();
  const revenue = orders.filter((o) => PAID_STATUSES.has(o.status)).reduce((sum, o) => sum + (Number(o.total_aud) || 0), 0);
  const toFulfil = orders.filter((o) => o.status === "paid" || o.status === "packing");
  const pendingPosts = forumPosts.filter((p) => p.is_published !== true);
  const pendingTestimonials = testimonials.filter((t) => t.is_published === false);
  const newRegs = registrations.filter((r) => now - new Date(r.created_date).getTime() < DAY_MS);
  const lowStock = products.filter((p) => Number(p.stock_quantity) > 0 && Number(p.stock_quantity) <= 3);
  const outOfStock = products.filter((p) => Number(p.stock_quantity) === 0 && p.coming_soon !== true);
  const unpublishedNews = news.filter((n) => n.is_published === false);
  const problemOrders = orders.filter((o) => o.status === "cancelled" || o.status === "refunded");

  const queue = [
    { id: "fulfil", count: toFulfil.length, icon: ShoppingBag, label: "Orders to fulfil", to: "/admin/store/orders" },
    { id: "moderate", count: pendingPosts.length + pendingTestimonials.length, icon: MessageSquare, label: "Posts to moderate", to: "/admin/community/forum" },
    { id: "regs", count: newRegs.length, icon: UserCheck, label: "New registrations (24h)", to: "/admin/people/registrations" },
    { id: "lowstock", count: lowStock.length, icon: PackageOpen, label: "Low stock", to: "/admin/store/products" },
    { id: "outstock", count: outOfStock.length, icon: AlertTriangle, label: "Out of stock", to: "/admin/store/products" },
    { id: "unpubnews", count: unpublishedNews.length, icon: Newspaper, label: "Unpublished news", to: "/admin/content/news" },
    { id: "problems", count: problemOrders.length, icon: AlertTriangle, label: "Cancelled / refunded orders", to: "/admin/store/orders" },
  ].filter((item) => item.count > 0);

  return (
    <div className="px-4 pt-4">
      <header className="pb-3">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400">Operations</p>
        <h1 className="font-display text-2xl font-bold uppercase tracking-widest">Overview</h1>
      </header>

      {isLoading && orders.length === 0 ? (
        <div className="grid grid-cols-2 gap-2">
          <NativeSkeleton className="h-20 w-full" />
          <NativeSkeleton className="h-20 w-full" />
          <NativeSkeleton className="h-20 w-full" />
          <NativeSkeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <StatTile icon={DollarSign} label="Revenue" value={`$${Math.round(revenue).toLocaleString()}`} hint="Merch, paid orders" />
          <StatTile icon={ShoppingBag} label="Orders" value={orders.length} hint={`${toFulfil.length} to fulfil`} />
          <StatTile icon={UserCheck} label="Signups" value={registrations.length} hint={`${newRegs.length} today`} />
          <StatTile icon={MessageSquare} label="Posts" value={forumPosts.length} hint={`${pendingPosts.length} pending`} />
        </div>
      )}

      <div className="flex items-end justify-between pb-1 pt-5">
        <h2 className="font-display text-lg font-bold uppercase tracking-widest">Needs attention</h2>
        <button
          type="button"
          onClick={() => {
            emitHaptic("refresh.trigger");
            queryClient.invalidateQueries();
          }}
          aria-label="Refresh data"
          className="ios-pressable flex min-h-10 items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh
        </button>
      </div>

      {queue.length === 0 ? (
        <p className="border border-emerald-500/30 bg-emerald-500/10 px-4 py-6 text-center text-xs font-bold uppercase tracking-widest text-emerald-300">
          All clear — nothing waiting on you
        </p>
      ) : (
        <div className="border-t border-border/40">
          {queue.map((item) => (
            <NativeListRow
              key={item.id}
              icon={item.icon}
              label={item.label}
              badge={item.count}
              onClick={() => {
                emitHaptic("tab.select");
                navigate(item.to);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
