import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';
import Stripe from 'npm:stripe@22.2.0';
import { getNextStockQuantity, isPaidSessionForOrder } from '../_shared/checkout-rules.js';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET'));
    const base44 = createClientFromRequest(req);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        const order = await base44.asServiceRole.entities.StoreOrder.get(orderId);
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
