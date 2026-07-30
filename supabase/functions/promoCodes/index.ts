// Stripe-backed promotion-code management and public cart validation.
// Management actions require an RLT administrator; checkout revalidates every
// code before creating a payment session.
import Stripe from 'npm:stripe@22.2.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const DEFAULT_ORIGIN = 'https://www.rugbyleaguetakeover.com';
const CURRENCY = 'aud';
const MAX_REQUEST_BYTES = 8_192;
const trim = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);
const normalizeCode = (value: unknown) => trim(value, 32).toUpperCase();
const validCode = (value: string) => /^[A-Z0-9][A-Z0-9-]{1,31}$/.test(value);
const isUuid = (value: unknown) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

const serviceClient = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);
const stripeMode = () => Deno.env.get('STRIPE_MODE') === 'test' ? 'test' : 'live';
const stripeKey = () => {
  const mode = stripeMode();
  const key = mode === 'test'
    ? Deno.env.get('STRIPE_SECRET_KEY_TEST')
    : Deno.env.get('STRIPE_SECRET_KEY_LIVE') || Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('Stripe is not configured');
  return key;
};
const clientIp = (req: Request) =>
  (req.headers.get('x-forwarded-for')?.split(',')[0]
    || req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || '').trim();

// deno-lint-ignore no-explicit-any
async function caller(req: Request, svc: any) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: profile } = await svc.from('profiles').select('*').eq('auth_user_id', data.user.id).maybeSingle();
  return profile && !profile.disabled ? profile : null;
}

const parseOrigin = (value: unknown) => {
  try {
    const url = new URL(String(value || ''));
    if (!['http:', 'https:', 'capacitor:', 'ionic:'].includes(url.protocol)) return '';
    return url.origin === 'null' ? `${url.protocol}//${url.host}` : url.origin;
  } catch {
    return '';
  }
};
const isRltPreview = (origin: string) => {
  try {
    const url = new URL(origin);
    return url.protocol === 'https:'
      && url.hostname.startsWith('rugby-league-takeover-')
      && url.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
};
const configuredOrigins = () => new Set([
  DEFAULT_ORIGIN,
  'https://rugbyleaguetakeover.com',
  'capacitor://localhost',
  'ionic://localhost',
  ...String(Deno.env.get('CHECKOUT_ALLOWED_ORIGINS') || '').split(',').map(parseOrigin).filter(Boolean),
]);
const allowedOrigin = (origin: string) => Boolean(origin && (configuredOrigins().has(origin) || isRltPreview(origin)));
const isAllowed = (req: Request) => !req.headers.get('origin') || allowedOrigin(parseOrigin(req.headers.get('origin')));
const headers = (req: Request) => {
  const origin = parseOrigin(req.headers.get('origin'));
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin(origin) ? origin : DEFAULT_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
};
const json = (req: Request, data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...headers(req), ...extra } });
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

// deno-lint-ignore no-explicit-any
function couponIdFor(promotion: any) {
  const current = promotion?.promotion?.coupon;
  if (typeof current === 'string') return current;
  if (current?.id) return current.id;
  const legacy = promotion?.coupon;
  return typeof legacy === 'string' ? legacy : legacy?.id || '';
}
// deno-lint-ignore no-explicit-any
const discountCents = (coupon: any, subtotal: number) => Number(coupon?.amount_off) > 0
  ? Math.min(subtotal, Math.round(Number(coupon.amount_off)))
  : Math.min(subtotal, Math.round(subtotal * Number(coupon?.percent_off || 0) / 100));
