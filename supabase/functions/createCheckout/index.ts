// Creates a Stripe-hosted Checkout Session from authoritative product data.
// Client prices, totals, stock, shipping and redirect URLs are never trusted.
import Stripe from 'npm:stripe@22.2.0';
import {
  getCaller,
  getStripeSecretKey,
  isEmail,
  resolveClientIp,
  serviceClient,
} from './shared.ts';

const MAX_CHECKOUT_QUANTITY = 20;
const MAX_CHECKOUT_LINE_ITEMS = 20;
const MAX_REQUEST_BYTES = 16_384;
const CHECKOUT_CURRENCY = 'aud';
const DEFAULT_CHECKOUT_ORIGIN = 'https://www.rugbyleaguetakeover.com';
const FLAT_DOMESTIC_SHIPPING_AUD = 15;
const FREE_DOMESTIC_SHIPPING_THRESHOLD_AUD = 150;
const MAX_ORDER_TOTAL_AUD = 50_000;
const CHECKOUT_SESSION_SECONDS = 30 * 60;
const CHECKOUT_RATE_LIMIT = 8;
const CHECKOUT_RATE_WINDOW_SECONDS = 10 * 60;

const toTrimmedString = (value: unknown, maxLength = 10_000) =>
  String(value ?? '').trim().slice(0, maxLength);

const toStrictPositiveInteger = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const toMoneyCents = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number * 100);
};

const isUuid = (value: unknown) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

const normalizePromoCode = (value: unknown) => toTrimmedString(value, 32).toUpperCase();
const isValidPromoCode = (value: string) => /^[A-Z0-9][A-Z0-9-]{1,31}$/.test(value);

const getTrackedStock = (product: Record<string, unknown> | null | undefined) => {
  const stock = Number(product?.stock_quantity);
  return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : null;
};

const parseOrigin = (value: unknown, { httpOnly = false } = {}) => {
  try {
    const url = new URL(String(value || ''));
    if (httpOnly && !['http:', 'https:'].includes(url.protocol)) return '';
    if (!['http:', 'https:', 'capacitor:', 'ionic:'].includes(url.protocol)) return '';
    return url.origin === 'null' ? `${url.protocol}//${url.host}` : url.origin;
  } catch {
    return '';
  }
};

function allowedOrigins() {
  const configured = String(Deno.env.get('CHECKOUT_ALLOWED_ORIGINS') || '')
    .split(',')
    .map((value) => parseOrigin(value))
    .filter(Boolean);
  return new Set([
    DEFAULT_CHECKOUT_ORIGIN,
    'https://rugbyleaguetakeover.com',
    'capacitor://localhost',
    'ionic://localhost',
    ...configured,
  ]);
}

function isAllowedRequestOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return true; // native/server-to-server calls do not always send Origin
  const parsed = parseOrigin(origin);
  return Boolean(parsed && allowedOrigins().has(parsed));
}

function corsHeaders(req: Request) {
  const origin = parseOrigin(req.headers.get('origin'));
  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins().has(origin) ? origin : DEFAULT_CHECKOUT_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
}

const responseJson = (req: Request, data: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(req),
      ...extraHeaders,
    },
  });

