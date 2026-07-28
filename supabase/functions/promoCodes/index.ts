// Stripe-backed promotion-code management and public cart validation.
// Management actions require an RLT administrator; validation is read-only,
// rate-limited, and always rechecked by createCheckout before payment.
import Stripe from 'npm:stripe@22.2.0';
import {
  getCaller,
  getStripeSecretKey,
  resolveClientIp,
  serviceClient,
  stripeMode,
} from './shared.ts';

const DEFAULT_ORIGIN = 'https://www.rugbyleaguetakeover.com';
const MAX_REQUEST_BYTES = 8_192;
const CURRENCY = 'aud';
const PROMO_RATE_LIMIT = 30;
const PROMO_RATE_WINDOW_SECONDS = 10 * 60;

const trim = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);
const normalizeCode = (value: unknown) => trim(value, 32).toUpperCase();
const validCode = (value: string) => /^[A-Z0-9][A-Z0-9-]{1,31}$/.test(value);
const isUuid = (value: unknown) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

const parseOrigin = (value: unknown) => {
  try {
    const url = new URL(String(value || ''));
    if (!['http:', 'https:', 'capacitor:', 'ionic:'].includes(url.protocol)) return '';
    return url.origin === 'null' ? `${url.protocol}//${url.host}` : url.origin;
  } catch {
    return '';
  }
};

function allowedOrigins() {
  return new Set([
    DEFAULT_ORIGIN,
    'https://rugbyleaguetakeover.com',
    'capacitor://localhost',
    'ionic://localhost',
    ...String(Deno.env.get('CHECKOUT_ALLOWED_ORIGINS') || '').split(',').map(parseOrigin).filter(Boolean),
  ]);
}

function isAllowed(req: Request) {
  const origin = req.headers.get('origin');
  return !origin || allowedOrigins().has(parseOrigin(origin));
}

function headers(req: Request) {
  const origin = parseOrigin(req.headers.get('origin'));
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin && allowedOrigins().has(origin) ? origin : DEFAULT_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
}

const json = (req: Request, data: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...headers(req), ...extraHeaders } });

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Supports both current Stripe promotion objects and legacy expanded coupon objects.
// deno-lint-ignore no-explicit-any
function couponIdFor(promotionCode: any) {
  const promotedCoupon = promotionCode?.promotion?.coupon;
  if (typeof promotedCoupon === 'string') return promotedCoupon;
  if (promotedCoupon?.id) return promotedCoupon.id;
  const legacyCoupon = promotionCode?.coupon;
  return typeof legacyCoupon === 'string' ? legacyCoupon : legacyCoupon?.id || '';
}

// deno-lint-ignore no-explicit-any
function calculateDiscountCents(coupon: any, subtotalCents: number) {
  if (Number(coupon?.amount_off) > 0) {
    return Math.min(subtotalCents, Math.round(Number(coupon.amount_off)));
  }
  if (Number(coupon?.percent_off) > 0) {
    return Math.min(subtotalCents, Math.round(subtotalCents * Number(coupon.percent_off) / 100));
  }
  return 0;
}

// deno-lint-ignore no-explicit-any
function availabilityError(promotionCode: any, coupon: any, subtotalCents: number) {
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
  const minimumCurrency = trim(
    promotionCode.restrictions?.minimum_amount_currency
      || (promotionCode.restrictions?.currency_options?.aud ? CURRENCY : ''),
    8,
  ).toLowerCase();
  if (minimum > 0 && minimumCurrency && minimumCurrency !== CURRENCY) {
    return 'This promo code is not available for AUD orders.';
  }
  if (minimum > subtotalCents) {
    return `Spend at least $${(minimum / 100).toFixed(2)} AUD on merchandise to use this code.`;
  }
  if (coupon?.amount_off && trim(coupon?.currency, 8).toLowerCase() !== CURRENCY) {
    return 'This promo code is not available for AUD orders.';
  }
  return '';
}

