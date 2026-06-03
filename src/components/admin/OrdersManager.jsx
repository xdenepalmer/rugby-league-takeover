import React, { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Download, DollarSign, ShoppingCart, Clock, PackageCheck, BadgeCheck, ChevronDown, Package, CreditCard, Truck, XCircle, CheckCircle2, RotateCcw, User } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { downloadCsv } from "@/lib/csv";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statuses = ["pending", "paid", "packing", "shipped", "completed", "cancelled", "refunded"];
const paidLike = ["paid", "packing", "shipped", "completed"];
const toFulfil = ["paid", "packing"];

const statusConfig = {
  pending:   { label: "Pending",   icon: Clock,         color: "border-amber-500/30 text-amber-400 bg-amber-500/5",      dot: "bg-amber-400" },
  paid:      { label: "Paid",      icon: CreditCard,    color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5",  dot: "bg-emerald-400" },
  packing:   { label: "Packing",   icon: Package,       color: "border-sky-500/30 text-sky-400 bg-sky-500/5",              dot: "bg-sky-400" },
  shipped:   { label: "Shipped",   icon: Truck,         color: "border-sky-500/30 text-sky-400 bg-sky-500/5",              dot: "bg-sky-400" },
  completed: { label: "Completed", icon: CheckCircle2,  color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5",  dot: "bg-emerald-400" },
  cancelled: { label: "Cancelled", icon: XCircle,       color: "border-destructive/30 text-destructive bg-destructive/5",  dot: "bg-destructive" },
  refunded:  { label: "Refunded",  icon: RotateCcw,     color: "border-destructive/30 text-destructive bg-destructive/5",  dot: "bg-destructive" },
};

const getStatusConfig = (s) => statusConfig[s] || statusConfig.pending;

/* ── Stat Card ── */
function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border/40 bg-card/30 cmd-glass p-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">{label}</p>
          <p className={`mt-1 font-display text-2xl tabular-nums ${accent || "text-foreground"}`}>{value}</p>
        </div>
        <div className="p-2 bg-muted/10 border border-border/20">
          <Icon className="h-4 w-4 text-primary/50" />
        </div>
      </div>
    </motion.div>
  );
}

