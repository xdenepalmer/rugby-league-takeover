// Stripe checkout session creation. The canonical, unit-tested copy of these
// rules lives in tests/checkout-rules.mjs — keep the two in sync when editing.
import Stripe from 'npm:stripe@22.2.0';
import { json, preflight, serviceClient, getCaller, isEmail } from './shared.ts';

const MAX_CHECKOUT_QUANTITY = 20;
const CHECKOUT_CURRENCY = 'aud';
const DEFAULT_CHECKOUT_ORIGIN = 'https://rugbyleaguetakeover.com';

const toTrimmedString = (value: unknown) => String(value ?? '').trim();

const toPositiveInteger = (value: unknown, fallback = 1) => {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const toMoneyCents = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number * 100);
};

// deno-lint-ignore no-explicit-any
const getTrackedStock = (product: any) => {
  const stock = Number(product?.stock_quantity);
  return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : null;
};

const parseOrigin = (value: unknown) => {
  try {
    return new URL(String(value || '')).origin;
  } catch {
    return '';
  }
};

// deno-lint-ignore no-explicit-any
function normalizeCheckoutItems(rawItems: any) {
  if (!Array.isArray(rawItems)) return [];

  const byCartKey = new Map();
  for (const item of rawItems) {
    const productId = toTrimmedString(item?.productId);
    if (!productId) continue;

    const size = toTrimmedString(item?.size).slice(0, 20);
    const key = `${productId}::${size}`;
    const quantity = Math.min(toPositiveInteger(item?.quantity), MAX_CHECKOUT_QUANTITY);
    const existing = byCartKey.get(key) || { productId, size, quantity: 0 };
    existing.quantity = Math.min(existing.quantity + quantity, MAX_CHECKOUT_QUANTITY);
    byCartKey.set(key, existing);
  }

  return [...byCartKey.values()];
}

// deno-lint-ignore no-explicit-any
function buildCheckoutLineItems(items: any[], getProduct: (id: string) => any) {
  const lineItems = [];
  const stripeLineItems = [];
  const requestedByProductId = new Map();
  for (const item of items) {
    requestedByProductId.set(item.productId, (requestedByProductId.get(item.productId) || 0) + item.quantity);
  }

  for (const item of items) {
    const product = getProduct(item.productId);
    if (!product || product.is_active === false) {
      return { ok: false as const, status: 404, error: `Product '${item.productId}' is not available` };
    }

    const unitAmount = toMoneyCents(product.price_aud);
    if (!unitAmount) {
      return { ok: false as const, status: 400, error: `Product '${item.productId}' has an invalid price` };
    }

    const stock = getTrackedStock(product);
    const requestedTotal = requestedByProductId.get(item.productId) || item.quantity;
    if (stock !== null && stock < requestedTotal) {
      return { ok: false as const, status: 409, error: `Not enough stock for product '${product.name || item.productId}'` };
    }

    const displayName = item.size ? `${product.name} — Size ${item.size}` : product.name;

    lineItems.push({
      product_id: product.id,
      name: product.name,
      size: item.size || '',
      quantity: item.quantity,
      price_aud: Number((unitAmount / 100).toFixed(2)),
    });

    stripeLineItems.push({
      quantity: item.quantity,
      price_data: {
        currency: CHECKOUT_CURRENCY,
        unit_amount: unitAmount,
        product_data: {
          name: displayName,
          description: product.description || undefined,
          images: product.image_url ? [product.image_url] : undefined,
        },
      },
    });
  }

  if (lineItems.length === 0) {
    return { ok: false as const, status: 400, error: 'No valid products in cart' };
  }

  return { ok: true as const, lineItems, stripeLineItems };
}

// deno-lint-ignore no-explicit-any
function calculateOrderTotalAud(lineItems: any[]) {
  const cents = lineItems.reduce((total, item) => total + Math.round(Number(item.price_aud || 0) * 100) * Number(item.quantity || 0), 0);
  return Number((cents / 100).toFixed(2));
}

function resolveCheckoutOrigin(originHeader: unknown, allowlistEnv: unknown, fallback = DEFAULT_CHECKOUT_ORIGIN) {
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

// deno-lint-ignore no-explicit-any
function resolveCheckoutCustomer({ customerName = '', customerEmail = '', user = null }: any = {}) {
  return {
    name: toTrimmedString(customerName || user?.full_name),
    email: toTrimmedString(customerEmail || user?.email),
  };
}

// deno-lint-ignore no-explicit-any
function buildOrderMetadata({ appId, orderId, totalAud }: any) {
  return {
    rlt_app_id: toTrimmedString(appId),
    order_id: toTrimmedString(orderId),
    expected_total_aud: Number(totalAud || 0).toFixed(2),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
    const { items, customerName = '', customerEmail = '' } = await req.json();
    const normalizedItems = normalizeCheckoutItems(items);

    const user = await getCaller(req, svc);
    const { name: resolvedName, email: resolvedEmail } = resolveCheckoutCustomer({ customerName, customerEmail, user });

    if (!normalizedItems.length || !isEmail(resolvedEmail)) {
      return json({ error: 'Cart items and a valid email are required' }, 400);
    }

    const productsById = new Map();
    const unavailableProductIds = [];
    for (const item of normalizedItems) {
      const { data: product } = await svc.from('products').select('*').eq('id', item.productId).maybeSingle();
      if (!product) {
        unavailableProductIds.push(item.productId);
      } else {
        productsById.set(item.productId, product);
      }
    }

    if (unavailableProductIds.length > 0) {
      return json({
        error: 'Some items in your cart are no longer available. Please review your cart.',
        unavailableProductIds,
      }, 409);
    }

    const lineItemResult = buildCheckoutLineItems(normalizedItems, (productId) => productsById.get(productId));
    if (!lineItemResult.ok) {
      return json({ error: lineItemResult.error }, lineItemResult.status);
    }

    const { lineItems, stripeLineItems } = lineItemResult;
    const totalAud = calculateOrderTotalAud(lineItems);
    const origin = resolveCheckoutOrigin(
      req.headers.get('origin'),
      Deno.env.get('CHECKOUT_ALLOWED_ORIGINS'),
      Deno.env.get('CHECKOUT_DEFAULT_ORIGIN') || DEFAULT_CHECKOUT_ORIGIN
    );

    const { data: order, error: orderError } = await svc
      .from('store_orders')
      .insert({
        customer_name: resolvedName,
        customer_email: resolvedEmail,
        status: 'pending',
        total_aud: totalAud,
        line_items: lineItems,
        user_email: user?.email || '',
        user_id: user?.id || '',
      })
      .select('id')
      .single();
    if (orderError) throw orderError;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: resolvedEmail,
      success_url: `${origin}/store?success=true`,
      cancel_url: `${origin}/store?cancelled=true`,
      line_items: stripeLineItems,
      phone_number_collection: { enabled: true },
      shipping_address_collection: { allowed_countries: ['AU', 'NZ', 'US'] },
      metadata: buildOrderMetadata({
        appId: Deno.env.get('RLT_APP_ID') || 'rugby-league-takeover',
        orderId: order.id,
        totalAud,
      }),
    });

    await svc.from('store_orders').update({ stripe_session_id: session.id }).eq('id', order.id);
    return json({ url: session.url });
  } catch (error) {
    console.error('createCheckout error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