// deno-lint-ignore no-explicit-any
function safePromotion(promotionCode: any, coupon: any) {
  const minimumAmount = Number(
    promotionCode.restrictions?.currency_options?.aud?.minimum_amount
      ?? promotionCode.restrictions?.minimum_amount
      ?? 0,
  );
  return {
    id: promotionCode.id,
    code: promotionCode.code,
    active: Boolean(promotionCode.active && coupon?.valid !== false),
    created: promotionCode.created,
    expiresAt: promotionCode.expires_at || null,
    maxRedemptions: promotionCode.max_redemptions || null,
    timesRedeemed: Number(promotionCode.times_redeemed || 0),
    minimumSubtotalAud: minimumAmount > 0 ? minimumAmount / 100 : 0,
    discountType: Number(coupon?.amount_off) > 0 ? 'fixed' : 'percent',
    discountValue: Number(coupon?.amount_off) > 0
      ? Number(coupon.amount_off) / 100
      : Number(coupon?.percent_off || 0),
    livemode: Boolean(promotionCode.livemode),
  };
}

async function readInput(req: Request) {
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > MAX_REQUEST_BYTES) throw new Error('REQUEST_TOO_LARGE');
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return isAllowed(req)
      ? new Response(null, { status: 204, headers: headers(req) })
      : json(req, { error: 'Origin is not allowed.' }, 403);
  }
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed.' }, 405);
  if (!isAllowed(req)) return json(req, { error: 'Origin is not allowed.' }, 403);

  let input;
  try {
    input = await readInput(req);
  } catch (error) {
    return json(req, {
      error: (error as Error).message === 'REQUEST_TOO_LARGE'
        ? 'Promo-code request is too large.'
        : 'Invalid promo-code request.',
    }, (error as Error).message === 'REQUEST_TOO_LARGE' ? 413 : 400);
  }

  const action = trim(input?.action, 24);
  const svc = serviceClient();

  try {
    const stripe = new Stripe(getStripeSecretKey());

    if (action === 'validate') {
      const code = normalizeCode(input?.code);
      const subtotalCents = Math.round(Number(input?.subtotalAud) * 100);
      if (!validCode(code) || !Number.isInteger(subtotalCents) || subtotalCents <= 0 || subtotalCents > 5_000_000) {
        return json(req, { valid: false, error: 'Enter a valid promo code.' });
      }

      const clientIp = resolveClientIp(req);
      if (clientIp) {
        const { data: throttle, error: throttleError } = await svc.rpc('claim_checkout_attempt', {
          p_key_hash: await sha256(`promo|${clientIp}`),
          p_limit: PROMO_RATE_LIMIT,
          p_window_seconds: PROMO_RATE_WINDOW_SECONDS,
        }).single();
        if (throttleError) throw throttleError;
        if (!(throttle as { allowed?: boolean } | null)?.allowed) {
          const retryAfter = Math.max(1, Number((throttle as { retry_after_seconds?: number })?.retry_after_seconds || 600));
          return json(req, { valid: false, error: 'Too many promo-code attempts. Please wait and try again.' }, 429, {
            'Retry-After': String(retryAfter),
          });
        }
      }

      const matches = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
      const promotionCode = matches.data[0];
      if (!promotionCode) return json(req, { valid: false, error: 'That promo code is not valid.' });
      const couponId = couponIdFor(promotionCode);
      if (!couponId) return json(req, { valid: false, error: 'That promo code is not valid.' });
      const coupon = await stripe.coupons.retrieve(couponId);
      const unavailable = availabilityError(promotionCode, coupon, subtotalCents);
      if (unavailable) return json(req, { valid: false, error: unavailable });

      const discountCents = calculateDiscountCents(coupon, subtotalCents);
      if (discountCents <= 0) return json(req, { valid: false, error: 'That promo code has no available discount.' });
      return json(req, {
        valid: true,
        code: promotionCode.code,
        discountAud: discountCents / 100,
        merchandiseTotalAud: (subtotalCents - discountCents) / 100,
        description: Number((coupon as Stripe.Coupon).amount_off) > 0
          ? `$${(Number((coupon as Stripe.Coupon).amount_off) / 100).toFixed(2)} AUD off`
          : `${Number((coupon as Stripe.Coupon).percent_off || 0).toFixed(2).replace(/\.00$/, '')}% off`,
      });
    }

    const caller = await getCaller(req, svc);
    if (!caller || caller.role !== 'admin') {
      return json(req, { error: 'Administrator access required.' }, 403);
    }

    if (action === 'list') {
      const promotions = await stripe.promotionCodes.list({ limit: 100 });
      const couponIds = [...new Set(promotions.data.map(couponIdFor).filter(Boolean))];
      const couponEntries = await Promise.all(couponIds.map(async (id) => {
        try {
          return [id, await stripe.coupons.retrieve(id)] as const;
        } catch {
          return [id, null] as const;
        }
      }));
      const coupons = new Map(couponEntries);
      return json(req, {
        mode: stripeMode(),
        promotionCodes: promotions.data.map((promotion) =>
          safePromotion(promotion, coupons.get(couponIdFor(promotion)))),
      });
    }

    if (action === 'create') {
      const code = normalizeCode(input?.code);
      const discountType = trim(input?.discountType, 16);
      const discountValue = Number(input?.discountValue);
      const minimumSubtotalAud = Number(input?.minimumSubtotalAud || 0);
      const maxRedemptions = input?.maxRedemptions === '' || input?.maxRedemptions == null
        ? null
        : Number(input.maxRedemptions);
      const expiresAtMs = input?.expiresAt ? new Date(input.expiresAt).getTime() : 0;
      const requestId = isUuid(input?.requestId) ? String(input.requestId).toLowerCase() : '';

      if (!validCode(code)) {
        return json(req, { error: 'Codes must be 2–32 letters, numbers, or dashes.' }, 400);
      }
      if (!['percent', 'fixed'].includes(discountType)) {
        return json(req, { error: 'Choose a percentage or fixed AUD discount.' }, 400);
      }
      if (
        !Number.isFinite(discountValue)
        || discountValue <= 0
        || (discountType === 'percent' && discountValue > 100)
        || (discountType === 'fixed' && discountValue > 50_000)
      ) return json(req, { error: 'Enter a valid discount value.' }, 400);
      if (!Number.isFinite(minimumSubtotalAud) || minimumSubtotalAud < 0 || minimumSubtotalAud > 50_000) {
        return json(req, { error: 'Enter a valid minimum merchandise spend.' }, 400);
      }
      if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 1_000_000)) {
        return json(req, { error: 'Redemption limit must be a positive whole number.' }, 400);
      }
      if (expiresAtMs && (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now() + 5 * 60_000)) {
        return json(req, { error: 'Expiry must be at least five minutes in the future.' }, 400);
      }
      if (!requestId) return json(req, { error: 'A valid request ID is required.' }, 400);

      const existing = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
      if (existing.data.length) return json(req, { error: 'An active promo code already uses that code.' }, 409);

      const coupon = await stripe.coupons.create({
        duration: 'once',
        name: `RLT ${code}`,
        ...(discountType === 'fixed'
          ? { amount_off: Math.round(discountValue * 100), currency: CURRENCY }
          : { percent_off: Math.round(discountValue * 100) / 100 }),
        metadata: { rlt_managed: 'true', rlt_promo_code: code },
      }, { idempotencyKey: `rlt_promo_coupon_${requestId}` });

      try {
        const promotionCode = await stripe.promotionCodes.create({
          promotion: { type: 'coupon', coupon: coupon.id },
          code,
          active: true,
          ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
          ...(expiresAtMs ? { expires_at: Math.floor(expiresAtMs / 1000) } : {}),
          ...(minimumSubtotalAud > 0
            ? {
                restrictions: {
                  minimum_amount: Math.round(minimumSubtotalAud * 100),
                  minimum_amount_currency: CURRENCY,
                },
              }
            : {}),
          metadata: { rlt_managed: 'true' },
        }, { idempotencyKey: `rlt_promo_code_${requestId}` });
        return json(req, {
          mode: stripeMode(),
          promotionCode: safePromotion(promotionCode, coupon),
        }, 201);
      } catch (error) {
        await stripe.coupons.del(coupon.id).catch(() => undefined);
        throw error;
      }
    }

    if (action === 'deactivate') {
      const promotionCodeId = trim(input?.promotionCodeId, 128);
      if (!/^promo_[A-Za-z0-9]+$/.test(promotionCodeId)) {
        return json(req, { error: 'Invalid promotion code ID.' }, 400);
      }
      const promotionCode = await stripe.promotionCodes.update(promotionCodeId, { active: false });
      return json(req, { ok: true, promotionCodeId: promotionCode.id });
    }

    return json(req, { error: 'Unknown promo-code action.' }, 400);
  } catch (error) {
    console.error('promoCodes error:', error);
    const stripeError = error as { type?: string; code?: string };
    if (stripeError?.type?.startsWith('Stripe')) {
      return json(req, {
        error: stripeError.code === 'resource_missing'
          ? 'That promotion no longer exists in Stripe.'
          : 'Stripe could not complete the promo-code request. Check the details and try again.',
      }, 409);
    }
    return json(req, { error: 'Promo codes are temporarily unavailable. Please try again.' }, 500);
  }
});
