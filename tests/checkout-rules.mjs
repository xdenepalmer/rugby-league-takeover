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

export function calculateOrderTotalAud(lineItems) {
  const cents = lineItems.reduce((total, item) => total + Math.round(Number(item.price_aud || 0) * 100) * Number(item.quantity || 0), 0);
  return Number((cents / 100).toFixed(2));
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
    base44_app_id: toTrimmedString(appId),
    order_id: toTrimmedString(orderId),
    expected_total_aud: Number(totalAud || 0).toFixed(2),
  };
}

export function isPaidSessionForOrder(session, order, expectedAppId = "") {
  if (!session || !order) return { ok: false, error: "Missing session or order" };
  if (session.payment_status !== "paid") return { ok: false, error: "Checkout session is not paid" };
  if (order.stripe_session_id && session.id !== order.stripe_session_id) return { ok: false, error: "Checkout session does not match order" };
  if (session.metadata?.order_id && session.metadata.order_id !== order.id) return { ok: false, error: "Session order metadata does not match order" };
  if (expectedAppId && session.metadata?.base44_app_id && session.metadata.base44_app_id !== expectedAppId) return { ok: false, error: "Session app metadata does not match this app" };
  if (String(session.currency || "").toLowerCase() !== CHECKOUT_CURRENCY) return { ok: false, error: "Checkout currency does not match" };

  const expectedCents = Math.round(Number(order.total_aud || 0) * 100);
  if (Number(session.amount_total) !== expectedCents) return { ok: false, error: "Checkout amount does not match order total" };

  return { ok: true };
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
