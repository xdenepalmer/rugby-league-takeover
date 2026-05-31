import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';
import Stripe from 'npm:stripe@22.2.0';
import {
  DEFAULT_CHECKOUT_ORIGIN,
  buildCheckoutLineItems,
  buildOrderMetadata,
  calculateOrderTotalAud,
  normalizeCheckoutItems,
  resolveCheckoutOrigin,
} from '../_shared/checkout-rules.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const { items, customerName = '', customerEmail = '' } = await req.json();
    const normalizedItems = normalizeCheckoutItems(items);

    if (!normalizedItems.length || !customerEmail) {
      return Response.json({ error: 'Cart items and email are required' }, { status: 400 });
    }

    const productsById = new Map();

    for (const item of normalizedItems) {
      productsById.set(item.productId, await base44.asServiceRole.entities.Product.get(item.productId));
    }

    const lineItemResult = buildCheckoutLineItems(normalizedItems, (productId) => productsById.get(productId));
    if (!lineItemResult.ok) {
      return Response.json({ error: lineItemResult.error }, { status: lineItemResult.status });
    }

    const { lineItems, stripeLineItems } = lineItemResult;
    const totalAud = calculateOrderTotalAud(lineItems);
    const origin = resolveCheckoutOrigin(
      req.headers.get('origin'),
      Deno.env.get('CHECKOUT_ALLOWED_ORIGINS'),
      Deno.env.get('CHECKOUT_DEFAULT_ORIGIN') || DEFAULT_CHECKOUT_ORIGIN
    );

    const order = await base44.asServiceRole.entities.StoreOrder.create({
      customer_name: customerName,
      customer_email: customerEmail,
      status: 'pending',
      total_aud: totalAud,
      line_items: lineItems
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: customerEmail,
      success_url: `${origin}/store?success=true`,
      cancel_url: `${origin}/store?cancelled=true`,
      line_items: stripeLineItems,
      metadata: {
        ...buildOrderMetadata({
          appId: Deno.env.get('BASE44_APP_ID'),
          orderId: order.id,
          totalAud,
        }),
      }
    });

    await base44.asServiceRole.entities.StoreOrder.update(order.id, { stripe_session_id: session.id });
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createCheckout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
