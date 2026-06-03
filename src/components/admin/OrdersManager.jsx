import React, { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Download, DollarSign, ShoppingCart, Clock, PackageCheck, BadgeCheck,
  ChevronDown, Package, CreditCard, Truck, XCircle, CheckCircle2, RotateCcw,
  User, Copy, ExternalLink, MapPin,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { downloadCsv } from "@/lib/csv";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminConfirmSheet from "./shared/AdminConfirmSheet";

const statuses = ["pending", "paid", "packing", "shipped", "completed", "cancelled", "refunded"];
const paidLike = ["paid", "packing", "shipped", "completed"];
const toFulfil = ["paid", "packing"];

const statusConfig = {
  pending:   { label: "Pending",   icon: Clock,         color: "border-amber-500/30 text-amber-400 bg-amber-500/5",      dot: "bg-amber-400" },
  paid:      { label: "Paid",      icon: CreditCard,    color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5",  dot: "bg-emerald-400" },
  packing:   { label: "Packing",   icon: Package,       color: "border-sky-500/30 text-sky-400 bg-sky-500/5",              dot: "bg-sky-400" },
  shipped:   { label: "Shipped",   icon: Truck,         color: "border-blue-500/30 text-blue-400 bg-blue-500/5",           dot: "bg-blue-400" },
  completed: { label: "Delivered", icon: CheckCircle2,  color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5",  dot: "bg-emerald-400" },
  cancelled: { label: "Cancelled", icon: XCircle,       color: "border-destructive/30 text-destructive bg-destructive/5",  dot: "bg-destructive" },
  refunded:  { label: "Refunded",  icon: RotateCcw,     color: "border-destructive/30 text-destructive bg-destructive/5",  dot: "bg-destructive" },
};

const getStatusConfig = (s) => statusConfig[s] || statusConfig.pending;

/* Pipeline tabs */
const PIPELINE_TABS = [
  { key: "all",       label: "All" },
  { key: "unfulfilled", label: "Unfulfilled", statuses: ["paid"] },
  { key: "packing",   label: "Packing",   statuses: ["packing"] },
  { key: "shipped",   label: "Shipped",   statuses: ["shipped"] },
  { key: "completed", label: "Delivered", statuses: ["completed"] },
  { key: "other",     label: "Other",     statuses: ["pending", "cancelled", "refunded"] },
];

/* Carrier presets */
const CARRIERS = ["Australia Post", "DHL", "FedEx", "UPS", "USPS", "StarTrack", "Aramex", "Other"];

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

/* ── Fulfillment Status Stepper ── */
function FulfillmentStepper({ currentStatus }) {
  const steps = [
    { key: "paid", label: "Paid" },
    { key: "packing", label: "Packing" },
    { key: "shipped", label: "Shipped" },
    { key: "completed", label: "Delivered" },
  ];

  const currentIdx = steps.findIndex((s) => s.key === currentStatus);

  return (
    <div className="flex items-center gap-1 w-full">
      {steps.map((step, i) => {
        const isActive = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <React.Fragment key={step.key}>
            <div className={`flex items-center gap-1.5 ${isCurrent ? "text-primary" : isActive ? "text-emerald-400" : "text-muted-foreground/30"}`}>
              <div className={`h-2 w-2 rounded-full ${isCurrent ? "bg-primary ring-2 ring-primary/30" : isActive ? "bg-emerald-400" : "bg-muted-foreground/20"}`} />
              <span className="text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px ${isActive && i < currentIdx ? "bg-emerald-400" : "bg-border/30"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Order Card ── */
function OrderCard({ order, onUpdate, index }) {
  const [expanded, setExpanded] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || "");
  const [trackingUrl, setTrackingUrl] = useState(order.tracking_url || "");
  const [carrier, setCarrier] = useState(order.carrier || "");
  const [notes, setNotes] = useState(order.shipping_notes || "");
  const [confirmAction, setConfirmAction] = useState(null);

  const status = getStatusConfig(order.status || "pending");
  const StatusIcon = status.icon;
  const lineItems = order.line_items || [];
  const isFulfillable = paidLike.includes(order.status) && order.status !== "completed";

  const handleQuickAction = (newStatus) => {
    if (newStatus === "shipped" && !trackingNumber) {
      setExpanded(true);
      return;
    }
    setConfirmAction({
      status: newStatus,
      label: `Mark as ${getStatusConfig(newStatus).label}?`,
    });
  };

  const executeAction = () => {
    const data = { status: confirmAction.status };
    if (confirmAction.status === "shipped") {
      data.tracking_number = trackingNumber;
      data.tracking_url = trackingUrl;
      data.carrier = carrier;
      data.shipped_at = new Date().toISOString();
    }
    if (confirmAction.status === "completed") {
      data.delivered_at = new Date().toISOString();
    }
    onUpdate(order.id, data);
    setConfirmAction(null);
  };

  const copyOrderSummary = () => {
    const items = lineItems.map((i) => `${i.quantity}x ${i.name}`).join(", ");
    const summary = `Order #${String(order.id || "").slice(-6).toUpperCase()}\n${order.customer_name || "Customer"}\n${order.customer_email || ""}\n${order.shipping_address || ""}\nItems: ${items}\nTotal: $${Number(order.total_aud || 0).toFixed(2)} AUD`;
    navigator.clipboard.writeText(summary);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.04, 0.25), duration: 0.3 }}
        className="group relative border border-border/60 bg-card/30 overflow-hidden"
      >
        {/* Top accent */}
        <div className={`h-[2px] w-full ${
          paidLike.includes(order.status) ? "bg-gradient-to-r from-emerald-500/60 to-emerald-500/20"
          : order.status === "cancelled" || order.status === "refunded" ? "bg-gradient-to-r from-destructive/60 to-destructive/20"
          : "bg-gradient-to-r from-amber-500/60 to-amber-500/20"
        }`} />

        {/* Summary row */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/5 sm:gap-4"
        >
          <div className={`shrink-0 p-2 border ${status.color}`}>
            <StatusIcon className="h-4 w-4" />
          </div>

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
              {order.tracking_number && (
                <span className="inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider text-blue-400">
                  <Truck className="h-2.5 w-2.5" /> Tracked
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
              </span>
              <span className="flex items-center gap-1">
                <Package className="h-2.5 w-2.5" />
                {lineItems.length} {lineItems.length === 1 ? "item" : "items"}
              </span>
            </div>
          </div>

          {/* Quick actions (desktop) — prevent button bubbling */}
          {isFulfillable && (
            <div className="hidden md:flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {order.status === "paid" && (
                <Button
                  size="sm"
                  onClick={() => handleQuickAction("packing")}
                  className="h-8 rounded-none bg-sky-600 hover:bg-sky-500 text-[9px] font-bold uppercase tracking-wider text-white"
                >
                  <Package className="mr-1 h-3 w-3" /> Pack
                </Button>
              )}
              {(order.status === "paid" || order.status === "packing") && (
                <Button
                  size="sm"
                  onClick={() => handleQuickAction("shipped")}
                  className="h-8 rounded-none bg-blue-600 hover:bg-blue-500 text-[9px] font-bold uppercase tracking-wider text-white"
                >
                  <Truck className="mr-1 h-3 w-3" /> Ship
                </Button>
              )}
              {order.status === "shipped" && (
                <Button
                  size="sm"
                  onClick={() => handleQuickAction("completed")}
                  className="h-8 rounded-none bg-emerald-600 hover:bg-emerald-500 text-[9px] font-bold uppercase tracking-wider text-white"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Delivered
                </Button>
              )}
            </div>
          )}

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
                {/* Fulfillment stepper */}
                {paidLike.includes(order.status) && (
                  <div className="border border-border/20 bg-muted/5 p-3">
                    <FulfillmentStepper currentStatus={order.status} />
                  </div>
                )}

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

                {/* Shipping address */}
                {order.shipping_address && (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-1">Shipping Address</p>
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/40" />
                      <span className="whitespace-pre-line">{order.shipping_address}</span>
                    </div>
                  </div>
                )}

                {/* Status + Tracking + Notes */}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Status</label>
                      <Select
                        value={order.status || "pending"}
                        onValueChange={(value) => onUpdate(order.id, { status: value })}
                      >
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
                      <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Carrier</label>
                      <Select value={carrier} onValueChange={(v) => { setCarrier(v); onUpdate(order.id, { carrier: v }); }}>
                        <SelectTrigger className="h-11 rounded-none border-border/40 text-sm"><SelectValue placeholder="Select carrier" /></SelectTrigger>
                        <SelectContent>
                          {CARRIERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Tracking Number</label>
                      <Input
                        placeholder="e.g. AU123456789"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        onBlur={() => trackingNumber !== (order.tracking_number || "") && onUpdate(order.id, { tracking_number: trackingNumber })}
                        className="h-11 rounded-none border-border/40 text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Tracking URL</label>
                      <div className="flex gap-1.5">
                        <Input
                          placeholder="https://track.auspost.com.au/..."
                          value={trackingUrl}
                          onChange={(e) => setTrackingUrl(e.target.value)}
                          onBlur={() => trackingUrl !== (order.tracking_url || "") && onUpdate(order.id, { tracking_url: trackingUrl })}
                          className="h-11 rounded-none border-border/40 text-sm font-mono flex-1"
                        />
                        {trackingUrl && (
                          <a href={trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-11 w-11 border border-border/40 text-muted-foreground hover:text-primary transition-colors shrink-0">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Fulfilment Notes (internal)</label>
                  <Textarea
                    placeholder="Add internal notes…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => notes !== (order.shipping_notes || "") && onUpdate(order.id, { shipping_notes: notes })}
                    className="min-h-20 resize-none rounded-none border-border/40 text-sm"
                  />
                </div>

                {/* Mobile quick actions */}
                {isFulfillable && (
                  <div className="flex flex-wrap gap-2 md:hidden">
                    {order.status === "paid" && (
                      <Button onClick={() => handleQuickAction("packing")} className="flex-1 min-h-[44px] rounded-none bg-sky-600 hover:bg-sky-500 text-xs font-bold uppercase tracking-wider">
                        <Package className="mr-1.5 h-4 w-4" /> Mark Packing
                      </Button>
                    )}
                    {(order.status === "paid" || order.status === "packing") && (
                      <Button onClick={() => handleQuickAction("shipped")} className="flex-1 min-h-[44px] rounded-none bg-blue-600 hover:bg-blue-500 text-xs font-bold uppercase tracking-wider">
                        <Truck className="mr-1.5 h-4 w-4" /> Mark Shipped
                      </Button>
                    )}
                    {order.status === "shipped" && (
                      <Button onClick={() => handleQuickAction("completed")} className="flex-1 min-h-[44px] rounded-none bg-emerald-600 hover:bg-emerald-500 text-xs font-bold uppercase tracking-wider">
                        <CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark Delivered
                      </Button>
                    )}
                  </div>
                )}

                {/* Copy summary */}
                <div className="flex justify-end">
                  <Button variant="ghost" onClick={copyOrderSummary} className="h-8 rounded-none text-[9px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                    <Copy className="mr-1.5 h-3 w-3" /> Copy Summary
                  </Button>
                </div>

                {/* Timestamps */}
                <div className="border-t border-border/10 pt-3 flex flex-wrap gap-4 text-[9px] text-muted-foreground/30">
                  {order.shipped_at && <span>Shipped: {format(new Date(order.shipped_at), "dd MMM yyyy HH:mm")}</span>}
                  {order.delivered_at && <span>Delivered: {format(new Date(order.delivered_at), "dd MMM yyyy HH:mm")}</span>}
                  {order.created_date && <span>Created: {format(new Date(order.created_date), "dd MMM yyyy HH:mm")}</span>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Confirm sheet */}
      <AdminConfirmSheet
        open={!!confirmAction}
        title={confirmAction?.label}
        description={`This will update order #${String(order.id || "").slice(-6).toUpperCase()} for ${order.customer_name || "this customer"}.`}
        confirmLabel="Confirm"
        onConfirm={executeAction}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}

/* ── Main Component ── */
export default function OrdersManager({ orders }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [pipelineTab, setPipelineTab] = useState("all");

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.StoreOrder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const handleUpdate = (id, data) => updateMutation.mutate({ id, data });

  const revenue = useMemo(() => orders.filter((o) => paidLike.includes(o.status)).reduce((s, o) => s + Number(o.total_aud || 0), 0), [orders]);
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const fulfilCount = orders.filter((o) => toFulfil.includes(o.status)).length;

  // Pipeline counts
  const pipelineCounts = useMemo(() => {
    const counts = {};
    PIPELINE_TABS.forEach((tab) => {
      if (tab.key === "all") {
        counts[tab.key] = orders.length;
      } else {
        counts[tab.key] = orders.filter((o) => tab.statuses.includes(o.status || "pending")).length;
      }
    });
    return counts;
  }, [orders]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const activeTab = PIPELINE_TABS.find((t) => t.key === pipelineTab);
    return orders.filter((o) => {
      if (activeTab && activeTab.statuses && !activeTab.statuses.includes(o.status || "pending")) return false;
      const hay = `${o.customer_name || ""} ${o.customer_email || ""} ${o.tracking_number || ""} ${(o.line_items || []).map((i) => i.name).join(" ")}`.toLowerCase();
      return hay.includes(term);
    });
  }, [orders, search, pipelineTab]);

  const exportCsv = () => {
    const headers = ["Date", "Customer", "Email", "Account", "Status", "Total AUD", "Items", "Carrier", "Tracking", "Notes"];
    const rows = filtered.map((o) => [
      o.created_date ? format(new Date(o.created_date), "yyyy-MM-dd") : "",
      o.customer_name, o.customer_email, o.user_email || "guest", o.status || "pending",
      Number(o.total_aud || 0).toFixed(2),
      (o.line_items || []).map((i) => `${i.quantity}x ${i.name}`).join("; "),
      o.carrier || "", o.tracking_number || "", o.shipping_notes || "",
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
              <h2 className="font-display text-2xl uppercase tracking-wide">Fulfillment Pipeline</h2>
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
        <div className="grid gap-2 grid-cols-2 lg:grid-cols-4 mb-5">
          <StatCard icon={DollarSign} label="Revenue (paid)" value={`$${revenue.toFixed(2)}`} accent="text-emerald-400" />
          <StatCard icon={ShoppingCart} label="Total orders" value={orders.length} />
          <StatCard icon={Clock} label="Pending payment" value={pendingCount} accent={pendingCount > 0 ? "text-amber-400" : ""} />
          <StatCard icon={PackageCheck} label="To fulfil" value={fulfilCount} accent={fulfilCount > 0 ? "text-sky-400" : ""} />
        </div>

        {/* Pipeline Tabs */}
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
          {PIPELINE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPipelineTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] whitespace-nowrap transition-all border min-h-[36px] ${
                pipelineTab === tab.key
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/30 bg-card/10 text-muted-foreground hover:border-border/60 hover:text-foreground"
              }`}
            >
              {tab.label}
              {pipelineCounts[tab.key] > 0 && (
                <span className={`text-[9px] font-mono ${pipelineTab === tab.key ? "text-primary" : "text-muted-foreground/40"}`}>
                  {pipelineCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/30" />
          <Input
            placeholder="Search customer, email, tracking number or item…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-none border-border/40 pl-9 text-sm"
          />
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
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
