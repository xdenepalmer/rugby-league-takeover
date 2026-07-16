import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ShoppingBag,
  Mail,
  Phone,
  Copy,
  Truck,
  Tag,
  RefreshCw,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import AdminConfirmSheet from "@/components/admin/shared/AdminConfirmSheet";
import PullToRefresh from "@/components/PullToRefresh";
import { openSystemUrl } from "@/lib/native/open-external";
import { emitHaptic } from "@/lib/native/haptic-events";
import { formatAud } from "@/lib/store-products";
import { useWindowedList } from "@/hooks/use-windowed-list";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  ORDER_FILTERS,
  orderStatusMeta,
  filterOrders,
  nextOrderActions,
  canCancelOrder,
  canRefundOrder,
  canStripeRefundOrder,
  buildOrderStatusPayload,
  buildRefundPayload,
  validateRefundAmount,
  makeTimelineEntry,
} from "./workflow-helpers.js";

const useOrders = () =>
  useQuery({
    queryKey: ["orders"],
    queryFn: () => base44.entities.StoreOrder.list("-created_date", 200),
    enabled: appParams.hasBase44Config,
    staleTime: 60000,
  });

const useOrderUpdate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities.StoreOrder.update(id, data),
    onSuccess: () => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["adminAttention"] });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Order update failed", description: error.message, variant: "destructive" });
    },
  });
};

const shortId = (id) => String(id || "").slice(-6).toUpperCase();
const formatDate = (value) => {
  try {
    return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
};

function StatusBadge({ status }) {
  const meta = orderStatusMeta(status);
  return (
    <span className={`border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${meta.tone}`}>
      {meta.label}
    </span>
  );
}

/** Native searchable, filterable order list — /admin/store/orders */
export default function NativeOrdersList() {
  const navigate = useNavigate();
  const { data: orders = [], isLoading } = useOrders();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const visible = useMemo(() => filterOrders(orders, { query, filter }), [orders, query, filter]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, { initial: 15, step: 15 });
  const countFor = (key) => filterOrders(orders, { filter: key }).length;

  return (
    <div>
      <NativeTopBar title="Orders" fallback="/admin/store" />
      <PullToRefresh queryKeys={[["orders"]]}>
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 border border-border bg-card/50 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search id, name, email, tracking"
              aria-label="Search orders"
              className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="ios-scroll flex gap-2 overflow-x-auto py-2">
            {ORDER_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`ios-pressable min-h-9 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                  filter === f.key ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
                }`}
              >
                {f.label} ({countFor(f.key)})
              </button>
            ))}
          </div>
        </div>

        {isLoading && orders.length === 0 ? (
          <div className="space-y-2 px-4">
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState icon={ShoppingBag} title="No orders here" description="Nothing matches this filter right now." />
          </div>
        ) : (
          <div>
            {windowed.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => {
                  emitHaptic("tab.select");
                  navigate(`/admin/store/orders/${encodeURIComponent(order.id)}`);
                }}
                className="ios-pressable flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black">#{shortId(order.id)}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="truncate pt-1 text-sm font-bold">{order.customer_name || order.customer_email || "Customer"}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {formatDate(order.created_date)} · {(order.line_items || []).length} item{(order.line_items || []).length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-black text-primary">{formatAud(order.total_aud)}</span>
              </button>
            ))}
            {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}

