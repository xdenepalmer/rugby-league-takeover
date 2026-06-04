import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const clean = (value) => String(value ?? '').trim();
const nowIso = () => new Date().toISOString();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const product = payload?.data;

    if (!product?.id || product.coming_soon === true || product.is_active === false) {
      return Response.json({ ok: true, skipped: true });
    }

    const subscribers = await base44.asServiceRole.entities.ProductReleaseSubscription.filter({
      product_id: product.id,
      is_active: true
    }, '-created_date', 1000);

    const pending = (subscribers || []).filter((sub) => !sub.notified_at && clean(sub.email));
    const productName = clean(product.name) || 'Your merch item';
    const storeUrl = 'https://rugbyleagetakeover.base44.app/store';
    let sent = 0;

    for (const sub of pending) {
      const firstName = clean(sub.name).split(/\s+/)[0] || 'legend';
      const body = `Hey ${firstName},\n\n${productName} is now live in the Vegas Takeover Store.\n\nGrab it here: ${storeUrl}\n\nThanks for joining the release list.\n\nRugby League Takeover`;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: sub.email,
        subject: `${productName} is now live`,
        body,
        from_name: 'Rugby League Takeover'
      });

      if (clean(sub.user_id)) {
        await base44.asServiceRole.entities.Notification.create({
          recipient_id: sub.user_id,
          recipient_email: sub.user_email || sub.email,
          type: 'system',
          title: `${productName} is now live`,
          preview: 'Your merch release alert is ready. Head to the store to check it out.',
          actor_name: 'Rugby League Takeover Store',
          link: '/store',
          is_read: false
        });
      }

      await base44.asServiceRole.entities.ProductReleaseSubscription.update(sub.id, { notified_at: nowIso() });
      sent += 1;
    }

    return Response.json({ ok: true, sent, product_id: product.id });
  } catch (error) {
    console.error('notifyProductRelease error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});