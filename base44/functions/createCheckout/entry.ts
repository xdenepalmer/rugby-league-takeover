import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@22.2.0';

// NOTE: Base44 deploys each function from its own directory and does not support
// importing shared modules across functions. All checkout logic must stay inlined
// here. The canonical, unit-tested copy of these rules lives in
// tests/checkout-rules.mjs — keep the two in sync when editing.
const MAX_CHECKOUT_QUANTITY = 20;
const CHECKOUT_CURRENCY = 'aud';
const DEFAULT_CHECKOUT_ORIGIN = 'https://rugbyleagetakeover.base44.app';

const toTrimmedString = (value) => String(value ?? '').trim();

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

const parseOrigin = (value) => {
  try {
    return new URL(String(value || '')).origin;
  } catch {
    return '';
  }
};

function normalizeCheckoutItems(rawItems) {
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

function buildCheckoutLineItems(items, getProduct) {
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
    return { ok: false, status: 400, error: 'No valid products in cart' };
  }

  return { ok: true, lineItems, stripeLineItems };
}

function calculateOrderTotalAud(lineItems) {
  const cents = lineItems.reduce((total, item) => total + Math.round(Number(item.price_aud || 0) * 100) * Number(item.quantity || 0), 0);
  return Number((cents / 100).toFixed(2));
}

function resolveCheckoutOrigin(originHeader, allowlistEnv, fallback = DEFAULT_CHECKOUT_ORIGIN) {
  const fallbackOrigin = parseOrigin(fallback) || DEFAULT_CHECKOUT_ORIGIN;
  const requestedOrigin = parseOrigin(originHeader);
  if (!requestedOrigin) return fallbackOrigin;

  const allowedOrigins = new Set(
    String(allowlistEnv || fallbackOrigin)
      .split(',')
      .map(parseOrigin)
      .filter(Boolean)
  );
  allowedOrigins.add(fallbackOrigin);

  return allowedOrigins.has(requestedOrigin) ? requestedOrigin : fallbackOrigin;
}

function resolveCheckoutCustomer({ customerName = '', customerEmail = '', user = null } = {}) {
  return {
    name: toTrimmedString(customerName || user?.full_name),
    email: toTrimmedString(customerEmail || user?.email),
  };
}

function buildOrderMetadata({ appId, orderId, totalAud }) {
  return {
    base44_app_id: toTrimmedString(appId),
    order_id: toTrimmedString(orderId),
    expected_total_aud: Number(totalAud || 0).toFixed(2),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const { items, customerName = '', customerEmail = '' } = await req.json();
    const normalizedItems = normalizeCheckoutItems(items);

    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }

    const { name: resolvedName, email: resolvedEmail } = resolveCheckoutCustomer({ customerName, customerEmail, user });

    if (!normalizedItems.length || !resolvedEmail) {
      return Response.json({ error: 'Cart items and email are required' }, { status: 400 });
    }

    const productsById = new Map();
    for (const item of normalizedItems) {
      productsById.set(item.productId, await base44.asServiceRole.entities.Product.get(item.productId));
    }

    const lineItemResult = buildCheckoutLineItems(normalizedItems, (productId) => productsById.get(productId));
    if (!lineItemResult.ok) {
      return Response.json({ error: lineItemResult.error }, { status: lineItemResult.status });
    }

    const { lineItems, stripeLineItems } = lineItemResult;
    const totalAud = calculateOrderTotalAud(lineItems);
    const origin = resolveCheckoutOrigin(
      req.headers.get('origin'),
      Deno.env.toObject().CHECKOUT_ALLOWED_ORIGINS,
      Deno.env.toObject().CHECKOUT_DEFAULT_ORIGIN || DEFAULT_CHECKOUT_ORIGIN
    );

    const order = await base44.asServiceRole.entities.StoreOrder.create({
      customer_name: resolvedName,
      customer_email: resolvedEmail,
      status: 'pending',
      total_aud: totalAud,
      line_items: lineItems,
      user_email: user?.email || '',
      user_id: user?.id || ''
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: resolvedEmail,
      success_url: `${origin}/store?success=true`,
      cancel_url: `${origin}/store?cancelled=true`,
      line_items: stripeLineItems,
      metadata: buildOrderMetadata({
        appId: Deno.env.get('BASE44_APP_ID'),
        orderId: order.id,
        totalAud,
      })
    });

    await base44.asServiceRole.entities.StoreOrder.update(order.id, { stripe_session_id: session.id });
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createCheckout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});