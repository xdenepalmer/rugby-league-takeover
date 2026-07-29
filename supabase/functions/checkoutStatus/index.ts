// Verifies a Stripe session before the storefront shows success or clears the
// cart. Query-string flags alone are never proof of payment.
import Stripe from 'npm:stripe@22.2.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const DEFAULT_ORIGIN = 'https://www.rugbyleaguetakeover.com';
const stripeMode = () => Deno.env.get('STRIPE_MODE') === 'test' ? 'test' : 'live';
const stripeKey = () => {
  const mode = stripeMode();
  const key = mode === 'test'
    ? Deno.env.get('STRIPE_SECRET_KEY_TEST')
    : Deno.env.get('STRIPE_SECRET_KEY_LIVE') || Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('Stripe is not configured');
  return key;
};
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
const isAllowed = (req: Request) => !req.headers.get('origin') || allowedOrigin(parseOrigin(req.headers.get('origin')));
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
    if (!raw || new TextEncoder().encode(raw).byteLength > 4_096) {
      return json(req, { error: 'Invalid checkout status request.' }, 400);
    }
    const sessionId = String(JSON.parse(raw)?.sessionId || '').trim();
    if (!/^cs_(?:test|live)_[A-Za-z0-9_]{10,}$/.test(sessionId)) {
      return json(req, { error: 'Invalid checkout session.' }, 400);
    }

    const stripe = new Stripe(stripeKey());
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const orderId = session.metadata?.order_id || '';
    const appId = Deno.env.get('RLT_APP_ID') || 'rugby-league-takeover';
    if (
      session.mode !== 'payment'
      || Boolean(session.livemode) !== (stripeMode() === 'live')
      || session.metadata?.rlt_app_id !== appId
      || !orderId
      || session.client_reference_id !== orderId
    ) return json(req, { error: 'Checkout session could not be verified.' }, 400);

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const { data: order, error } = await svc
      .from('store_orders')
      .select('id,status,total_aud,user_id,stripe_session_id,stripe_payment_status,payment_verified_at,shipping_service_name,shipping_cost_aud,fulfilment_method')
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
      fulfilmentMethod: order.fulfilment_method || 'shipping',
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
