export const MAX_CHECKOUT_QUANTITY = 20;
export const FLAT_DOMESTIC_SHIPPING_AUD = 15;
export const FREE_DOMESTIC_SHIPPING_THRESHOLD_AUD = 150;
export const CHECKOUT_CURRENCY = "aud";
export const DEFAULT_CHECKOUT_ORIGIN = "https://rugbyleagetakeover.base44.app";

const toTrimmedString = (value) => String(value ?? "").trim();

const toPositiveInteger = (value, fallback = null) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
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

  if (rawItems.length > 40) return [];
  const byProductId = new Map();
  for (const item of rawItems) {
    const productId = toTrimmedString(item?.productId);
    const quantity = toPositiveInteger(item?.quantity);
    if (!productId || !quantity) continue;

    const size = toTrimmedString(item?.size);
    const key = `${productId}::${size.toLowerCase()}`;
    const existing = byProductId.get(key) || { productId, size, quantity: 0 };
    existing.quantity = Math.min(existing.quantity + quantity, MAX_CHECKOUT_QUANTITY);
    byProductId.set(key, existing);
    if (byProductId.size > 20) return [];
  }

  return [...byProductId.values()];
}

export function buildCheckoutLineItems(items, getProduct) {
  const lineItems = [];
  const stripeLineItems = [];

  for (const item of items) {
    const product = getProduct(item.productId);
    if (!product || product.is_active === false || product.coming_soon === true) {
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

    const variants = Array.isArray(product.sizes) ? product.sizes.map((entry) => ({
      size: toTrimmedString(typeof entry === "string" ? entry : entry?.size),
      stock_quantity: Math.max(0, Math.floor(Number(typeof entry === "string" ? 0 : entry?.stock_quantity) || 0)),
    })).filter((entry) => entry.size) : [];
    let canonicalSize = "";
    if (variants.length) {
      const variant = variants.find((entry) => entry.size.toLowerCase() === toTrimmedString(item.size).toLowerCase());
      if (!variant || variant.stock_quantity < item.quantity) {
        return { ok: false, status: 409, error: `Select an available size for '${product.name || item.productId}'` };
      }
      canonicalSize = variant.size;
    } else if (item.size) {
      return { ok: false, status: 409, error: `Product '${product.name || item.productId}' does not use sizes` };
    }

    lineItems.push({
      product_id: product.id,
      name: product.name,
      size: canonicalSize,
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

// Generic shipping line-item helper used by the flat-rate policy below.
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
            product_data: { name: `Shipping — ${name}` },
          },
        }
      : null,
  };
}

export function buildDomesticShipping(subtotalAud) {
  const price = Number(subtotalAud) >= FREE_DOMESTIC_SHIPPING_THRESHOLD_AUD
    ? 0
    : FLAT_DOMESTIC_SHIPPING_AUD;
  return buildShippingLineItem({
    code: "DOMESTIC_STANDARD",
    name: "Standard shipping (4–7 business days)",
    postcode: "AU",
    price_aud: price,
  });
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

export function isPaidSessionForOrder(session, order, expectedAppId = "") {
  if (!session || !order) return { ok: false, error: "Missing session or order" };
  if (session.mode !== "payment") return { ok: false, error: "Unexpected Checkout mode" };
  if (session.payment_status !== "paid") return { ok: false, error: "Checkout session is not paid" };
  if (session.id !== order.stripe_session_id) return { ok: false, error: "Checkout session does not match order" };
  if (session.client_reference_id !== order.id) return { ok: false, error: "Session client reference does not match order" };
  if (session.metadata?.order_id !== order.id) return { ok: false, error: "Session order metadata does not match order" };
  if (expectedAppId && session.metadata?.rlt_app_id !== expectedAppId) return { ok: false, error: "Session app metadata does not match this app" };
  if (Boolean(session.livemode) !== Boolean(order.expected_livemode)) return { ok: false, error: "Stripe mode does not match" };
  if (String(session.currency || "").toLowerCase() !== CHECKOUT_CURRENCY) return { ok: false, error: "Checkout currency does not match" };

  const expectedCents = Math.round(Number(order.total_aud || 0) * 100);
  if (Number(session.amount_total) !== expectedCents) return { ok: false, error: "Checkout amount does not match order total" };
  if (!session.shipping_details?.address?.line1 || String(session.shipping_details.address.country).toUpperCase() !== "AU") {
    return { ok: false, error: "Australian shipping address required" };
  }

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
