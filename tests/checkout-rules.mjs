export const MAX_CHECKOUT_QUANTITY = 20;
export const CHECKOUT_CURRENCY = "aud";
export const DEFAULT_CHECKOUT_ORIGIN = "https://rugbyleagetakeover.base44.app";

const toTrimmedString = (value) => String(value ?? "").trim();

const toPositiveInteger = (value, fallback = 1) => {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const toMoneyCents = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number * 100);
};

const getTrackedStock = (product) => {
  const stock = Number(product?.stock_quantity);
  return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : null;
};

export function normalizeCheckoutItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];

  const byProductId = new Map();
  for (const item of rawItems) {
    const productId = toTrimmedString(item?.productId);
    if (!productId) continue;

    const quantity = Math.min(toPositiveInteger(item?.quantity), MAX_CHECKOUT_QUANTITY);
    byProductId.set(productId, Math.min((byProductId.get(productId) || 0) + quantity, MAX_CHECKOUT_QUANTITY));
  }

  return [...byProductId.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export function buildCheckoutLineItems(items, getProduct) {
  const lineItems = [];
  const stripeLineItems = [];

  for (const item of items) {
    const product = getProduct(item.productId);
    if (!product || product.is_active === false) {
      return { ok: false, status: 404, error: `Product '${item.productId}' is not available` };
    }

    const unitAmount = toMoneyCents(product.price_aud);
    if (!unitAmount) {
      return { ok: false, status: 400, error: `Product '${item.productId}' has an invalid price` };
    }

    const stock = getTrackedStock(product);
    if (stock !== null && stock < item.quantity) {
      return { ok: false, status: 409, error: `Not enough stock for product '${product.name || item.productId}'` };
    }

    lineItems.push({
      product_id: product.id,
      name: product.name,
      quantity: item.quantity,
      price_aud: Number((unitAmount / 100).toFixed(2)),
    });

    stripeLineItems.push({
      quantity: item.quantity,
      price_data: {
        currency: CHECKOUT_CURRENCY,
        unit_amount: unitAmount,
        product_data: {
          name: product.name,
          description: product.description || undefined,
          images: product.image_url ? [product.image_url] : undefined,
        },
      },
    });
  }

  if (lineItems.length === 0) {
    return { ok: false, status: 400, error: "No valid products in cart" };
  }

  return { ok: true, lineItems, stripeLineItems };
}

export function calculateOrderTotalAud(lineItems, shippingCostAud = 0) {
  const cents = lineItems.reduce((total, item) => total + Math.round(Number(item.price_aud || 0) * 100) * Number(item.quantity || 0), 0);
  return Number(((cents + Math.round(Number(shippingCostAud || 0) * 100)) / 100).toFixed(2));
}

// A priced AusPost shipping selection (from the auspostRates function) is
// required before checkout — this builds its order-record fields and, when
// the price is non-zero, the Stripe line item that charges for it.
export function buildShippingLineItem(shipping) {
  const code = toTrimmedString(shipping?.code);
  const name = toTrimmedString(shipping?.name) || "Shipping";
  const postcode = toTrimmedString(shipping?.postcode);
  const price = Number(shipping?.price_aud);
  if (!code || !postcode || !Number.isFinite(price) || price < 0) return null;

  const unitAmount = Math.round(price * 100);
  return {
    code,
    name,
    postcode,
    price_aud: Number((unitAmount / 100).toFixed(2)),
    stripeLineItem: unitAmount > 0
      ? {
          quantity: 1,
          price_data: {
            currency: CHECKOUT_CURRENCY,
            unit_amount: unitAmount,
            product_data: { name: `Shipping — ${name} (AusPost)` },
          },
        }
      : null,
  };
}

export function resolveCheckoutOrigin(originHeader, allowlistEnv, fallback = DEFAULT_CHECKOUT_ORIGIN) {
  const fallbackOrigin = parseOrigin(fallback) || DEFAULT_CHECKOUT_ORIGIN;
  const requestedOrigin = parseOrigin(originHeader);
  if (!requestedOrigin) return fallbackOrigin;

  const allowedOrigins = new Set(
    String(allowlistEnv || fallbackOrigin)
      .split(",")
      .map(parseOrigin)
      .filter(Boolean)
  );
  allowedOrigins.add(fallbackOrigin);

  return allowedOrigins.has(requestedOrigin) ? requestedOrigin : fallbackOrigin;
}

export function resolveCheckoutCustomer({ customerName = "", customerEmail = "", user = null } = {}) {
  return {
    name: toTrimmedString(customerName || user?.full_name),
    email: toTrimmedString(customerEmail || user?.email),
  };
}

export function buildOrderMetadata({ appId, orderId, totalAud }) {
  return {
    rlt_app_id: toTrimmedString(appId),
    order_id: toTrimmedString(orderId),
    expected_total_aud: Number(totalAud || 0).toFixed(2),
  };
}

// Classify a checkout session against the order it claims to pay (mirrors
// stripeWebhook/index.ts):
//   'paid'    → every binding holds and the money is in: write payment state.
//   'pending' → bindings hold but payment isn't complete (async methods still
//               settling): acknowledge, wait for async_payment_succeeded.
//   'reject'  → a binding/amount/currency mismatch: 400 so the anomaly stays
//               loud in the Stripe dashboard.
export function classifyCheckoutSession(session, order, expectedAppId = "") {
  if (!session || !order) return { outcome: "reject", reason: "Missing session or order" };
  if (order.stripe_session_id && session.id !== order.stripe_session_id) return { outcome: "reject", reason: "Checkout session does not match order" };
  if (session.metadata?.order_id && session.metadata.order_id !== order.id) return { outcome: "reject", reason: "Session order metadata does not match order" };
  if (expectedAppId && session.metadata?.rlt_app_id && session.metadata.rlt_app_id !== expectedAppId) return { outcome: "reject", reason: "Session app metadata does not match this app" };
  if (String(session.currency || "").toLowerCase() !== CHECKOUT_CURRENCY) return { outcome: "reject", reason: "Checkout currency does not match" };

  const expectedCents = Math.round(Number(order.total_aud || 0) * 100);
  if (Number(session.amount_total) !== expectedCents) return { outcome: "reject", reason: "Checkout amount does not match order total" };

  // Same confirmation rule the return screens apply (checkout-return.js):
  // Stripe's payment_status is the EXCLUSIVE authority.
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return { outcome: "pending", reason: "Checkout session is not paid yet" };
  }
  return { outcome: "paid" };
}

