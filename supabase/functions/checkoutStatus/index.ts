// Verifies a Stripe return-page session before the storefront shows success or
// clears the cart. A query-string flag alone is never treated as proof of pay.
import Stripe from 'npm:stripe@22.2.0';
import { getStripeSecretKey, serviceClient, stripeMode } from './shared.ts';

const DEFAULT_ORIGIN = 'https://www.rugbyleaguetakeover.com';
const MAX_REQUEST_BYTES = 4_096;

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

const json = (req: Request, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: headers(req) });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return isAllowed(req)
      ? new Response(null, { status: 204, headers: headers(req) })
      : json(req, { error: 'Origin is not allowed.' }, 403);
  }
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed.' }, 405);
  if (!isAllowed(req)) return json(req, { error: 'Origin is not allowed.' }, 403);

  try {
    const raw = await req.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
      return json(req, { error: 'Invalid checkout status request.' }, 400);
    }
    const input = JSON.parse(raw);
    const sessionId = String(input?.sessionId || '').trim();
    if (!/^cs_(?:test|live)_[A-Za-z0-9_]{10,}$/.test(sessionId)) {
      return json(req, { error: 'Invalid checkout session.' }, 400);
    }

    const stripe = new Stripe(getStripeSecretKey());
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const expectedAppId = Deno.env.get('RLT_APP_ID') || 'rugby-league-takeover';
    const expectedLiveMode = stripeMode() === 'live';
    const orderId = session.metadata?.order_id || '';

    if (
      session.mode !== 'payment'
      || Boolean(session.livemode) !== expectedLiveMode
      || session.metadata?.rlt_app_id !== expectedAppId
      || !orderId
      || session.client_reference_id !== orderId
    ) {
      return json(req, { error: 'Checkout session could not be verified.' }, 400);
    }

    const svc = serviceClient();
    const { data: order, error } = await svc
      .from('store_orders')
      .select('id,status,total_aud,user_id,stripe_session_id,stripe_payment_status,payment_verified_at,shipping_service_name,shipping_cost_aud')
      .eq('id', orderId)
      .maybeSingle();
    if (error || !order || order.stripe_session_id !== session.id) {
      return json(req, { error: 'Checkout order could not be verified.' }, 404);
    }

    const status = order.payment_verified_at && session.payment_status === 'paid'
      ? 'paid'
      : order.status === 'cancelled' || session.status === 'expired'
        ? 'expired'
        : session.status === 'complete' || session.payment_status === 'paid'
          ? 'processing'
          : 'open';

    return json(req, {
      status,
      orderNumber: String(order.id).slice(-6).toUpperCase(),
      totalAud: Number(order.total_aud || 0),
      hasAccountOrder: Boolean(order.user_id),
      shipping: {
        name: order.shipping_service_name || 'Standard shipping',
        costAud: Number(order.shipping_cost_aud || 0),
      },
    });
  } catch (error) {
    console.error('checkoutStatus error:', error);
    return json(req, { error: 'Unable to verify checkout right now.' }, 400);
  }
});
