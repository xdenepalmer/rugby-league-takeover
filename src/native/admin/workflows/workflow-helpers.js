/**
 * Pure logic for the native admin workflows (Orders, Moderation,
 * Registrations). Mirrors the web managers' rules — statuses, pipeline
 * filters, timeline entry shape, shipping/refund payload fields, moderation
 * queues — so the native screens write payload-parity updates through the
 * same entities.
 */
import { addBusinessDays, format } from "date-fns";

/**
 * Web parity: the admin managers dispatch `rlt_admin_log` CustomEvents on
 * moderation/ban/settings writes. Nothing in the app listens for the event
 * today (write-only bus), but native dispatches the same events so any
 * future consumer sees identical trails from both surfaces. No-op outside a
 * browser (pure-logic tests import this module under node).
 */
export function emitAdminLog(type, text) {
  try {
    window.dispatchEvent(new CustomEvent("rlt_admin_log", { detail: { type, text } }));
  } catch {
    // non-browser context
  }
}

// ── Orders ───────────────────────────────────────────────────────────────
export const ORDER_STATUSES = ["pending", "paid", "packing", "shipped", "completed", "cancelled", "refunded"];
export const PAID_LIKE_STATUSES = ["paid", "packing", "shipped", "completed"];

export const ORDER_FILTERS = [
  { key: "all", label: "All", statuses: ORDER_STATUSES },
  { key: "unfulfilled", label: "Unfulfilled", statuses: ["paid"] },
  { key: "packing", label: "Packing", statuses: ["packing"] },
  { key: "shipped", label: "Shipped", statuses: ["shipped"] },
  { key: "completed", label: "Delivered", statuses: ["completed"] },
  { key: "other", label: "Other", statuses: ["pending", "cancelled", "refunded"] },
];