// deno-lint-ignore no-explicit-any
function availabilityError(promotion: any, coupon: any, subtotal: number) {
  const now = Math.floor(Date.now() / 1000);
  if (!promotion?.active || coupon?.valid === false) return 'This promo code is no longer active.';
  if (promotion.expires_at && Number(promotion.expires_at) <= now) return 'This promo code has expired.';
  if (promotion.max_redemptions && Number(promotion.times_redeemed || 0) >= Number(promotion.max_redemptions)) {
    return 'This promo code has reached its redemption limit.';
  }
  const minimum = Number(promotion.restrictions?.currency_options?.aud?.minimum_amount
    ?? promotion.restrictions?.minimum_amount ?? 0);
  if (minimum > subtotal) return `Spend at least $${(minimum / 100).toFixed(2)} AUD on merchandise to use this code.`;
  if (coupon?.amount_off && trim(coupon.currency, 8).toLowerCase() !== CURRENCY) {
    return 'This promo code is not available for AUD orders.';
  }
  return '';
}
// deno-lint-ignore no-explicit-any
function safePromotion(promotion: any, coupon: any) {
  const minimum = Number(promotion.restrictions?.currency_options?.aud?.minimum_amount
    ?? promotion.restrictions?.minimum_amount ?? 0);
  return {
    id: promotion.id,
    code: promotion.code,
    active: Boolean(promotion.active && coupon?.valid !== false),
    created: promotion.created,
    expiresAt: promotion.expires_at || null,
    maxRedemptions: promotion.max_redemptions || null,
    timesRedeemed: Number(promotion.times_redeemed || 0),
    minimumSubtotalAud: minimum / 100,
    discountType: Number(coupon?.amount_off) > 0 ? 'fixed' : 'percent',
    discountValue: Number(coupon?.amount_off) > 0
      ? Number(coupon.amount_off) / 100
      : Number(coupon?.percent_off || 0),
    livemode: Boolean(promotion.livemode),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return isAllowed(req) ? new Response(null, { status: 204, headers: headers(req) }) : json(req, { error: 'Origin is not allowed.' }, 403);
  }
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed.' }, 405);
  if (!isAllowed(req)) return json(req, { error: 'Origin is not allowed.' }, 403);

  let input;
  try {
    const raw = await req.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) throw new Error('INVALID_BODY');
    input = JSON.parse(raw);
  } catch {
    return json(req, { error: 'Invalid promo-code request.' }, 400);
  }

  const action = trim(input?.action, 24);
  const svc = serviceClient();
  try {
    const stripe = new Stripe(stripeKey());
    if (action === 'validate') {
      const code = normalizeCode(input?.code);
      const subtotal = Math.round(Number(input?.subtotalAud) * 100);
      if (!validCode(code) || !Number.isInteger(subtotal) || subtotal <= 0 || subtotal > 5_000_000) {
        return json(req, { valid: false, error: 'Enter a valid promo code.' });
      }
      const ip = clientIp(req);
      if (ip) {
        const { data: throttle, error } = await svc.rpc('claim_checkout_attempt', {
          p_key_hash: await sha256(`promo|${ip}`),
          p_limit: 30,
          p_window_seconds: 600,
        }).single();
        if (error) throw error;
        const claim = throttle as { allowed?: boolean; retry_after_seconds?: number } | null;
        if (!claim?.allowed) {
          const retryAfter = Math.max(1, Number(claim?.retry_after_seconds || 600));
          return json(req, { valid: false, error: 'Too many promo-code attempts. Please wait and try again.' }, 429, { 'Retry-After': String(retryAfter) });
        }
      }
      const promotion = (await stripe.promotionCodes.list({ code, active: true, limit: 1 })).data[0];
      const couponId = couponIdFor(promotion);
      if (!promotion || !couponId) return json(req, { valid: false, error: 'That promo code is not valid.' });
      const coupon = await stripe.coupons.retrieve(couponId);
      const unavailable = availabilityError(promotion, coupon, subtotal);
      if (unavailable) return json(req, { valid: false, error: unavailable });
      const discount = discountCents(coupon, subtotal);
      if (discount <= 0) return json(req, { valid: false, error: 'That promo code has no available discount.' });
      return json(req, {
        valid: true,
        code: promotion.code,
        discountAud: discount / 100,
        merchandiseTotalAud: (subtotal - discount) / 100,
        description: Number((coupon as Stripe.Coupon).amount_off) > 0
          ? `$${(Number((coupon as Stripe.Coupon).amount_off) / 100).toFixed(2)} AUD off`
          : `${Number((coupon as Stripe.Coupon).percent_off || 0).toFixed(2).replace(/\.00$/, '')}% off`,
      });
    }

    const me = await caller(req, svc);
    if (!me || me.role !== 'admin') return json(req, { error: 'Administrator access required.' }, 403);

    if (action === 'list') {
      const promotions = await stripe.promotionCodes.list({ limit: 100 });
      const ids = [...new Set(promotions.data.map(couponIdFor).filter(Boolean))];
      const coupons = new Map(await Promise.all(ids.map(async (id) => {
        try { return [id, await stripe.coupons.retrieve(id)] as const; } catch { return [id, null] as const; }
      })));
      return json(req, {
        mode: stripeMode(),
        promotionCodes: promotions.data.map((promotion) => safePromotion(promotion, coupons.get(couponIdFor(promotion)))),
      });
    }

    if (action === 'create') {
      const code = normalizeCode(input?.code);
      const type = trim(input?.discountType, 16);
      const value = Number(input?.discountValue);
      const minimum = Number(input?.minimumSubtotalAud || 0);
      const maxUses = input?.maxRedemptions == null || input.maxRedemptions === '' ? null : Number(input.maxRedemptions);
      const expiresMs = input?.expiresAt ? new Date(input.expiresAt).getTime() : 0;
      const requestId = isUuid(input?.requestId) ? String(input.requestId).toLowerCase() : '';
      if (!validCode(code)) return json(req, { error: 'Codes must be 2–32 letters, numbers, or dashes.' }, 400);
      if (!['percent', 'fixed'].includes(type)) return json(req, { error: 'Choose a percentage or fixed AUD discount.' }, 400);
      if (!Number.isFinite(value) || value <= 0 || (type === 'percent' && value > 100) || (type === 'fixed' && value > 50_000)) {
        return json(req, { error: 'Enter a valid discount value.' }, 400);
      }
      if (!Number.isFinite(minimum) || minimum < 0 || minimum > 50_000) return json(req, { error: 'Enter a valid minimum merchandise spend.' }, 400);
      if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1_000_000)) return json(req, { error: 'Redemption limit must be a positive whole number.' }, 400);
      if (expiresMs && (!Number.isFinite(expiresMs) || expiresMs < Date.now() + 300_000)) return json(req, { error: 'Expiry must be at least five minutes in the future.' }, 400);
      if (!requestId) return json(req, { error: 'A valid request ID is required.' }, 400);
      if ((await stripe.promotionCodes.list({ code, active: true, limit: 1 })).data.length) {
        return json(req, { error: 'An active promo code already uses that code.' }, 409);
      }
      const coupon = await stripe.coupons.create({
        duration: 'once',
        name: `RLT ${code}`,
        ...(type === 'fixed' ? { amount_off: Math.round(value * 100), currency: CURRENCY } : { percent_off: Math.round(value * 100) / 100 }),
        metadata: { rlt_managed: 'true', rlt_promo_code: code },
      }, { idempotencyKey: `rlt_promo_coupon_${requestId}` });
      try {
        const promotion = await stripe.promotionCodes.create({
          promotion: { type: 'coupon', coupon: coupon.id },
          code,
          active: true,
          ...(maxUses ? { max_redemptions: maxUses } : {}),
          ...(expiresMs ? { expires_at: Math.floor(expiresMs / 1000) } : {}),
          ...(minimum > 0 ? { restrictions: { minimum_amount: Math.round(minimum * 100), minimum_amount_currency: CURRENCY } } : {}),
          metadata: { rlt_managed: 'true' },
        }, { idempotencyKey: `rlt_promo_code_${requestId}` });
        return json(req, { mode: stripeMode(), promotionCode: safePromotion(promotion, coupon) }, 201);
      } catch (error) {
        await stripe.coupons.del(coupon.id).catch(() => undefined);
        throw error;
      }
    }

    if (action === 'deactivate') {
      const id = trim(input?.promotionCodeId, 128);
      if (!/^promo_[A-Za-z0-9]+$/.test(id)) return json(req, { error: 'Invalid promotion code ID.' }, 400);
      const promotion = await stripe.promotionCodes.update(id, { active: false });
      return json(req, { ok: true, promotionCodeId: promotion.id });
    }
    return json(req, { error: 'Unknown promo-code action.' }, 400);
  } catch (error) {
    console.error('promoCodes error:', error);
    return json(req, { error: 'Promo codes are temporarily unavailable. Please try again.' }, 500);
  }
});
