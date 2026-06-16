import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@22.2.0';

// NOTE: Base44 deploys each function from its own directory and does not support
// importing shared modules across functions. All checkout logic must stay inlined
// here. The canonical, unit-tested copy of these rules lives in
// tests/checkout-rules.mjs — keep the two in sync when editing.
const CHECKOUT_CURRENCY = 'aud';

const toPositiveInteger = (value, fallback = 1) => {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const getTrackedStock = (product) => {
  const stock = Number(product?.stock_quantity);
  return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : null;
};

function isPaidSessionForOrder(session, order, expectedAppId = '') {
  if (!session || !order) return { ok: false, error: 'Missing session or order' };
  if (session.payment_status !== 'paid') return { ok: false, error: 'Checkout session is not paid' };
  if (order.stripe_session_id && session.id !== order.stripe_session_id) return { ok: false, error: 'Checkout session does not match order' };
  if (session.metadata?.order_id && session.metadata.order_id !== order.id) return { ok: false, error: 'Session order metadata does not match order' };
  if (expectedAppId && session.metadata?.base44_app_id && session.metadata.base44_app_id !== expectedAppId) return { ok: false, error: 'Session app metadata does not match this app' };
  if (String(session.currency || '').toLowerCase() !== CHECKOUT_CURRENCY) return { ok: false, error: 'Checkout currency does not match' };

  const expectedCents = Math.round(Number(order.total_aud || 0) * 100);
  if (Number(session.amount_total) !== expectedCents) return { ok: false, error: 'Checkout amount does not match order total' };

  return { ok: true };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET'));

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        const order = await base44.asServiceRole.entities.StoreOrder.get(orderId);

        // Idempotency guard: Stripe may deliver this event more than once. If the
        // order is already paid, acknowledge without re-decrementing stock.
        if (order?.status === 'paid' || order?.payment_verified_at) {
          return Response.json({ received: true, duplicate: true });
        }

        const verification = isPaidSessionForOrder(session, order, Deno.env.get('BASE44_APP_ID'));
        if (!verification.ok) {
          return Response.json({ error: verification.error }, { status: 400 });
        }

        const paidAt = new Date().toISOString();
        const shipping = session.shipping_details;
        const shippingAddress = shipping?.address
          ? [shipping.name, shipping.address.line1, shipping.address.line2, shipping.address.city, shipping.address.state, shipping.address.postal_code, shipping.address.country].filter(Boolean).join(', ')
          : order.shipping_address || '';

        // Decrement stock and detect oversell. Checkout has no atomic reservation
        // (Base44 has no transactions), so two concurrent buyers can both pass the
        // checkout-time stock check. We never let stock go negative, but we DO flag
        // when paid quantity exceeded available stock at payment time, so the admin
        // can refund/backorder instead of silently shipping inventory that's gone.
        const stockUpdates = [];
        const oversoldItems = [];
        for (const item of order.line_items || []) {
          if (!item.product_id) continue;
          const product = await base44.asServiceRole.entities.Product.get(item.product_id);
          const available = getTrackedStock(product);
          if (available === null) continue; // untracked stock — unlimited
          const purchased = toPositiveInteger(item.quantity);
          if (purchased > available) {
            oversoldItems.push(`${product.name || item.product_id} (ordered ${purchased}, had ${available})`);
          }
          stockUpdates.push({ id: product.id, stock_quantity: Math.max(0, available - purchased) });
        }

        const oversold = oversoldItems.length > 0;
        await base44.asServiceRole.entities.StoreOrder.update(orderId, {
          status: 'paid',
          stripe_session_id: session.id,
          customer_email: session.customer_details?.email || session.customer_email || order.customer_email || '',
          customer_name: session.customer_details?.name || order.customer_name || '',
          stripe_payment_status: session.payment_status,
          payment_verified_at: paidAt,
          shipping_address: shippingAddress,
          stock_oversold: oversold,
          customer_status_note: oversold
            ? 'Payment confirmed. One or more items sold out as you ordered — our team will be in touch about your order.'
            : 'Payment confirmed. Your order is being prepared.',
          timeline: [
            ...(Array.isArray(order.timeline) ? order.timeline : []),
            { action: 'payment_confirmed', timestamp: paidAt, note: 'Stripe payment verified', actor: 'stripe' },
            ...(oversold ? [{ action: 'stock_oversold', timestamp: paidAt, note: `Oversell needs review: ${oversoldItems.join('; ')}`, actor: 'system' }] : [])
          ]
        });

        for (const update of stockUpdates) {
          await base44.asServiceRole.entities.Product.update(update.id, { stock_quantity: update.stock_quantity });
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('stripeWebhook error:', error);
    return Response.json({ error: error.message }, { status: 400 });
  }
});