/**
 * Checkout-return policy, shared by the web and native return screens (via
 * useCheckoutReturn). The rule this encodes: the return URL proves navigation
 * only; Stripe's live payment_status is the EXCLUSIVE proof of payment. The
 * cart may be cleared exactly once, and only after Stripe confirms.
 */
// Webhook-written "paid-like" order states. Informational ONLY (e.g. showing
// "your order is being prepared") — deliberately NOT used to confirm a
// checkout return. A stale/anomalous internal status must never be able to
// upgrade an unpaid Stripe session into a "paid" claim; Stripe is exclusive.
export const PAID_ORDER_STATUSES = ["paid", "packing", "shipped", "completed"];

const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{10,240}$/;

export function isValidStripeSessionId(value) {
  return SESSION_ID_PATTERN.test(String(value ?? "").trim());
}

/**
 * Map a verifyCheckoutReturn result to a UI confirmation state. Confirmation
 * is driven by Stripe's payment_status EXCLUSIVELY — the endpoint's
 * webhook-written `orderStatus` is never allowed to confirm payment on its own.
 *  - "confirmed"  → Stripe reports the session paid (or no payment required)
 *  - "pending"    → session completed but payment still processing (async
 *                   methods / webhook lag) — keep the cart, poll politely
 *  - "cancelled"  → the session expired without payment
 *  - "unverified" → anything else (missing/foreign session, error, or an
 *                   unpaid session that isn't clearly pending/expired) — never
 *                   show success, never touch the cart
 */
export function resolveCheckoutConfirmation(result) {
  if (!result || typeof result !== "object") return "unverified";
  const { paymentStatus, sessionStatus } = result;
  if (paymentStatus === "paid" || paymentStatus === "no_payment_required") return "confirmed";
  if (sessionStatus === "complete") return "pending";
  if (sessionStatus === "expired") return "cancelled";
  return "unverified";
}

/** Exactly-once cart clearing, keyed per session id across remounts. */
export function shouldClearCart(confirmation, alreadyCleared) {
  return confirmation === "confirmed" && alreadyCleared !== true;
}

const clearedKey = (sessionId) => `rlt_checkout_cleared_${sessionId}`;

export function wasCartClearedFor(sessionId, storage) {
  try {
    return (storage || localStorage).getItem(clearedKey(sessionId)) === "1";
  } catch {
    return false;
  }
}

export function markCartClearedFor(sessionId, storage) {
  try {
    (storage || localStorage).setItem(clearedKey(sessionId), "1");
  } catch {
    // best-effort
  }
}
