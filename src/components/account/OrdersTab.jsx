import React from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusTone = {
  paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  shipped: "bg-sky-500/15 text-sky-400 border-sky-500/40",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  cancelled: "bg-destructive/15 text-destructive border-destructive/40",
  refunded: "bg-destructive/15 text-destructive border-destructive/40",
};

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
          <div className="h-5 w-24 bg-muted/15 rounded mb-2" />
          <div className="h-4 w-48 bg-muted/10 rounded" />
        </div>
      ))}
    </div>
  );

  if (orders.length === 0) {
    return (
      <div className="border border-border bg-card p-10 text-center">
        <Package className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">You haven't placed any orders yet.</p>
        <Button asChild className="mt-6 rounded-none bg-primary hover:bg-primary/90"><Link to="/store">Shop merch</Link></Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {orders.map((order, index) => (
        <motion.article
          key={order.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.06, duration: 0.4 }}
          className="grid gap-3 border border-border bg-card p-5 hover:border-primary/20 transition-colors duration-300"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.25em] text-primary">
              {order.created_date ? format(new Date(order.created_date), "dd MMM yyyy") : "Recent order"}
            </p>
            <Badge variant="outline" className={`rounded-none uppercase ${statusTone[order.status] || "border-border text-muted-foreground"}`}>{order.status || "pending"}</Badge>
          </div>
          <p className="text-lg font-semibold">${Number(order.total_aud || 0).toFixed(2)} AUD</p>
          <p className="text-sm text-muted-foreground">{(order.line_items || []).map((item) => `${item.quantity}× ${item.name}`).join(", ") || "—"}</p>
          {order.shipping_notes && <p className="border-t border-border pt-3 text-sm text-muted-foreground"><span className="font-semibold text-foreground">Shipping:</span> {order.shipping_notes}</p>}
        </motion.article>
      ))}
    </div>
  );
}