async function readJsonBody(req: Request) {
  const declaredLength = Number(req.headers.get('content-length') || 0);
  if (declaredLength > MAX_REQUEST_BYTES) throw new Error('REQUEST_TOO_LARGE');
  const raw = await req.text();
  if (!raw || new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
    throw new Error(raw ? 'REQUEST_TOO_LARGE' : 'INVALID_JSON');
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('INVALID_JSON');
  }
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// deno-lint-ignore no-explicit-any
function normalizeSizeVariants(rawVariants: any) {
  if (!Array.isArray(rawVariants)) return [];
  const seen = new Set<string>();
  const variants = [];
  for (const raw of rawVariants) {
    const size = toTrimmedString(typeof raw === 'string' ? raw : raw?.size, 20);
    const key = size.toLowerCase();
    if (!size || seen.has(key)) continue;
    seen.add(key);
    const stock = Number(typeof raw === 'string' ? 0 : raw?.stock_quantity);
    variants.push({
      size,
      stock_quantity: Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0,
    });
  }
  return variants;
}

// deno-lint-ignore no-explicit-any
function normalizeCheckoutItems(rawItems: any) {
  if (!Array.isArray(rawItems) || rawItems.length > MAX_CHECKOUT_LINE_ITEMS * 2) return [];

  const byCartKey = new Map<string, { productId: string; size: string; quantity: number }>();
  for (const item of rawItems) {
    const productId = toTrimmedString(item?.productId, 128);
    const quantity = toStrictPositiveInteger(item?.quantity);
    if (!productId || !quantity) continue;

    const size = toTrimmedString(item?.size, 20);
    const key = `${productId}::${size.toLowerCase()}`;
    const existing = byCartKey.get(key) || { productId, size, quantity: 0 };
    existing.quantity = Math.min(existing.quantity + quantity, MAX_CHECKOUT_QUANTITY);
    byCartKey.set(key, existing);
    if (byCartKey.size > MAX_CHECKOUT_LINE_ITEMS) return [];
  }
  return [...byCartKey.values()];
}

// deno-lint-ignore no-explicit-any
function buildCheckoutLineItems(items: any[], getProduct: (id: string) => any) {
  const lineItems = [];
  const stripeLineItems = [];
  const requestedByProductId = new Map<string, number>();
  for (const item of items) {
    requestedByProductId.set(item.productId, (requestedByProductId.get(item.productId) || 0) + item.quantity);
  }

  for (const item of items) {
    const product = getProduct(item.productId);
    if (!product || product.is_active === false || product.coming_soon === true) {
      return { ok: false as const, status: 409, error: 'An item in your cart is no longer available.' };
    }

    const unitAmount = toMoneyCents(product.price_aud);
    if (!unitAmount) {
      return { ok: false as const, status: 409, error: 'An item in your cart cannot be purchased right now.' };
    }

    const stock = getTrackedStock(product);
    const requestedTotal = requestedByProductId.get(item.productId) || item.quantity;
    if (stock !== null && stock < requestedTotal) {
      return { ok: false as const, status: 409, error: `Not enough stock for ${toTrimmedString(product.name, 120) || 'an item'}.` };
    }

    const variants = normalizeSizeVariants(product.sizes);
    let canonicalSize = '';
    if (variants.length > 0) {
      const variant = variants.find((entry) => entry.size.toLowerCase() === item.size.toLowerCase());
      if (!item.size || !variant) {
        return { ok: false as const, status: 409, error: `Please select an available size for ${toTrimmedString(product.name, 120)}.` };
      }
      if (variant.stock_quantity < item.quantity) {
        return { ok: false as const, status: 409, error: `Not enough stock for ${toTrimmedString(product.name, 120)} in size ${variant.size}.` };
      }
      canonicalSize = variant.size;
    } else if (item.size) {
      return { ok: false as const, status: 409, error: `${toTrimmedString(product.name, 120)} does not use size options.` };
    }

    const productName = toTrimmedString(product.name, 120);
    const displayName = canonicalSize ? `${productName} — Size ${canonicalSize}` : productName;
    const imageUrl = (() => {
      try {
        const url = new URL(String(product.image_url || ''));
        return url.protocol === 'https:' ? url.toString() : undefined;
      } catch {
        return undefined;
      }
    })();

    lineItems.push({
      product_id: product.id,
      name: productName,
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
          name: displayName,
          description: toTrimmedString(product.description, 500) || undefined,
          images: imageUrl ? [imageUrl] : undefined,
        },
      },
    });
  }

  if (lineItems.length === 0) {
    return { ok: false as const, status: 400, error: 'Your cart is empty.' };
  }
  return { ok: true as const, lineItems, stripeLineItems };
}

// deno-lint-ignore no-explicit-any
function calculateOrderTotalAud(lineItems: any[], shippingCostAud = 0) {
  const cents = lineItems.reduce(
    (total, item) => total + Math.round(Number(item.price_aud || 0) * 100) * Number(item.quantity || 0),
    0,
  );
  return Number(((cents + Math.round(Number(shippingCostAud || 0) * 100)) / 100).toFixed(2));
}

