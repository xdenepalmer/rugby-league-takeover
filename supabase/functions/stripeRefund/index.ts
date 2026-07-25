// Real Stripe refund for a store order. Admin-only, idempotent, supports
// partial and full refunds, and restocks inventory once when a refund becomes
// full. The money moves HERE via Stripe — the previous client-side flow only
// flipped the order status without ever calling Stripe.
//
// Request: { orderId, amount?, reason?, restock? }
//   amount  — AUD to refund this call; omit for "the rest" (full/remaining).
//   restock — default true; items are returned to stock only on a FULL refund
//             and only once (guarded by restocked_at).
import Stripe from 'npm:stripe@22.2.0';
import { json, preflight, serviceClient, getCaller, getStripeSecretKey, num } from './shared.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const me = await getCaller(req, svc);
    if (!me) return json({ error: 'Sign in required' }, 401);
    if (me.role !== 'admin') return json({ error: 'Admins only' }, 403);

    const { orderId, amount, reason, restock = true } = await req.json().catch(() => ({}));
    const id = String(orderId || '').trim();
    if (!id) return json({ error: 'orderId is required' }, 400);

    const { data: order } = await svc.from('store_orders').select('*').eq('id', id).maybeSingle();
    if (!order) return json({ error: 'Order not found' }, 404);

    const REFUNDABLE = ['paid', 'packing', 'shipped', 'completed', 'partially_refunded'];
    if (!REFUNDABLE.includes(order.status)) {
      return json({ error: `An order with status "${order.status}" can't be refunded` }, 400);
    }
    if (!order.stripe_session_id) {
      return json({ error: 'This order has no Stripe payment on file — refund it manually in Stripe' }, 400);
    }

    const orderTotal = num(order.total_aud);
    const alreadyRefunded = num(order.refund_amount);
    const remaining = Math.max(0, orderTotal - alreadyRefunded);
    if (remaining <= 0) return json({ error: 'This order is already fully refunded' }, 400);

    // Default to the remaining balance; clamp a supplied amount to it.
    let refundAud = amount != null && amount !== '' ? num(amount) : remaining;
    if (refundAud <= 0) return json({ error: 'Refund amount must be greater than zero' }, 400);
    refundAud = Math.min(refundAud, remaining);
    const refundCents = Math.round(refundAud * 100);

    const stripe = new Stripe(getStripeSecretKey());

    // Resolve (and cache) the PaymentIntent behind the checkout session.
    let paymentIntentId: string | null = order.stripe_payment_intent_id || null;
    if (!paymentIntentId) {
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent as { id?: string } | null)?.id || null;
      if (!paymentIntentId) return json({ error: 'No payment intent found for this order' }, 400);
    }

    // Idempotency: keyed on the order + the cumulative refunded cents so a
    // double-clicked or retried request can't refund twice.
    const idempotencyKey = `refund_${id}_${Math.round(alreadyRefunded * 100)}_${refundCents}`;

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: refundCents,
      reason: 'requested_by_customer',
      metadata: { order_id: id, admin: me.email || '', note: String(reason || '').slice(0, 400) },
    }, { idempotencyKey });

    const totalRefunded = Math.min(orderTotal, alreadyRefunded + refundAud);
    const isFull = totalRefunded >= orderTotal - 0.005;
    const nowIso = new Date().toISOString();

    // Restock once, only when the order becomes fully refunded.
    let restocked = false;
    if (restock && isFull && !order.restocked_at) {
      for (const item of order.line_items || []) {
        if (!item.product_id) continue;
        const { data: product } = await svc.from('products').select('id, stock_quantity').eq('id', item.product_id).maybeSingle();
        if (!product) continue;
        const stock = Number(product.stock_quantity);
        if (!Number.isFinite(stock)) continue; // untracked stock — nothing to return
        const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        await svc.from('products').update({ stock_quantity: Math.max(0, Math.floor(stock) + qty) }).eq('id', product.id);
      }
      restocked = true;
    }

    const timeline = [
      ...(Array.isArray(order.timeline) ? order.timeline : []),
      {
        action: isFull ? 'refunded' : 'partially_refunded',
        timestamp: nowIso,
        actor: me.email || 'admin',
        note: `Refunded $${refundAud.toFixed(2)} AUD via Stripe${reason ? ` — ${reason}` : ''}${restocked ? ' · items restocked' : ''}`,
      },
    ];

    await svc.from('store_orders').update({
      status: isFull ? 'refunded' : 'partially_refunded',
      refund_amount: totalRefunded,
      refund_reason: reason || order.refund_reason || '',
      refunded_at: nowIso,
      stripe_refund_id: refund.id,
      stripe_payment_intent_id: paymentIntentId,
      ...(restocked ? { restocked_at: nowIso } : {}),
      timeline,
    }).eq('id', id);

    return json({
      ok: true,
      refundId: refund.id,
      refundedAmount: refundAud,
      totalRefunded,
      isFull,
      restocked,
      status: isFull ? 'refunded' : 'partially_refunded',
    });
  } catch (error) {
    console.error('stripeRefund error:', error);
    // Surface Stripe's message (e.g. "charge already refunded") to the admin.
    return json({ error: (error as Error).message || 'Refund failed' }, 500);
  }
});