export const ORDER_STATUS_META = {
  pending: { label: "Pending", tone: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  paid: { label: "Paid", tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  packing: { label: "Packing", tone: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  shipped: { label: "Shipped", tone: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
  completed: { label: "Delivered", tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  cancelled: { label: "Cancelled", tone: "border-red-500/40 bg-red-500/10 text-red-300" },
  refunded: { label: "Refunded", tone: "border-red-500/40 bg-red-500/10 text-red-300" },
};

export const orderStatusMeta = (status) => ORDER_STATUS_META[status] || ORDER_STATUS_META.pending;

/** Same shape the web manager appends (OrdersManager.makeTimelineEntry). */
export function makeTimelineEntry(action, actor, note) {
  return { action, timestamp: new Date().toISOString(), actor: actor || "system", ...(note ? { note } : {}) };
}

export function filterOrders(orders, { query = "", filter = "all" } = {}) {
  const group = ORDER_FILTERS.find((f) => f.key === filter) || ORDER_FILTERS[0];
  const q = query.trim().toLowerCase();
  return (orders || []).filter((order) => {
    if (!group.statuses.includes(order.status || "pending")) return false;
    if (!q) return true;
    return [order.id, order.customer_name, order.customer_email, order.user_email, order.tracking_number]
      .map((v) => String(v || "").toLowerCase())
      .some((v) => v.includes(q));
  });
}

/**
 * The forward workflow actions available from a status (the web pipeline:
 * paid → packing → shipped → completed). Cancel/refund are offered
 * separately as destructive actions on non-final orders.
 */
export function nextOrderActions(status) {
  switch (status) {
    case "paid":
      return [{ to: "packing", label: "Start packing" }, { to: "shipped", label: "Mark shipped", requiresTracking: true }];
    case "packing":
      return [{ to: "shipped", label: "Mark shipped", requiresTracking: true }];
    case "shipped":
      return [{ to: "completed", label: "Mark delivered" }];
    default:
      return [];
  }
}

export function canCancelOrder(status) {
  return !["completed", "cancelled", "refunded"].includes(status || "pending");
}

/** Web parity: a refund can be recorded for any order that isn't already
 *  refunded (including delivered orders — OrdersManager shows Record Refund
 *  whenever status !== "refunded"). */
export function canRefundOrder(status) {
  return (status || "pending") !== "refunded";
}

/** Shipping-method config mirrored from the web OrdersManager. */
export const SHIPPING_METHODS = {
  standard: { label: "Standard (7–10 business days)", days: 10 },
  express: { label: "Express (3–5 business days)", days: 5 },
  priority: { label: "Priority (1–2 business days)", days: 2 },
};

/** Same estimated-delivery calculation the web manager writes on ship. */
export function calcEstimatedDelivery(shippedAt, shippingMethod) {
  if (!shippedAt) return null;
  const method = SHIPPING_METHODS[shippingMethod] || SHIPPING_METHODS.standard;
  return format(addBusinessDays(new Date(shippedAt), method.days), "yyyy-MM-dd");
}

/** Build the exact update payload the web manager writes for a transition. */
export function buildOrderStatusPayload(order, newStatus, { actorEmail, tracking } = {}) {
  const data = { status: newStatus };
  if (newStatus === "shipped") {
    data.tracking_number = tracking?.number || order.tracking_number || "";
    data.tracking_url = tracking?.url || order.tracking_url || "";
    data.carrier = tracking?.carrier || order.carrier || "";
    if (!order.shipped_at) data.shipped_at = new Date().toISOString();
    // Customer-facing: both web ship paths write estimated_delivery unless
    // an override already exists (OrdersManager executeAction/handleStatusChange).
    if (!order.estimated_delivery) {
      data.estimated_delivery = calcEstimatedDelivery(
        data.shipped_at || order.shipped_at,
        order.shipping_method || "standard"
      );
    }
  }
  if (newStatus === "completed" && !order.delivered_at) {
    data.delivered_at = new Date().toISOString();
  }
  const label = orderStatusMeta(newStatus).label;
  data.timeline = [...(order.timeline || []), makeTimelineEntry(`Status changed to ${label}`, actorEmail)];
  return data;
}

/**
 * Validate an admin-entered refund amount against the order total. Refunds
 * here are RECORDED, not charged — buildRefundPayload only writes order fields;
 * the money movement is a separate action in the Stripe dashboard. But the
 * recorded figure must still be real: a positive amount that never claims more
 * than the customer actually paid. Returns { ok, amount, error }.
 */
export function validateRefundAmount(rawAmount, orderTotalAud) {
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, amount: null, error: "Enter a refund amount greater than $0." };
  }
  const total = Number(orderTotalAud);
  // 0.005 tolerance so an exact full refund isn't rejected by float rounding.
  if (Number.isFinite(total) && total > 0 && amount > total + 0.005) {
    return { ok: false, amount: null, error: `Refund can't exceed the order total ($${total.toFixed(2)} AUD).` };
  }
  return { ok: true, amount: Number(amount.toFixed(2)), error: null };
}

/**
 * Refund RECORD payload the web manager writes (OrdersManager.handleRefundConfirm).
 * This marks the order refunded in our records only — it does NOT move money.
 * The actual refund must be issued separately in Stripe; the timeline note says
 * so, so the audit trail never implies a charge was reversed here.
 */
export function buildRefundPayload(order, { actorEmail, amount, reason } = {}) {
  const cents = Number(amount);
  const display = (Number.isFinite(cents) ? cents : 0).toFixed(2);
  return {
    status: "refunded",
    refund_amount: Number(amount),
    refund_reason: reason || "",
    refunded_at: new Date().toISOString(),
    timeline: [
      ...(order.timeline || []),
      makeTimelineEntry(
        "Refund recorded",
        actorEmail,
        `Refund $${display} AUD recorded — ${reason || "No reason provided"}. Issue the Stripe refund separately.`
      ),
    ],
  };
}

// ── Forum moderation ─────────────────────────────────────────────────────
export const MOD_QUEUES = [
  { key: "pending", label: "Pending" },
  { key: "reported", label: "Reported" },
  { key: "live", label: "Live" },
  { key: "removed", label: "Removed" },
];

export function moderationQueue(posts, queue) {
  const list = posts || [];
  switch (queue) {
    case "pending":
      return list.filter((p) => p.is_published !== true && !p.deleted_at);
    case "reported":
      return list.filter((p) => (p.reported_count || 0) > 0 && !p.deleted_at);
    case "live":
      return list.filter((p) => p.is_published === true && !p.deleted_at);
    case "removed":
      return list.filter((p) => !!p.deleted_at);
    default:
      return list;
  }
}

export function moderationCounts(posts) {
  return Object.fromEntries(MOD_QUEUES.map((q) => [q.key, moderationQueue(posts, q.key).length]));
}

/** Exact soft-delete payload the web manager writes. */
export function buildSoftDeletePayload(actorEmail, reason) {
  return {
    deleted_at: new Date().toISOString(),
    deleted_by: actorEmail || "",
    is_published: false,
    ...(reason ? { moderation_reason: reason } : {}),
  };
}

/** Exact restore payload — restored posts still need re-approval. */
export function buildRestorePayload() {
  return { deleted_at: "", deleted_by: "", is_published: false };
}

/** Fan-side thread route for a moderated post (replies open their thread). */
export function fanThreadPath(post) {
  const rootId = post?.parent_id || post?.id;
  return rootId ? `/forum/thread/${encodeURIComponent(rootId)}` : "/forum";
}

// ── Registrations ────────────────────────────────────────────────────────
export function filterRegistrations(registrations, query = "") {
  const q = query.trim().toLowerCase();
  if (!q) return registrations || [];
  return (registrations || []).filter((item) =>
    `${item.name || ""} ${item.email || ""} ${item.phone || ""} ${item.postcode || ""} ${item.team_supported || ""} ${item.trip_details || ""}`
      .toLowerCase()
      .includes(q)
  );
}

/** BCC list for the filtered set — mirrors the web bulk-email action. */
export function registrationEmailTargets(registrations) {
  return [...new Set((registrations || []).map((r) => String(r.email || "").trim()).filter(Boolean))];
}
