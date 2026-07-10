// Server-authoritative checkout-return verification. The success URL only
// proves navigation, never payment — this function lets the return screen ask
// Stripe (server-side) what actually happened to the session before the app
// shows "paid" or clears the cart. The Stripe webhook remains the sole writer
// of order/payment state; this endpoint is read-only.
//
// Guest-safe by design: possession of the unguessable Stripe session id
// (cs_live_/cs_test_..., delivered only via Stripe's redirect) is the return
// credential, and the response carries no PII — just payment/session/order
// status for a session that provably belongs to this app (metadata app id +
// stored stripe_session_id must both match).
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

    // Double-bind to our order row: the order referenced by the session's
    // metadata must have recorded this exact session id at creation time.
    const svc = serviceClient();
    const orderId = String(session?.metadata?.order_id ?? '');
    let orderStatus: string | null = null;
    if (orderId) {
      const { data: order } = await svc
        .from('store_orders')
        .select('id, status, stripe_session_id')
        .eq('id', orderId)
        .maybeSingle();
      if (order && order.stripe_session_id === id) {
        orderStatus = order.status ?? null;
      }
    }

    // Minimal, PII-free verification result.
    return json({
      paymentStatus: session.payment_status ?? null, // 'paid' | 'unpaid' | 'no_payment_required'
      sessionStatus: session.status ?? null, // 'complete' | 'open' | 'expired'
      orderStatus, // webhook-written order state ('paid', 'packing', ...) or null
    });
  } catch (error) {
    console.error('verifyCheckoutReturn error:', error);
    return json({ error: 'Verification failed' }, 500);
  }
});