/* ── Order Card ── */
function OrderCard({ order, onStatusChange, onNotesChange, index }) {
  const [expanded, setExpanded] = useState(false);
  const status = getStatusConfig(order.status || "pending");
  const StatusIcon = status.icon;
  const lineItems = order.line_items || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.25), duration: 0.3 }}
      className="group relative border border-border/60 bg-card/30 overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-primary/[0.02] via-white/[0.05] to-transparent" />
      {/* Top accent */}
      <div className={`h-[2px] w-full ${
        paidLike.includes(order.status) ? "bg-gradient-to-r from-emerald-500/60 to-emerald-500/20"
        : order.status === "cancelled" || order.status === "refunded" ? "bg-gradient-to-r from-destructive/60 to-destructive/20"
        : "bg-gradient-to-r from-amber-500/60 to-amber-500/20"
      }`} />

      {/* Summary row (always visible) */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/5 sm:gap-4"
      >
        {/* Status icon */}
        <div className={`shrink-0 p-2 border ${status.color}`}>
          <StatusIcon className="h-4 w-4" />
        </div>

        {/* Order info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <h4 className="text-sm font-bold text-foreground">
              {order.customer_name || "Customer"}
            </h4>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border ${status.color}`}>
              <span className={`h-1 w-1 rounded-full ${status.dot}`} />
              {status.label}
            </span>
            {order.payment_verified_at && (
              <span className="inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
                <BadgeCheck className="h-2.5 w-2.5" /> Verified
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[9px] text-muted-foreground/40">
            <span className="font-mono tabular-nums">
              {order.created_date ? format(new Date(order.created_date), "dd MMM yyyy") : "New"}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-2.5 w-2.5" />
              {order.customer_email || "—"}
              {order.user_email ? " · account" : " · guest"}
            </span>
            <span className="flex items-center gap-1">
              <Package className="h-2.5 w-2.5" />
              {lineItems.length} {lineItems.length === 1 ? "item" : "items"}
            </span>
          </div>
        </div>

        {/* Price */}
        <div className="shrink-0 text-right">
          <p className="font-display text-lg tabular-nums text-foreground">
            ${Number(order.total_aud || 0).toFixed(2)}
          </p>
          <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/30">AUD</p>
        </div>

        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground/20 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/20 p-4 md:p-5 space-y-4">
              {/* Line items */}
              {lineItems.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-2">Items</p>
                  {lineItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/10 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-muted-foreground/30">{item.quantity}×</span>
                        <span className="text-sm text-foreground">{item.name}</span>
                      </div>
                      <span className="text-sm font-mono text-muted-foreground tabular-nums">
                        ${Number((item.price_aud || 0) * (item.quantity || 1)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Status + Notes */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Status</label>
                  <Select value={order.status || "pending"} onValueChange={onStatusChange}>
                    <SelectTrigger className="h-11 rounded-none border-border/40 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => {
                        const conf = getStatusConfig(s);
                        return (
                          <SelectItem key={s} value={s}>
                            <span className="flex items-center gap-2">
                              <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
                              {conf.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Shipping / Tracking Notes</label>
                  <Textarea
                    placeholder="Add tracking info, shipping notes…"
                    defaultValue={order.shipping_notes || ""}
                    onBlur={onNotesChange}
                    className="min-h-24 resize-none rounded-none border-border/40 text-sm"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Main Component ── */
export default function OrdersManager({ orders }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.StoreOrder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const revenue = useMemo(() => orders.filter((o) => paidLike.includes(o.status)).reduce((s, o) => s + Number(o.total_aud || 0), 0), [orders]);
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const fulfilCount = orders.filter((o) => toFulfil.includes(o.status)).length;

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && (o.status || "pending") !== statusFilter) return false;
      const hay = `${o.customer_name || ""} ${o.customer_email || ""} ${(o.line_items || []).map((i) => i.name).join(" ")}`.toLowerCase();
      return hay.includes(term);
    });
  }, [orders, search, statusFilter]);

  const exportCsv = () => {
    const headers = ["Date", "Customer", "Email", "Account", "Status", "Total AUD", "Items", "Shipping notes"];
    const rows = filtered.map((o) => [
      o.created_date ? format(new Date(o.created_date), "yyyy-MM-dd") : "",
      o.customer_name, o.customer_email, o.user_email || "guest", o.status || "pending",
      Number(o.total_aud || 0).toFixed(2),
      (o.line_items || []).map((i) => `${i.quantity}x ${i.name}`).join("; "),
      o.shipping_notes || "",
    ]);
    downloadCsv("rugby-league-takeover-orders.csv", headers, rows);
  };

  return (
    <div className="border border-border/60 bg-card/30 cmd-glass overflow-hidden">
      <div className="h-[2px] w-full bg-gradient-to-r from-sky-500 via-sky-400 to-sky-500" />

      <div className="p-5 md:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 border border-sky-500/20">
              <ShoppingCart className="h-4 w-4 text-sky-400" />
            </div>
            <div>
              <h2 className="font-display text-2xl uppercase tracking-wide">Orders</h2>
              <p className="text-[9px] font-mono text-muted-foreground/40">{orders.length} total · {filtered.length} showing</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={!filtered.length}
            size="mobile"
            className="rounded-none border-border/30 text-[9px] font-bold uppercase tracking-wider"
          >
            <Download className="mr-1.5 h-3 w-3" /> Export CSV
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-5">
          <StatCard icon={DollarSign} label="Revenue (paid)" value={`$${revenue.toFixed(2)}`} accent="text-emerald-400" />
          <StatCard icon={ShoppingCart} label="Total orders" value={orders.length} />
          <StatCard icon={Clock} label="Pending payment" value={pendingCount} accent={pendingCount > 0 ? "text-amber-400" : ""} />
          <StatCard icon={PackageCheck} label="To fulfil" value={fulfilCount} accent={fulfilCount > 0 ? "text-sky-400" : ""} />
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col gap-2 sm:flex-row mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/30" />
            <Input
              placeholder="Search customer, email or item…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-none border-border/40 pl-9 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 rounded-none border-border/40 text-sm sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((s) => {
                const conf = getStatusConfig(s);
                return (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
                      {conf.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Order List */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="border border-border/30 bg-muted/5 p-10 text-center">
              <ShoppingCart className="h-6 w-6 mx-auto text-muted-foreground/15 mb-2" />
              <p className="text-sm text-muted-foreground/30">No orders match your filters.</p>
            </div>
          )}
          {filtered.map((order, index) => (
            <OrderCard
              key={order.id}
              order={order}
              index={index}
              onStatusChange={(value) => updateMutation.mutate({ id: order.id, data: { status: value } })}
              onNotesChange={(e) => updateMutation.mutate({ id: order.id, data: { shipping_notes: e.target.value } })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