/** Native order detail + fulfilment — /admin/store/orders/:orderId */
export function NativeOrderDetail() {
  const { orderId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading } = useOrders();
  const order = useMemo(() => orders.find((o) => String(o.id) === String(orderId)) || null, [orders, orderId]);
  const updateMutation = useOrderUpdate();

  const [tracking, setTracking] = useState(null); // lazily seeded from order
  const [confirm, setConfirm] = useState(null); // { to, label, destructive }
  const [refundForm, setRefundForm] = useState(null); // { amount, reason } | null
  // Set when the server says the order has no Stripe payment to charge
  // against — flips the form into the honest record-only fallback.
  const [stripeRefundUnavailable, setStripeRefundUnavailable] = useState(false);
  const trackingState = tracking ?? {
    number: order?.tracking_number || "",
    url: order?.tracking_url || "",
    carrier: order?.carrier || "",
  };

  const labelMutation = useMutation({
    mutationFn: () => base44.functions.invoke("auspostCreateLabel", { orderId: order.id }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      emitHaptic("save.success");
      toast({
        title: data?.status === "processing" ? "Label is rendering" : "AusPost label ready",
        description: data?.message || `Tracking number: ${data?.tracking_number || "pending"}`,
      });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Could not create label", description: error.message, variant: "destructive" });
    },
  });

  const trackMutation = useMutation({
    mutationFn: () => base44.functions.invoke("auspostTrack", { orderId: order.id }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Tracking refreshed", description: data?.latest_event || `Status: ${data?.status || "unknown"}` });
    },
    onError: (error) => toast({ title: "Could not refresh tracking", description: error.message, variant: "destructive" }),
  });

  const copyText = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      emitHaptic("action.primary");
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: `Couldn't copy ${label.toLowerCase()}`, variant: "destructive" });
    }
  };

  const contact = (href) => {
    openSystemUrl(href).then((handled) => {
      if (!handled && typeof window !== "undefined") window.location.href = href;
    });
  };

  const runTransition = (to) => {
    const payload = buildOrderStatusPayload(order, to, {
      actorEmail: user?.email || "admin",
      tracking: trackingState,
    });
    updateMutation.mutate({ id: order.id, data: payload });
    setConfirm(null);
  };

  // Real money movement for Stripe-paid orders: the stripeRefund function
  // issues the refund via Stripe AND writes the order record server-side.
  const stripeRefundMutation = useMutation({
    mutationFn: ({ amount, reason }) => base44.functions.invoke("stripeRefund", { orderId: order.id, amount, reason }),
    onSuccess: ({ data }) => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["adminAttention"] });
      setRefundForm(null);
      toast({
        title: data?.fullyRefunded ? "Refund issued" : "Partial refund issued",
        description: data?.warning || `$${Number(data?.amount || 0).toFixed(2)} AUD sent back via Stripe.`,
      });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      if (error?.data?.code === "no_stripe_payment") {
        // No Stripe payment attached — flip the open form to record-only.
        setStripeRefundUnavailable(true);
        setRefundForm((form) => (form ? { ...form, error: null } : form));
        return;
      }
      setRefundForm((form) => (form ? { ...form, error: error.message || "Refund could not be issued." } : form));
    },
  });

  // Record-only is the fallback for orders with no Stripe payment attached
  // (migrated/manual records) — Stripe-paid orders refund for real above.
  const useStripeRefund = canStripeRefundOrder(order) && !stripeRefundUnavailable;
  const confirmRefund = () => {
    const check = validateRefundAmount(refundForm?.amount, order.total_aud);
    if (!check.ok) {
      emitHaptic("mutation.error");
      setRefundForm((form) => (form ? { ...form, error: check.error } : form));
      return;
    }
    if (useStripeRefund) {
      stripeRefundMutation.mutate({ amount: check.amount, reason: (refundForm?.reason || "").trim() });
      return;
    }
    updateMutation.mutate({
      id: order.id,
      data: buildRefundPayload(order, {
        actorEmail: user?.email || "admin",
        amount: check.amount,
        reason: (refundForm?.reason || "").trim(),
      }),
    });
    setRefundForm(null);
  };

  const saveTracking = () => {
    updateMutation.mutate({
      id: order.id,
      data: {
        tracking_number: trackingState.number,
        tracking_url: trackingState.url,
        carrier: trackingState.carrier,
        timeline: [...(order.timeline || []), makeTimelineEntry("Tracking details updated", user?.email || "admin")],
      },
    });
  };

  if (!isLoading && !order) {
    return (
      <div>
        <NativeTopBar title="Order" fallback="/admin/store/orders" />
        <div className="px-4 pt-6">
          <NativeEmptyState icon={ShoppingBag} title="Order not found" description="It may have been removed, or you're offline." />
        </div>
      </div>
    );
  }
  if (!order) {
    return (
      <div>
        <NativeTopBar title="Order" fallback="/admin/store/orders" />
        <div className="space-y-2 px-4 pt-4">
          <NativeSkeleton className="h-24 w-full" />
          <NativeSkeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const address = [order.shipping_address_line1, order.shipping_address, order.customer_postcode].filter(Boolean).join(", ");
  const actions = nextOrderActions(order.status);
  const shippedBlocked = (to) => to === "shipped" && !trackingState.number;

  return (
    <div className="pb-10">
      <NativeTopBar title={`Order #${shortId(order.id)}`} fallback="/admin/store/orders" />
      <div className="space-y-4 px-4 pt-3">
        {/* Summary — payment state comes from the webhook-written status. */}
        <div className="flex items-center justify-between border border-border/60 bg-card/50 p-3">
          <div>
            <StatusBadge status={order.status} />
            <p className="pt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {formatDate(order.created_date)} · payment state set by Stripe webhook
            </p>
          </div>
          <p className="text-lg font-black text-primary">{formatAud(order.total_aud)}</p>
        </div>

        {/* Customer + contact actions */}
        <div className="border border-border/60 bg-card/50 p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Customer</p>
          <p className="pt-1 text-sm font-bold">{order.customer_name || "—"}</p>
          <p className="truncate text-xs text-muted-foreground">{order.customer_email || order.user_email || "—"}</p>
          {order.customer_phone && <p className="text-xs text-muted-foreground">{order.customer_phone}</p>}
          {address && <p className="pt-1 text-xs text-muted-foreground">{address}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            {(order.customer_email || order.user_email) && (
              <button type="button" onClick={() => contact(`mailto:${order.customer_email || order.user_email}`)} className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Email
              </button>
            )}
            {order.customer_phone && (
              <button type="button" onClick={() => contact(`tel:${order.customer_phone}`)} className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" /> Call
              </button>
            )}
            {address && (
              <button type="button" onClick={() => copyText(address, "Address")} className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest">
                <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Address
              </button>
            )}
          </div>
        </div>

        {/* Line items */}
        <div className="border border-border/60 bg-card/50 p-3">
          <p className="pb-1 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Items</p>
          {(order.line_items || []).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between border-b border-border/30 py-2 text-sm last:border-0">
              <span className="min-w-0 flex-1 truncate">
                {item.name} {item.size ? `· ${item.size}` : ""} × {item.quantity}
              </span>
              <span className="shrink-0 font-bold">{formatAud((item.price_aud || 0) * (item.quantity || 0))}</span>
            </div>
          ))}
          <p className="pt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            Shipping: {order.shipping_service_name || order.shipping_method || "—"} {order.shipping_cost_aud != null ? `· ${formatAud(order.shipping_cost_aud)}` : ""}
          </p>
        </div>

        {/* Tracking */}
        <div className="border border-border/60 bg-card/50 p-3">
          <p className="pb-2 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Tracking</p>
          <div className="grid gap-2">
            <Input value={trackingState.number} onChange={(e) => setTracking({ ...trackingState, number: e.target.value })} placeholder="Tracking number" aria-label="Tracking number" className="h-11 rounded-none border-border bg-background" />
            <Input value={trackingState.carrier} onChange={(e) => setTracking({ ...trackingState, carrier: e.target.value })} placeholder="Carrier (e.g. AusPost)" aria-label="Carrier" className="h-11 rounded-none border-border bg-background" />
            <Input value={trackingState.url} onChange={(e) => setTracking({ ...trackingState, url: e.target.value })} placeholder="Tracking URL" aria-label="Tracking URL" className="h-11 rounded-none border-border bg-background" />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" disabled={updateMutation.isPending} onClick={saveTracking} className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">
              <Truck className="h-3.5 w-3.5" aria-hidden="true" /> Save tracking
            </button>
            {order.tracking_number && (
              <button type="button" onClick={() => copyText(order.tracking_number, "Tracking number")} className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest">
                <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy number
              </button>
            )}
            <button type="button" disabled={labelMutation.isPending} onClick={() => labelMutation.mutate()} className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">
              <Tag className="h-3.5 w-3.5" aria-hidden="true" /> {labelMutation.isPending ? "Creating…" : "AusPost label"}
            </button>
            {order.tracking_number && (
              <button type="button" disabled={trackMutation.isPending} onClick={() => trackMutation.mutate()} className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh tracking
              </button>
            )}
          </div>
        </div>

        {/* Fulfilment transitions */}
        {(actions.length > 0 || canCancelOrder(order.status) || canRefundOrder(order.status)) && (
          <div className="border border-border/60 bg-card/50 p-3">
            <p className="pb-2 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Fulfilment</p>
            <div className="grid gap-2">
              {actions.map((action) => (
                <button
                  key={action.to}
                  type="button"
                  disabled={updateMutation.isPending || shippedBlocked(action.to)}
                  onClick={() => {
                    emitHaptic("action.primary");
                    setConfirm({ to: action.to, label: action.label });
                  }}
                  className="ios-pressable flex min-h-12 items-center justify-center bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
                >
                  {action.label}
                </button>
              ))}
              {actions.some((a) => shippedBlocked(a.to)) && (
                <p className="text-[10px] uppercase tracking-widest text-amber-300">Add a tracking number before marking shipped</p>
              )}
              {(canCancelOrder(order.status) || canRefundOrder(order.status)) && !refundForm && (
                <div className="grid grid-cols-2 gap-2">
                  {canCancelOrder(order.status) && (
                    <button type="button" onClick={() => { emitHaptic("mutation.warning"); setConfirm({ to: "cancelled", label: "Cancel this order", destructive: true }); }} className="ios-pressable flex min-h-11 items-center justify-center border border-red-500/40 text-xs font-bold uppercase tracking-widest text-red-400">
                      Cancel order
                    </button>
                  )}
                  {canRefundOrder(order.status) && (
                    <button type="button" onClick={() => { emitHaptic("mutation.warning"); setRefundForm({ amount: Number(order.total_aud || 0), reason: "", error: null }); }} className="ios-pressable flex min-h-11 items-center justify-center border border-red-500/40 text-xs font-bold uppercase tracking-widest text-red-400">
                      {useStripeRefund ? "Refund via Stripe" : "Record refund"}
                    </button>
                  )}
                </div>
              )}
              {refundForm && (
                <div className="border border-red-500/40 bg-red-500/5 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-300">{useStripeRefund ? "Refund via Stripe" : "Record refund"}</p>
                  <p className="pb-2 pt-1 text-[10px] leading-snug text-muted-foreground">
                    {useStripeRefund
                      ? "Issues a real refund through Stripe to the customer's original payment method, then updates the order."
                      : "This records the refund on the order only. Issue the actual refund to the customer separately in the Stripe dashboard."}
                  </p>
                  <div className="grid gap-2">
                    <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-refund-amount">
                      Refund amount (AUD)
                    </label>
                    <Input
                      id="native-refund-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={refundForm.amount}
                      onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value, error: null })}
                      className="h-11 rounded-none border-border bg-background font-mono"
                    />
                    <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-refund-reason">
                      Reason
                    </label>
                    <Input
                      id="native-refund-reason"
                      placeholder="Reason for refund…"
                      value={refundForm.reason}
                      onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
                      className="h-11 rounded-none border-border bg-background"
                    />
                  </div>
                  {refundForm.error && (
                    <p className="pt-2 text-[10px] font-bold text-red-400" role="alert">{refundForm.error}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-3">
                    <button type="button" disabled={updateMutation.isPending || stripeRefundMutation.isPending} onClick={() => setRefundForm(null)} className="ios-pressable flex min-h-11 items-center justify-center border border-border text-xs font-bold uppercase tracking-widest disabled:opacity-40">
                      Cancel
                    </button>
                    <button type="button" disabled={updateMutation.isPending || stripeRefundMutation.isPending} onClick={() => { emitHaptic("mutation.warning"); confirmRefund(); }} className="ios-pressable flex min-h-11 items-center justify-center border border-red-500/60 bg-red-500/15 text-xs font-bold uppercase tracking-widest text-red-300 disabled:opacity-40">
                      {stripeRefundMutation.isPending ? "Refunding…" : useStripeRefund ? "Issue refund" : "Record refund"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline */}
        {(order.timeline || []).length > 0 && (
          <div className="border border-border/60 bg-card/50 p-3">
            <p className="pb-1 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Timeline</p>
            {[...(order.timeline || [])]
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
              .slice(0, 12)
              .map((entry, idx) => (
                <p key={idx} className="border-b border-border/30 py-1.5 text-xs last:border-0">
                  <span className="font-bold">{entry.action}</span>
                  <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
                    {formatDate(entry.timestamp)} · {entry.actor}{entry.note ? ` · ${entry.note}` : ""}
                  </span>
                </p>
              ))}
          </div>
        )}
      </div>

      <AdminConfirmSheet
        open={!!confirm}
        title={confirm?.label || "Confirm"}
        description={confirm?.destructive ? "This changes the order's state for the customer. Stripe payment records are unaffected." : "The customer's order history updates immediately."}
        confirmLabel={confirm?.label || "Confirm"}
        variant={confirm?.destructive ? "destructive" : "default"}
        loading={updateMutation.isPending}
        onConfirm={() => runTransition(confirm.to)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
