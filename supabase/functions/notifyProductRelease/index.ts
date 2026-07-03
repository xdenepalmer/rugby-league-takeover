// Notify release-list subscribers when a product goes live. Called by an admin
// (or automation) with { data: { id: productId } }. Emails send via Resend when
// RESEND_API_KEY is configured; in-app notifications are always created.
import { json, preflight, serviceClient, sendBrandedEmail, siteUrl, escapeHtml } from './shared.ts';

const clean = (v: unknown) => String(v ?? '').trim();
const nowIso = () => new Date().toISOString();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const payload = await req.json().catch(() => ({}));
    const productId = clean(payload?.data?.id || payload?.productId);

    if (!productId) return json({ ok: true, skipped: true });

    // Never trust the caller's product fields — re-fetch server-side and only
    // notify for a genuinely live product.
    const { data: product } = await svc.from('products').select('*').eq('id', productId).maybeSingle();
    if (!product?.id || product.coming_soon === true || product.is_active === false) {
      return json({ ok: true, skipped: true });
    }

    const { data: subscribers } = await svc
      .from('product_release_subscriptions')
      .select('*')
      .eq('product_id', product.id)
      .eq('is_active', true)
      .order('created_date', { ascending: false })
      .limit(1000);

    const pending = (subscribers || []).filter((sub) => !sub.notified_at && clean(sub.email));
    const productName = clean(product.name) || 'Your merch item';
    const storeUrl = `${siteUrl()}/store`;
    let sent = 0;

    for (const sub of pending) {
      const firstName = clean(sub.name).split(/\s+/)[0] || 'legend';
      await sendBrandedEmail(sub.email, `${productName} is now live`, {
        text: `Hey ${firstName},\n\n${productName} is now live in the Vegas Takeover Store.\n\nGrab it here: ${storeUrl}\n\nThanks for joining the release list.\n\nRugby League Takeover`,
        preheader: `${productName} just dropped in the Vegas Takeover Store.`,
        heading: 'It just dropped',
        bodyHtml: `<p style="margin:0 0 14px;">Hey ${escapeHtml(firstName)},</p>
          <p style="margin:0 0 14px;"><strong style="color:#ffffff;">${escapeHtml(productName)}</strong> is now live in the Vegas Takeover Store — you asked us to let you know the moment it landed.</p>
          <p style="margin:0;">Stock moves fast on release day. Good luck out there.</p>`,
        ctaLabel: 'Shop the drop',
        ctaUrl: storeUrl,
        footerNote: "You're receiving this because you joined this product's release list.",
      });

      if (clean(sub.user_id)) {
        await svc.from('notifications').insert({
          recipient_id: sub.user_id,
          recipient_email: sub.user_email || sub.email,
          type: 'system',
          title: `${productName} is now live`,
          preview: 'Your merch release alert is ready. Head to the store to check it out.',
          actor_name: 'Rugby League Takeover Store',
          link: '/store',
          is_read: false,
        });
      }

      await svc.from('product_release_subscriptions').update({ notified_at: nowIso() }).eq('id', sub.id);
      sent += 1;
    }

    return json({ ok: true, sent, product_id: product.id });
  } catch (error) {
    console.error('notifyProductRelease error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