function buildDomesticShipping(subtotalAud: number) {
  const price = subtotalAud >= FREE_DOMESTIC_SHIPPING_THRESHOLD_AUD ? 0 : FLAT_DOMESTIC_SHIPPING_AUD;
  const unitAmount = Math.round(price * 100);
  return {
    code: 'DOMESTIC_STANDARD',
    name: 'Standard shipping (4–7 business days)',
    price_aud: Number((unitAmount / 100).toFixed(2)),
    stripeShippingOption: {
      shipping_rate_data: {
        type: 'fixed_amount' as const,
        display_name: unitAmount > 0 ? 'Standard delivery (Australia)' : 'Free standard delivery (Australia)',
        fixed_amount: {
          amount: unitAmount,
          currency: CHECKOUT_CURRENCY,
        },
        delivery_estimate: {
          minimum: { unit: 'business_day' as const, value: 4 },
          maximum: { unit: 'business_day' as const, value: 7 },
        },
        metadata: { rlt_shipping_code: 'DOMESTIC_STANDARD' },
      },
    },
  };
}

// Supports both Stripe's current promotion object and legacy expanded coupon responses.
// deno-lint-ignore no-explicit-any
function promotionCouponId(promotionCode: any) {
  const promotedCoupon = promotionCode?.promotion?.coupon;
  if (typeof promotedCoupon === 'string') return promotedCoupon;
  if (promotedCoupon?.id) return promotedCoupon.id;
  const legacyCoupon = promotionCode?.coupon;
  return typeof legacyCoupon === 'string' ? legacyCoupon : legacyCoupon?.id || '';
}

// deno-lint-ignore no-explicit-any
function calculatePromoDiscountCents(coupon: any, merchandiseSubtotalCents: number) {
  if (Number(coupon?.amount_off) > 0) {
    return Math.min(merchandiseSubtotalCents, Math.round(Number(coupon.amount_off)));
  }
  if (Number(coupon?.percent_off) > 0) {
    return Math.min(
      merchandiseSubtotalCents,
      Math.round(merchandiseSubtotalCents * Number(coupon.percent_off) / 100),
    );
  }
  return 0;
}

// deno-lint-ignore no-explicit-any
function promoAvailabilityError(promotionCode: any, coupon: any, merchandiseSubtotalCents: number) {
  const now = Math.floor(Date.now() / 1000);
  if (!promotionCode?.active || coupon?.valid === false) return 'This promo code is no longer active.';
  if (promotionCode.expires_at && Number(promotionCode.expires_at) <= now) return 'This promo code has expired.';
  if (
    promotionCode.max_redemptions
    && Number(promotionCode.times_redeemed || 0) >= Number(promotionCode.max_redemptions)
  ) return 'This promo code has reached its redemption limit.';

  const minimum = Number(
    promotionCode.restrictions?.currency_options?.aud?.minimum_amount
      ?? promotionCode.restrictions?.minimum_amount
      ?? 0,
  );
  const minimumCurrency = toTrimmedString(
    promotionCode.restrictions?.minimum_amount_currency
      || (promotionCode.restrictions?.currency_options?.aud ? CHECKOUT_CURRENCY : ''),
    8,
  ).toLowerCase();
  if (minimum > 0 && minimumCurrency && minimumCurrency !== CHECKOUT_CURRENCY) {
    return 'This promo code is not available for AUD orders.';
  }
  if (minimum > merchandiseSubtotalCents) {
    return `Spend at least $${(minimum / 100).toFixed(2)} AUD on merchandise to use this code.`;
  }
  if (coupon?.amount_off && toTrimmedString(coupon?.currency, 8).toLowerCase() !== CHECKOUT_CURRENCY) {
    return 'This promo code is not available for AUD orders.';
  }
  return '';
}

