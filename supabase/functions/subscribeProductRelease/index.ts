// Subscribe an email to a coming-soon product's release list.
import { json, preflight, serviceClient, getCaller, isEmail } from './shared.ts';

const clean = (v: unknown) => String(v ?? '').trim();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const { productId, email, name = '' } = await req.json();
    const product_id = clean(productId);
    const subscriberEmail = clean(email).toLowerCase();

    if (!product_id || !isEmail(subscriberEmail)) {
      return json({ error: 'Product and a valid email are required' }, 400);
    }

    const { data: product } = await svc.from('products').select('*').eq('id', product_id).maybeSingle();
    if (!product || product.is_active === false) {
      return json({ error: 'Product is not available' }, 404);
    }

    if (product.coming_soon !== true) {
      return json({ ok: true, alreadyLive: true, message: 'This product is already available.' });
    }

    const user = await getCaller(req, svc);

    const { data: existing } = await svc
      .from('product_release_subscriptions')
      .select('id')
      .eq('product_id', product_id)
      .eq('email', subscriberEmail)
      .eq('is_active', true)
      .limit(1);

    if (existing?.length) {
      return json({ ok: true, subscribed: true, existing: true });
    }

    await svc.from('product_release_subscriptions').insert({
      product_id,
      product_name: clean(product.name),
      email: subscriberEmail,
      name: clean(name || user?.full_name),
      user_id: user?.id || '',
      user_email: user?.email || '',
      is_active: true,
    });

    return json({ ok: true, subscribed: true });
  } catch (error) {
    console.error('subscribeProductRelease error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
