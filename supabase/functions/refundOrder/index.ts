// Admin-only full refund workflow. This calls Stripe first and only then records
// the refund in the order database, using idempotency on both sides.
import Stripe from 'npm:stripe@22.2.0';
import {
  getCaller,
  getStripeSecretKey,
  serviceClient,
  stripeMode,
} from './shared.ts';

const DEFAULT_ORIGIN = 'https://www.rugbyleaguetakeover.com';
const MAX_REQUEST_BYTES = 8_192;

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

const paymentIntentId = (session: Stripe.Checkout.Session) =>
  typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id || '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return isAllowed(req)
      ? new Response(null, { status: 204, headers: headers(req) })
      : json(req, { error: 'Origin is not allowed.' }, 403);
  }
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed.' }, 405);
  if (!isAllowed(req)) return json(req, { error: 'Origin is not allowed.' }, 403);

  try {
    const svc = serviceClient();
    const caller = await getCaller(req, svc);
    if (!caller || caller.role !== 'admin') return json(req, { error: 'Administrator access required.' }, 403);

    const raw = await req.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
      return json(req, { error: 'Invalid refund request.' }, 400);
    }
    const input = JSON.parse(raw);
    const orderId = String(input?.orderId || '').trim();
    const reason = String(input?.reason || '').trim().slice(0, 500);
    const requestedRestock = input?.restock === true;
    if (!orderId || reason.length < 3) {
      return json(req, { error: 'Order and refund reason are required.' }, 400);
    }

    const { data: order, error: orderError } = await svc
      .from('store_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError || !order) return json(req, { error: 'Order not found.' }, 404);
    if (!order.payment_verified_at || !order.stripe_session_id) {
      return json(req, { error: 'Only Stripe-verified payments can be refunded here.' }, 409);
    }
    if (
      order.status === 'refunded'
      || (
        order.stripe_refund_id
        && !['failed', 'canceled'].includes(String(order.stripe_refund_status || ''))
      )
    ) {
      return json(req, {
        ok: true,
        duplicate: true,
        status: order.stripe_refund_status || 'succeeded',
        amountAud: Number(order.refund_amount || order.total_aud || 0),
      });
    }

    const stripe = new Stripe(getStripeSecretKey());
    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id, {
      expand: ['payment_intent'],
    });
    const expectedAppId = Deno.env.get('RLT_APP_ID') || 'rugby-league-takeover';
    const expectedLiveMode = stripeMode() === 'live';
    const totalCents = Math.round(Number(order.total_aud || 0) * 100);
    const intentId = paymentIntentId(session);

    if (
      session.mode !== 'payment'
      || session.payment_status !== 'paid'
      || Boolean(session.livemode) !== expectedLiveMode
      || session.metadata?.rlt_app_id !== expectedAppId
      || session.metadata?.order_id !== order.id
      || session.client_reference_id !== order.id
      || Number(session.amount_total) !== totalCents
      || !intentId
    ) {
      return json(req, { error: 'Stripe payment could not be verified for this order.' }, 409);
    }

    // Only unshipped goods can safely be put back into sellable inventory.
    const restock = requestedRestock && ['paid', 'packing'].includes(order.status);
    const refund = await stripe.refunds.create({
      payment_intent: intentId,
      amount: totalCents,
      reason: 'requested_by_customer',
      metadata: {
        rlt_app_id: expectedAppId,
        order_id: order.id,
        admin_actor: String(caller.email || caller.id || 'admin').slice(0, 254),
        admin_reason: reason,
        restock: restock ? 'true' : 'false',
      },
    }, {
      idempotencyKey: `rlt_refund_${stripeMode()}_${order.id}_${order.stripe_refund_id || 'first'}`,
    });

    if (refund.status === 'succeeded') {
      const { error: finalizeError } = await svc.rpc('finalize_store_order_refund', {
        p_order_id: order.id,
        p_refund_id: refund.id,
        p_refund_status: refund.status,
        p_amount_aud: Number(refund.amount || totalCents) / 100,
        p_reason: reason,
        p_actor: caller.email || caller.id || 'admin',
        p_restock: restock,
      });
      if (finalizeError) throw finalizeError;
    } else {
      const { error: pendingError } = await svc.from('store_orders').update({
        stripe_refund_id: refund.id,
        stripe_refund_status: refund.status || 'pending',
        customer_status_note: 'Your refund has been submitted to Stripe and is processing.',
        timeline: [
          ...(Array.isArray(order.timeline) ? order.timeline : []),
          {
            action: 'refund_submitted',
            timestamp: new Date().toISOString(),
            note: `Full refund submitted to Stripe (${refund.status || 'pending'})`,
            actor: caller.email || 'admin',
          },
        ],
      }).eq('id', order.id);
      if (pendingError) throw pendingError;
    }

    return json(req, {
      ok: true,
      status: refund.status || 'pending',
      amountAud: Number(refund.amount || totalCents) / 100,
      restocked: restock,
    });
  } catch (error) {
    console.error('refundOrder error:', error);
    return json(req, { error: 'Refund could not be completed. Check Stripe before retrying.' }, 500);
  }
});