// deno-lint-ignore no-explicit-any
async function resolvePromotion(stripe: Stripe, rawCode: unknown, merchandiseSubtotalCents: number) {
  const code = normalizePromoCode(rawCode);
  if (!code) return { code: '', promotionCodeId: '', discountCents: 0 };
  if (!isValidPromoCode(code)) {
    return { error: 'Enter a valid promo code.' };
  }

  const matches = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
  const promotionCode = matches.data[0];
  if (!promotionCode) return { error: 'That promo code is not valid.' };
  const couponId = promotionCouponId(promotionCode);
  if (!couponId) return { error: 'That promo code is not valid.' };
  const coupon = await stripe.coupons.retrieve(couponId);
  const unavailable = promoAvailabilityError(promotionCode, coupon, merchandiseSubtotalCents);
  if (unavailable) return { error: unavailable };

  const discountCents = calculatePromoDiscountCents(coupon, merchandiseSubtotalCents);
  if (discountCents <= 0) return { error: 'That promo code has no available discount.' };
  return {
    code: promotionCode.code || code,
    promotionCodeId: promotionCode.id,
    discountCents,
  };
}

function resolveCheckoutOrigin(originHeader: unknown) {
  const fallback = parseOrigin(Deno.env.get('CHECKOUT_DEFAULT_ORIGIN') || DEFAULT_CHECKOUT_ORIGIN, { httpOnly: true })
    || DEFAULT_CHECKOUT_ORIGIN;
  const requested = parseOrigin(originHeader, { httpOnly: true });
  return requested && allowedOrigins().has(requested) ? requested : fallback;
}

