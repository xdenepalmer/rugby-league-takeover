/**
 * Checkout-return policy, shared by the native return screen (and any future
 * web upgrade). The rule this encodes: the return URL proves navigation, the
 * VERIFIED Stripe session / webhook-written order state proves payment. The
 * cart may be cleared exactly once, and only after verification confirms.
 */
export const PAID_ORDER_STATUSES = ["paid", "packing", "shipped", "completed"];

const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{10,240}$/;

export function isValidStripeSessionId(value) {
  return SESSION_ID_PATTERN.test(String(value ?? "").trim());
}

/**
 * Map a verifyCheckoutReturn result to a UI confirmation state:
 *  - "confirmed"  → Stripe says paid (or the webhook already advanced the order)
 *  - "pending"    → session completed but payment still processing (async
 *                   methods / webhook lag) — keep the cart, poll politely
 *  - "cancelled"  → the session expired without payment
 *  - "unverified" → anything else (missing/foreign session, error) — never
 *                   show success, never touch the cart
 */
export function resolveCheckoutConfirmation(result) {
  if (!result || typeof result !== "object") return "unverified";
  const { paymentStatus, sessionStatus, orderStatus } = result;
  if (paymentStatus === "paid" || paymentStatus === "no_payment_required") return "confirmed";
  if (orderStatus && PAID_ORDER_STATUSES.includes(orderStatus)) return "confirmed";
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
