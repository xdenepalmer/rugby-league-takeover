import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';

const clean = (value) => String(value ?? '').trim();
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { productId, email, name = '' } = await req.json();
    const product_id = clean(productId);
    const subscriberEmail = clean(email).toLowerCase();

    if (!product_id || !isEmail(subscriberEmail)) {
      return Response.json({ error: 'Product and a valid email are required' }, { status: 400 });
    }

    const product = await base44.asServiceRole.entities.Product.get(product_id);
    if (!product || product.is_active === false) {
      return Response.json({ error: 'Product is not available' }, { status: 404 });
    }

    if (product.coming_soon !== true) {
      return Response.json({ ok: true, alreadyLive: true, message: 'This product is already available.' });
    }

    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }

    const existing = await base44.asServiceRole.entities.ProductReleaseSubscription.filter({
      product_id,
      email: subscriberEmail,
      is_active: true
    }, '-created_date', 1);

    if (existing?.length) {
      return Response.json({ ok: true, subscribed: true, existing: true });
    }

    await base44.asServiceRole.entities.ProductReleaseSubscription.create({
      product_id,
      product_name: clean(product.name),
      email: subscriberEmail,
      name: clean(name || user?.full_name),
      user_id: user?.id || '',
      user_email: user?.email || '',
      is_active: true
    });

    return Response.json({ ok: true, subscribed: true });
  } catch (error) {
    console.error('subscribeProductRelease error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});