import React from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import {
  Package, CreditCard, Truck, CheckCircle2, Clock, ExternalLink,
  HelpCircle, ShoppingBag,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";

const statusConfig = {
  pending:   { label: "Pending",   icon: Clock,        color: "text-amber-400",    bg: "bg-amber-400",    ring: "ring-amber-400/30" },
  paid:      { label: "Paid",      icon: CreditCard,   color: "text-emerald-400",  bg: "bg-emerald-400",  ring: "ring-emerald-400/30" },
  packing:   { label: "Packing",   icon: Package,      color: "text-sky-400",      bg: "bg-sky-400",      ring: "ring-sky-400/30" },
  shipped:   { label: "Shipped",   icon: Truck,        color: "text-blue-400",     bg: "bg-blue-400",     ring: "ring-blue-400/30" },
  completed: { label: "Delivered", icon: CheckCircle2, color: "text-emerald-400",  bg: "bg-emerald-400",  ring: "ring-emerald-400/30" },
  cancelled: { label: "Cancelled", icon: Clock,        color: "text-destructive",  bg: "bg-destructive",  ring: "ring-destructive/30" },
  refunded:  { label: "Refunded",  icon: Clock,        color: "text-destructive",  bg: "bg-destructive",  ring: "ring-destructive/30" },
};

const getStatus = (s) => statusConfig[s] || statusConfig.pending;

/* ── Fulfillment Progress Steps ── */
const STEPS = [
  { key: "paid", label: "Paid", icon: CreditCard },
  { key: "packing", label: "Packing", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "completed", label: "Delivered", icon: CheckCircle2 },
];

function FulfillmentProgress({ currentStatus }) {
  const stepKeys = STEPS.map((s) => s.key);
  const currentIdx = stepKeys.indexOf(currentStatus);
  if (currentIdx < 0) return null;

  return (
    <div className="flex items-center w-full gap-0">
      {STEPS.map((step, i) => {
        const isActive = i <= currentIdx;
        const isCurrent = i === currentIdx;
        const StepIcon = step.icon;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1">
              <div className={`flex items-center justify-center h-8 w-8 border transition-all ${
                isCurrent
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : isActive
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-border/30 bg-muted/5"
              }`}>
                <StepIcon className={`h-3.5 w-3.5 ${
                  isCurrent ? "text-primary" : isActive ? "text-emerald-400" : "text-muted-foreground/30"
                }`} />
              </div>
              <span className={`text-[8px] font-bold uppercase tracking-wider ${
                isCurrent ? "text-primary" : isActive ? "text-emerald-400" : "text-muted-foreground/30"
              }`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1 mt-[-12px] ${
                isActive && i < currentIdx ? "bg-emerald-400" : "bg-border/20"
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function OrdersTab() {
  const { user } = useAuth();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["myOrders", user?.email],
    queryFn: () => base44.entities.StoreOrder.filter({ user_email: user.email }, "-created_date", 100),
    enabled: Boolean(user?.email),
  });

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => (
        <div key={i} className="border border-border/30 bg-card/30 p-5 animate-pulse">
          <div className="flex justify-between mb-3">
            <div className="h-4 w-28 bg-muted/20 rounded" />
            <div className="h-5 w-16 bg-muted/20 rounded" />
          </div>
          <div className="h-8 w-full bg-muted/10 rounded mb-3" />
          <div className="h-5 w-24 bg-muted/15 rounded mb-2" />
          <div className="h-4 w-48 bg-muted/10 rounded" />
        </div>
      ))}
    </div>
  );

  if (orders.length === 0) {
    return (
      <div className="border border-border bg-card p-10 text-center">
        <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">You haven't placed any orders yet.</p>
        <Button asChild className="mt-6 rounded-none bg-primary hover:bg-primary/90">
          <Link to="/store">Shop merch</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {orders.map((order, index) => {
        const status = getStatus(order.status);
        const lineItems = order.line_items || [];
        const isPaidFlow = ["paid", "packing", "shipped", "completed"].includes(order.status);

        return (
          <motion.article
            key={order.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.4 }}
            className="border border-border bg-card overflow-hidden hover:border-primary/20 transition-colors duration-300"
          >
            {/* Top accent */}
            <div className={`h-[2px] w-full ${
              isPaidFlow ? "bg-gradient-to-r from-emerald-500/60 to-emerald-500/20"
              : "bg-gradient-to-r from-amber-500/60 to-amber-500/20"
            }`} />

            <div className="p-5">
              {/* Header row */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                    Order #{String(order.id || "").slice(-6).toUpperCase()}
                  </p>
                  <span className="text-[9px] font-mono text-muted-foreground/40">
                    {order.created_date ? format(new Date(order.created_date), "dd MMM yyyy") : "Recent"}
                  </span>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                  isPaidFlow
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                    : order.status === "cancelled" || order.status === "refunded"
                      ? "border-destructive/30 bg-destructive/5 text-destructive"
                      : "border-amber-500/30 bg-amber-500/5 text-amber-400"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${status.bg}`} />
                  {status.label}
                </span>
              </div>

              {/* Fulfillment progress stepper */}
              {isPaidFlow && (
                <div className="mb-4 border border-border/20 bg-muted/5 p-3">
                  <FulfillmentProgress currentStatus={order.status} />
                </div>
              )}

              {/* Line items */}
              <div className="space-y-1.5 mb-3">
                {lineItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground/40">{item.quantity}×</span>
                      <span className="text-foreground">{item.name}</span>
                    </div>
                    <span className="font-mono text-muted-foreground tabular-nums">
                      ${Number((item.price_aud || 0) * (item.quantity || 1)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between border-t border-border/20 pt-3 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</span>
                <span className="font-display text-xl tabular-nums text-foreground">
                  ${Number(order.total_aud || 0).toFixed(2)} <span className="text-xs text-muted-foreground font-normal">AUD</span>
                </span>
              </div>

              {/* Tracking info */}
              {order.tracking_number && (
                <div className="border border-blue-500/20 bg-blue-500/[0.04] p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-blue-400" />
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          {order.carrier || "Carrier"} · {order.tracking_number}
                        </p>
                        {order.estimated_delivery && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Estimated delivery: {format(new Date(order.estimated_delivery), "dd MMM yyyy")}
                          </p>
                        )}
                      </div>
                    </div>
                    {order.tracking_url && (
                      <a
                        href={order.tracking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-blue-500/30 bg-blue-500/10 text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:bg-blue-500/20 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Track Package
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="flex flex-wrap gap-3 text-[9px] text-muted-foreground/40">
                {order.shipped_at && (
                  <span className="flex items-center gap-1">
                    <Truck className="h-2.5 w-2.5" />
                    Shipped {format(new Date(order.shipped_at), "dd MMM")}
                  </span>
                )}
                {order.delivered_at && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Delivered {format(new Date(order.delivered_at), "dd MMM")}
                  </span>
                )}
                {order.payment_verified_at && (
                  <span className="flex items-center gap-1 text-emerald-400/60">
                    <CreditCard className="h-2.5 w-2.5" />
                    Payment verified
                  </span>
                )}
              </div>

              {/* Help */}
              <div className="mt-3 pt-3 border-t border-border/10 flex justify-end">
                <a
                  href="mailto:support@rugbyleaguetakeover.com?subject=Order%20Help"
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
                >
                  <HelpCircle className="h-3 w-3" />
                  Need Help?
                </a>
              </div>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