function buildOrderMetadata(orderId: string, totalAud: number, checkoutRequestId: string, promoCode = '') {
  return {
    rlt_app_id: toTrimmedString(Deno.env.get('RLT_APP_ID') || 'rugby-league-takeover', 40),
    order_id: orderId,
    checkout_request_id: checkoutRequestId,
    expected_total_aud: totalAud.toFixed(2),
    promo_code: promoCode,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return isAllowedRequestOrigin(req)
      ? new Response(null, { status: 204, headers: corsHeaders(req) })
      : responseJson(req, { error: 'Origin is not allowed.' }, 403);
  }
  if (req.method !== 'POST') {
    return responseJson(req, { error: 'Method not allowed.' }, 405, { Allow: 'POST, OPTIONS' });
  }
  if (!isAllowedRequestOrigin(req)) {
    return responseJson(req, { error: 'Origin is not allowed.' }, 403);
  }

  let input;
  try {
    input = await readJsonBody(req);
  } catch (error) {
    const code = (error as Error).message;
    return responseJson(req, {
      error: code === 'REQUEST_TOO_LARGE' ? 'Checkout request is too large.' : 'Invalid checkout request.',
    }, code === 'REQUEST_TOO_LARGE' ? 413 : 400);
  }

  const normalizedItems = normalizeCheckoutItems(input?.items);
  const svc = serviceClient();
  const user = await getCaller(req, svc);
  const resolvedName = toTrimmedString(input?.customerName || user?.full_name, 120);
  const resolvedEmail = toTrimmedString(input?.customerEmail || user?.email, 254).toLowerCase();
  const checkoutRequestId = isUuid(input?.checkoutRequestId) ? String(input.checkoutRequestId).toLowerCase() : '';

  if (!normalizedItems.length) {
    return responseJson(req, { error: 'Your cart contains invalid or too many items.' }, 400);
  }
  if (resolvedName.length < 2) {
    return responseJson(req, { error: 'Please enter your full name.' }, 400);
  }
  if (!isEmail(resolvedEmail) || !checkoutRequestId) {
    return responseJson(req, { error: 'A valid email and checkout request are required.' }, 400);
  }

  try {
    const clientIp = resolveClientIp(req);
    const throttleClaims = [
      { value: `email|${resolvedEmail}`, limit: CHECKOUT_RATE_LIMIT },
      ...(clientIp ? [{ value: `ip|${clientIp}`, limit: 20 }] : []),
    ];
    for (const claim of throttleClaims) {
      const { data: throttleData, error: throttleError } = await svc
        .rpc('claim_checkout_attempt', {
          p_key_hash: await sha256(claim.value),
          p_limit: claim.limit,
          p_window_seconds: CHECKOUT_RATE_WINDOW_SECONDS,
        })
        .single();
      if (throttleError) throw throttleError;
      const throttle = throttleData as { allowed?: boolean; retry_after_seconds?: number } | null;
      if (!throttle?.allowed) {
        const retryAfter = Math.max(1, Number(throttle?.retry_after_seconds || CHECKOUT_RATE_WINDOW_SECONDS));
        return responseJson(
          req,
          { error: 'Too many checkout attempts. Please wait a few minutes and try again.', retryAfter },
          429,
          { 'Retry-After': String(retryAfter) },
        );
      }
    }

    const productIds = [...new Set(normalizedItems.map((item) => item.productId))];
    const { data: products, error: productsError } = await svc
      .from('products')
      .select('*')
      .in('id', productIds);
    if (productsError) throw productsError;

    const productsById = new Map((products || []).map((product) => [product.id, product]));
    const unavailableProductIds = productIds.filter((id) => !productsById.has(id));
    if (unavailableProductIds.length > 0) {
      return responseJson(req, {
        error: 'Some items in your cart are no longer available. Please review your cart.',
        unavailableProductIds,
      }, 409);
    }

    const lineItemResult = buildCheckoutLineItems(normalizedItems, (productId) => productsById.get(productId));
    if (!lineItemResult.ok) {
      return responseJson(req, { error: lineItemResult.error }, lineItemResult.status);
    }

    const { lineItems, stripeLineItems } = lineItemResult;
    const merchandiseSubtotalAud = calculateOrderTotalAud(lineItems);
    const shippingSelection = buildDomesticShipping(merchandiseSubtotalAud);
    const merchandiseSubtotalCents = Math.round(merchandiseSubtotalAud * 100);
    const stripe = new Stripe(getStripeSecretKey());
    const promotion = await resolvePromotion(stripe, input?.promoCode, merchandiseSubtotalCents);
    if ('error' in promotion) {
      return responseJson(req, { error: promotion.error, promoCodeInvalid: true }, 400);
    }
    const discountAmountAud = Number((promotion.discountCents / 100).toFixed(2));
    const totalAud = Number((
      merchandiseSubtotalAud - discountAmountAud + shippingSelection.price_aud
    ).toFixed(2));
    if (promotion.promotionCodeId && totalAud < 0.5) {
      return responseJson(req, {
        error: 'This promo code would reduce the order below Stripe’s minimum checkout amount.',
        promoCodeInvalid: true,
      }, 400);
    }
    if (totalAud <= 0 || totalAud > MAX_ORDER_TOTAL_AUD) {
      return responseJson(req, { error: 'The cart total is outside the supported checkout range.' }, 400);
    }

    const origin = resolveCheckoutOrigin(req.headers.get('origin'));
    const expiresAt = Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_SECONDS;

    const { data: existingOrder, error: existingError } = await svc
      .from('store_orders')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .maybeSingle();
    if (existingError) throw existingError;

    let order = existingOrder;
    if (order) {
      const sameRequest = order.customer_email === resolvedEmail
        && Number(order.merchandise_subtotal_aud) === merchandiseSubtotalAud
        && String(order.promo_code || '') === String(promotion.code || '')
        && JSON.stringify(order.line_items || []) === JSON.stringify(lineItems);
      if (!sameRequest || order.status !== 'pending') {
        return responseJson(req, { error: 'This checkout request has already been used. Please try again.' }, 409);
      }
      if (order.stripe_session_id) {
        const existingSession = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
        if (existingSession.status === 'open' && existingSession.url) {
          return responseJson(req, {
            url: existingSession.url,
            sessionId: existingSession.id,
            expiresAt: existingSession.expires_at,
            reused: true,
          });
        }
        return responseJson(req, { error: 'This checkout session is no longer available. Please try again.' }, 409);
      }
    } else {
      const orderId = crypto.randomUUID();
      const { data: createdOrder, error: orderError } = await svc
        .from('store_orders')
        .insert({
          id: orderId,
          checkout_request_id: checkoutRequestId,
          checkout_expires_at: new Date(expiresAt * 1000).toISOString(),
          customer_name: resolvedName,
          customer_email: resolvedEmail,
          status: 'pending',
          total_aud: totalAud,
          merchandise_subtotal_aud: merchandiseSubtotalAud,
          discount_amount_aud: discountAmountAud,
          promo_code: promotion.code || null,
          stripe_promotion_code_id: promotion.promotionCodeId || null,
          line_items: lineItems,
          user_email: user?.email || resolvedEmail,
          user_id: user?.id || null,
          shipping_service_code: shippingSelection.code,
          shipping_service_name: shippingSelection.name,
          shipping_cost_aud: shippingSelection.price_aud,
          customer_status_note: 'Awaiting secure payment through Stripe.',
          timeline: [{
            action: 'checkout_started',
            timestamp: new Date().toISOString(),
            note: 'Stripe Checkout session requested',
            actor: 'system',
          }],
        })
        .select('*')
        .single();
      if (orderError) throw orderError;
      order = createdOrder;
    }

    const metadata = buildOrderMetadata(order.id, totalAud, checkoutRequestId, promotion.code);

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        client_reference_id: order.id,
        customer_email: resolvedEmail,
        success_url: `${origin}/store?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/store?checkout=cancelled`,
        expires_at: expiresAt,
        line_items: stripeLineItems,
        shipping_options: [shippingSelection.stripeShippingOption],
        ...(promotion.promotionCodeId
          ? { discounts: [{ promotion_code: promotion.promotionCodeId }] }
          : {}),
        phone_number_collection: { enabled: true },
        shipping_address_collection: { allowed_countries: ['AU'] },
        metadata,
        payment_intent_data: { metadata },
      }, {
        idempotencyKey: `rlt_checkout_${checkoutRequestId}`,
      });

      if (!session.url) throw new Error('Stripe did not return a checkout URL');
      const authoritativeTotalAud = Number((Number(session.amount_total ?? Math.round(totalAud * 100)) / 100).toFixed(2));
      const authoritativeDiscountAud = Number((
        Number(session.total_details?.amount_discount ?? promotion.discountCents) / 100
      ).toFixed(2));
      const authoritativeShippingAud = Number((
        Number(session.total_details?.amount_shipping ?? Math.round(shippingSelection.price_aud * 100)) / 100
      ).toFixed(2));
      if (authoritativeTotalAud <= 0 || authoritativeTotalAud > MAX_ORDER_TOTAL_AUD) {
        await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
        throw new Error('Stripe returned an invalid checkout total');
      }

      const { error: sessionUpdateError } = await svc
        .from('store_orders')
        .update({
          stripe_session_id: session.id,
          checkout_expires_at: new Date(session.expires_at * 1000).toISOString(),
          total_aud: authoritativeTotalAud,
          discount_amount_aud: authoritativeDiscountAud,
          shipping_cost_aud: authoritativeShippingAud,
        })
        .eq('id', order.id)
        .eq('status', 'pending');
      if (sessionUpdateError) {
        await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
        throw sessionUpdateError;
      }

      return responseJson(req, {
        url: session.url,
        sessionId: session.id,
        expiresAt: session.expires_at,
      });
    } catch (error) {
      console.error('createCheckout Stripe session error:', error);
      await svc.from('store_orders').update({
        status: 'cancelled',
        customer_status_note: 'Checkout could not be started. No payment was taken.',
        timeline: [
          ...(Array.isArray(order.timeline) ? order.timeline : []),
          {
            action: 'checkout_failed',
            timestamp: new Date().toISOString(),
            note: 'Stripe Checkout session could not be created',
            actor: 'system',
          },
        ],
      }).eq('id', order.id).eq('status', 'pending');
      return responseJson(req, { error: 'Unable to start secure checkout. Please try again.' }, 503);
    }
  } catch (error) {
    console.error('createCheckout error:', error);
    return responseJson(req, { error: 'Checkout is temporarily unavailable. Please try again.' }, 500);
  }
});
