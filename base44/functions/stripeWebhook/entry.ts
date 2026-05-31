import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';
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

function getNextStockQuantity(product, purchasedQuantity) {
  const stock = getTrackedStock(product);
  if (stock === null) return null;
  return Math.max(0, stock - toPositiveInteger(purchasedQuantity));
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

        await base44.asServiceRole.entities.StoreOrder.update(orderId, {
          status: 'paid',
          stripe_session_id: session.id,
          customer_email: session.customer_details?.email || session.customer_email || order.customer_email || '',
          stripe_payment_status: session.payment_status,
          payment_verified_at: new Date().toISOString()
        });

        for (const item of order.line_items || []) {
          if (!item.product_id) continue;
          const product = await base44.asServiceRole.entities.Product.get(item.product_id);
          const nextStock = getNextStockQuantity(product, item.quantity);
          if (nextStock !== null) {
            await base44.asServiceRole.entities.Product.update(product.id, { stock_quantity: nextStock });
          }
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('stripeWebhook error:', error);
    return Response.json({ error: error.message }, { status: 400 });
  }
});
