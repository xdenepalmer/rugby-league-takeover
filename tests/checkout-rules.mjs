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

// ── Fulfilment: ship (AusPost, Australia only) or collect in Las Vegas ──────
//
// AusPost rates are domestic, so shipping can only serve Australian addresses.
// Overseas supporters collect at the event instead. Both the feature and who
// may use it are admin settings, and this decides — server-side — whether a
// given (choice, country) pair is allowed to check out at all.
//
// settings: { pickup_enabled, pickup_audience: 'international'|'everyone' }
// Returns { ok: true, method, shipping? } or { ok: false, error }.
export const isAustralia = (country) => {
  const c = toTrimmedString(country).toUpperCase();
  return c === "AU" || c === "AUS" || c === "AUSTRALIA";
};

export function resolveFulfilment({ method, shipping, country, settings, shippingMode = "calculated" } = {}) {
  const choice = toTrimmedString(method).toLowerCase() || "shipping";
  const pickupEnabled = settings?.pickup_enabled === true;
  const audience = toTrimmedString(settings?.pickup_audience).toLowerCase() || "international";
  const australian = isAustralia(country);

  if (choice === "pickup") {
    if (!pickupEnabled) {
      return { ok: false, error: "Collection in Las Vegas is not currently available." };
    }
    // 'international' restricts collection to overseas supporters; 'everyone'
    // lets Australian customers collect instead of paying for shipping.
    if (audience === "international" && australian) {
      return { ok: false, error: "Collection is for international orders only — please choose a shipping method." };
    }
    return { ok: true, method: "pickup", shipping: null };
  }

  if (choice !== "shipping") {
    return { ok: false, error: "Choose how you'd like to receive your order." };
  }

  // Shipping is Australia-only. An overseas customer is told what to do next
  // rather than being left at a dead end.
  if (country && !australian) {
    return {
      ok: false,
      error: pickupEnabled
        ? "We only ship within Australia — choose collection in Las Vegas instead."
        : "We currently only ship within Australia.",
    };
  }

  // Fixed mode: no signed AusPost quote to verify — the flat rate is computed
  // server-side. Mirrors createCheckout's resolveFulfilment fixed branch.
  if (shippingMode === "fixed") {
    return { ok: true, method: "shipping", shipping: null };
  }

  const selection = buildShippingLineItem(shipping);
  if (!selection) {
    return { ok: false, error: "A shipping option is required — please choose a shipping method." };
  }
  return { ok: true, method: "shipping", shipping: selection };
}

// ── Fixed (flat-rate) shipping — executable mirror of createCheckout's
// shippingModeOf / productShipsUnderMode / computeFixedShippingCents. Kept here
// (not just grepped) so the amount actually charged has behavioural coverage.
export function shippingModeOf(settings) {
  return settings?.shipping_mode === "fixed" ? "fixed" : "calculated";
}

const clampFlatRateCents = (value, fallbackAud) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n * 100) : Math.round(fallbackAud * 100);
};
const clampOverrideCents = (value) => {
  const n = Number(value);
  // Per-product override shares the store rate's [0, $1000] guardrail so a
  // fat-fingered value can't produce a runaway postage charge.
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n * 100), 100000) : 0;
};

export function productShipsUnderMode(product, mode) {
  if (product?.shipping_required !== false) return true;
  if (mode === "fixed") {
    const override = Number(product?.flat_shipping_aud);
    return Number.isFinite(override) && override > 0;
  }
  return false;
}

export function computeFixedShippingCents(items, productsById, settings) {
  const single = clampFlatRateCents(settings?.shipping_flat_single_aud, 12.5);
  const multi = clampFlatRateCents(settings?.shipping_flat_multi_aud, 15.9);
  let units = 0;
  let overrideMaxCents = 0;
  for (const item of items || []) {
    const product = productsById.get(toTrimmedString(item?.productId ?? item?.product_id));
    if (!product) continue;
    const qty = Math.max(0, Math.floor(Number(item?.quantity) || 0));
    if (qty <= 0) continue;
    const overrideCents = clampOverrideCents(product.flat_shipping_aud);
    if (product.shipping_required === false && overrideCents <= 0) continue;
    units += qty;
    if (overrideCents > 0) overrideMaxCents = Math.max(overrideMaxCents, overrideCents);
  }
  if (units <= 0) return 0;
  return Math.max(units >= 2 ? multi : single, overrideMaxCents);
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
  if (session.payment_status !== "paid") return { ok: false, error: "Checkout session is not paid" };
  if (order.stripe_session_id && session.id !== order.stripe_session_id) return { ok: false, error: "Checkout session does not match order" };
  if (session.metadata?.order_id && session.metadata.order_id !== order.id) return { ok: false, error: "Session order metadata does not match order" };
  if (expectedAppId && session.metadata?.rlt_app_id && session.metadata.rlt_app_id !== expectedAppId) return { ok: false, error: "Session app metadata does not match this app" };
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
