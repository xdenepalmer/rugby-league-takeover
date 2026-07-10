// Server-authoritative checkout-return verification. The success URL only
// proves navigation, never payment — this function lets the return screen ask
// Stripe (server-side) what actually happened to the session before the app
// shows "paid" or clears the cart. The Stripe webhook remains the sole writer
// of order/payment state; this endpoint is read-only.
//
// Guest-safe by design: possession of the unguessable Stripe session id
// (cs_live_/cs_test_..., delivered only via Stripe's redirect) is the return
// credential, and the response carries no PII — just payment/session/order
// status.
//
// Verification order matters:
// 1. DB first — the session id must have been recorded on a store_orders row
//    by OUR createCheckout at creation time. Unknown ids get a 404 before any
//    Stripe call, so this endpoint cannot be used to amplify billable Stripe
//    API traffic, and payment status is only ever reported for sessions this
//    app itself created (bind #1).
// 2. Stripe second — the retrieved session must carry our app id AND point
//    back (metadata.order_id) at the same order row that recorded it
//    (bind #2). Only then is Stripe's payment_status returned.
import Stripe from 'npm:stripe@22.2.0';
import { json, preflight, serviceClient, getStripeSecretKey } from './shared.ts';

const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{10,240}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const { sessionId } = await req.json();
    const id = String(sessionId ?? '').trim();
    if (!SESSION_ID_PATTERN.test(id)) {
      return json({ error: 'Invalid checkout session reference' }, 400);
    }

    // Bind #1: our DB must have recorded this exact session id at checkout
    // creation. No row → 404 without ever touching Stripe (anti-amplification;
    // enumeration is already infeasible against high-entropy cs_ ids).
    const svc = serviceClient();
    const { data: order } = await svc
      .from('store_orders')
      .select('id, status, stripe_session_id')
      .eq('stripe_session_id', id)
      .maybeSingle();
    if (!order) {
      return json({ error: 'Checkout session not found' }, 404);
    }

    const stripe = new Stripe(getStripeSecretKey());
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(id);
    } catch {
      return json({ error: 'Checkout session not found' }, 404);
    }

    // The session must belong to THIS app (same guard the webhook applies).
    const expectedAppId = Deno.env.get('RLT_APP_ID') || 'rugby-league-takeover';
    if (session?.metadata?.rlt_app_id !== expectedAppId) {
      return json({ error: 'Checkout session not found' }, 404);
    }

    // Bind #2: the Stripe session's own metadata must point back at the same
    // order row that recorded it. A mismatch means the id was attached to a
    // different order than Stripe thinks — refuse to report payment status.
    if (String(session?.metadata?.order_id ?? '') !== String(order.id)) {
      return json({ error: 'Checkout session not found' }, 404);
    }

    // Minimal, PII-free verification result.
    return json({
      paymentStatus: session.payment_status ?? null, // 'paid' | 'unpaid' | 'no_payment_required'
      sessionStatus: session.status ?? null, // 'complete' | 'open' | 'expired'
      orderStatus: order.status ?? null, // webhook-written order state ('paid', 'packing', ...) or null
    });
  } catch (error) {
    console.error('verifyCheckoutReturn error:', error);
    return json({ error: 'Verification failed' }, 500);
  }
});