// Back-compat shim over classifyCheckoutSession — same accept/refuse answer
// the webhook used before async payment support ('pending' is not ok to pay).
export function isPaidSessionForOrder(session, order, expectedAppId = "") {
  const verdict = classifyCheckoutSession(session, order, expectedAppId);
  return verdict.outcome === "paid" ? { ok: true } : { ok: false, error: verdict.reason };
}

// Server-side refund validation (mirrors stripeRefund/index.ts
// validateStripeRefundAmount): cents-first rounding, ≥ $0.01, and never more
// than what's still refundable after prior partial refunds.
export function validateStripeRefundAmount(rawAmount, orderTotalAud, alreadyRefundedAud = 0) {
  const raw = Number(rawAmount);
  if (!Number.isFinite(raw)) {
    return { ok: false, error: "Enter a refund amount greater than $0." };
  }
  const amountAud = Number(raw.toFixed(2));
  if (amountAud < 0.01) {
    return { ok: false, error: "Enter a refund amount greater than $0." };
  }
  const total = Number(orderTotalAud);
  const refunded = Number(alreadyRefundedAud);
  const priorAud = Number.isFinite(refunded) && refunded > 0 ? Number(refunded.toFixed(2)) : 0;
  if (Number.isFinite(total) && total > 0) {
    const remaining = Number((Number(total.toFixed(2)) - priorAud).toFixed(2));
    if (amountAud > remaining) {
      return {
        ok: false,
        error: priorAud > 0
          ? `Refund can't exceed the remaining balance ($${remaining.toFixed(2)} AUD — $${priorAud.toFixed(2)} already refunded).`
          : `Refund can't exceed the order total ($${total.toFixed(2)} AUD).`,
      };
    }
  }
  return { ok: true, amountAud, amountCents: Math.round(amountAud * 100), error: null };
}

export function getNextStockQuantity(product, purchasedQuantity) {
  const stock = getTrackedStock(product);
  if (stock === null) return null;
  return Math.max(0, stock - toPositiveInteger(purchasedQuantity));
}

// Webhook-time oversell detection (mirrors stripeWebhook). Returns the product
// ids whose paid quantity exceeded available stock at fulfillment — so the order
// can be flagged for admin review instead of silently shipping gone inventory.
export function detectOversoldItems(lineItems, getProduct) {
  const oversold = [];
  for (const item of lineItems || []) {
    if (!item.product_id) continue;
    const available = getTrackedStock(getProduct(item.product_id));
    if (available === null) continue;
    if (toPositiveInteger(item.quantity) > available) oversold.push(item.product_id);
  }
  return oversold;
}

function parseOrigin(value) {
  try {
    return new URL(String(value || "")).origin;
  } catch {
    return "";
  }
}
