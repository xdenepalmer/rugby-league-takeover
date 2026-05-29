import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.5.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const { productId, quantity = 1, customerName = '', customerEmail = '' } = await req.json();

    if (!productId || !customerEmail) {
      return Response.json({ error: 'Product and email are required' }, { status: 400 });
    }

    const product = await base44.asServiceRole.entities.Product.get(productId);
    if (!product || product.is_active === false) {
      return Response.json({ error: 'Product is not available' }, { status: 404 });
    }

    const safeQuantity = Math.max(1, Math.min(Number(quantity) || 1, 20));
    const totalAud = Number(product.price_aud) * safeQuantity;
    const origin = req.headers.get('origin') || 'https://rugbyleagetakeover.base44.app';

    const order = await base44.asServiceRole.entities.StoreOrder.create({
      customer_name: customerName,
      customer_email: customerEmail,
      status: 'pending',
      total_aud: totalAud,
      line_items: [{ product_id: product.id, name: product.name, quantity: safeQuantity, price_aud: product.price_aud }]
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: customerEmail,
      success_url: `${origin}/store?success=true`,
      cancel_url: `${origin}/store?cancelled=true`,
      line_items: [{
        quantity: safeQuantity,
        price_data: {
          currency: 'aud',
          unit_amount: Math.round(Number(product.price_aud) * 100),
          product_data: {
            name: product.name,
            description: product.description || undefined,
            images: product.image_url ? [product.image_url] : undefined
          }
        }
      }],
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        order_id: order.id
      }
    });

    await base44.asServiceRole.entities.StoreOrder.update(order.id, { stripe_session_id: session.id });
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createCheckout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});