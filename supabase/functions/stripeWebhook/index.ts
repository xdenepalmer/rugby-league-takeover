// Stripe webhook: verifies the signature, marks orders paid, decrements stock,
// and flags oversells for admin review. The canonical, unit-tested copy of
// these rules lives in tests/checkout-rules.mjs — keep the two in sync.
import Stripe from 'npm:stripe@22.2.0';
import { json, serviceClient, getStripeSecretKey, getStripeWebhookSecret, sendBrandedEmail, siteUrl, escapeHtml } from './shared.ts';

const CHECKOUT_CURRENCY = 'aud';

const toPositiveInteger = (value: unknown, fallback = 1) => {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

// deno-lint-ignore no-explicit-any
const getTrackedStock = (product: any) => {
  const stock = Number(product?.stock_quantity);
  return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : null;
};

// deno-lint-ignore no-explicit-any
function isPaidSessionForOrder(session: any, order: any, expectedAppId = '') {
  if (!session || !order) return { ok: false, error: 'Missing session or order' };
  if (session.payment_status !== 'paid') return { ok: false, error: 'Checkout session is not paid' };
  if (order.stripe_session_id && session.id !== order.stripe_session_id) return { ok: false, error: 'Checkout session does not match order' };
  if (session.metadata?.order_id && session.metadata.order_id !== order.id) return { ok: false, error: 'Session order metadata does not match order' };
  if (expectedAppId && session.metadata?.rlt_app_id && session.metadata.rlt_app_id !== expectedAppId) return { ok: false, error: 'Session app metadata does not match this app' };
  if (String(session.currency || '').toLowerCase() !== CHECKOUT_CURRENCY) return { ok: false, error: 'Checkout currency does not match' };

  const expectedCents = Math.round(Number(order.total_aud || 0) * 100);
  if (Number(session.amount_total) !== expectedCents) return { ok: false, error: 'Checkout amount does not match order total' };

  return { ok: true };
}

Deno.serve(async (req) => {
  try {
    const svc = serviceClient();
    const stripe = new Stripe(getStripeSecretKey());
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature!, getStripeWebhookSecret());

    if (event.type === 'checkout.session.completed') {
      // deno-lint-ignore no-explicit-any
      const session = event.data.object as any;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        const { data: order } = await svc.from('store_orders').select('*').eq('id', orderId).maybeSingle();

        // Idempotency guard: Stripe may deliver this event more than once.
        if (order?.status === 'paid' || order?.payment_verified_at) {
          return json({ received: true, duplicate: true });
        }

        const verification = isPaidSessionForOrder(session, order, Deno.env.get('RLT_APP_ID') || 'rugby-league-takeover');
        if (!verification.ok) {
          return json({ error: verification.error }, 400);
        }

        const paidAt = new Date().toISOString();
        const shipping = session.shipping_details;
        const shippingAddress = shipping?.address
          ? [shipping.name, shipping.address.line1, shipping.address.line2, shipping.address.city, shipping.address.state, shipping.address.postal_code, shipping.address.country].filter(Boolean).join(', ')
          : order.shipping_address || '';
        // Structured components (used by the AusPost label API, which needs
        // discrete address fields rather than the joined display string above).
        const structuredAddress = shipping?.address
          ? {
              shipping_name: shipping.name || '',
              shipping_address_line1: shipping.address.line1 || '',
              shipping_address_line2: shipping.address.line2 || '',
              shipping_suburb: shipping.address.city || '',
              shipping_state: shipping.address.state || '',
              shipping_postcode: shipping.address.postal_code || '',
              shipping_country: shipping.address.country || '',
            }
          : {};

        // Decrement stock and detect oversell. We never let stock go negative,
        // but we DO flag when paid quantity exceeded available stock at payment
        // time, so the admin can refund/backorder.
        const stockUpdates = [];
        const oversoldItems = [];
        for (const item of order.line_items || []) {
          if (!item.product_id) continue;
          const { data: product } = await svc.from('products').select('*').eq('id', item.product_id).maybeSingle();
          const available = getTrackedStock(product);
          if (available === null || !product) continue; // untracked stock — unlimited
          const purchased = toPositiveInteger(item.quantity);
          if (purchased > available) {
            oversoldItems.push(`${product.name || item.product_id} (ordered ${purchased}, had ${available})`);
          }
          stockUpdates.push({ id: product.id, stock_quantity: Math.max(0, available - purchased) });
        }

        const oversold = oversoldItems.length > 0;
        await svc.from('store_orders').update({
          status: 'paid',
          stripe_session_id: session.id,
          customer_email: session.customer_details?.email || session.customer_email || order.customer_email || '',
          customer_name: session.customer_details?.name || order.customer_name || '',
          stripe_payment_status: session.payment_status,
          payment_verified_at: paidAt,
          shipping_address: shippingAddress,
          ...structuredAddress,
          stock_oversold: oversold,
          customer_status_note: oversold
            ? 'Payment confirmed. One or more items sold out as you ordered — our team will be in touch about your order.'
            : 'Payment confirmed. Your order is being prepared.',
          timeline: [
            ...(Array.isArray(order.timeline) ? order.timeline : []),
            { action: 'payment_confirmed', timestamp: paidAt, note: 'Stripe payment verified', actor: 'stripe' },
            ...(oversold ? [{ action: 'stock_oversold', timestamp: paidAt, note: `Oversell needs review: ${oversoldItems.join('; ')}`, actor: 'system' }] : [])
          ],
        }).eq('id', orderId);

        for (const update of stockUpdates) {
          await svc.from('products').update({ stock_quantity: update.stock_quantity }).eq('id', update.id);
        }

        // Branded order confirmation via Resend. Best-effort: a failed email
        // must never fail the webhook (Stripe would retry and re-process).
        const confirmationEmail = session.customer_details?.email || session.customer_email || order.customer_email;
        if (confirmationEmail) {
          const orderNumber = String(order.id).slice(-6).toUpperCase();
          const money = (value: unknown) => `$${Number(value || 0).toFixed(2)}`;
          // deno-lint-ignore no-explicit-any
          const itemRows = (order.line_items || []).map((item: any) => {
            const label = item.size ? `${item.name} — Size ${item.size}` : item.name;
            return `<tr>
              <td style="padding:9px 0;border-bottom:1px solid #1f2937;color:#cbd5e1;">${escapeHtml(label)} <span style="color:#64748b;">× ${Number(item.quantity || 1)}</span></td>
              <td style="padding:9px 0;border-bottom:1px solid #1f2937;color:#cbd5e1;text-align:right;white-space:nowrap;">${money(Number(item.price_aud || 0) * Number(item.quantity || 1))}</td>
            </tr>`;
          }).join('');
          const shippingRow = order.shipping_service_name
            ? `<tr><td style="padding:9px 0;border-bottom:1px solid #1f2937;color:#cbd5e1;">Shipping — ${escapeHtml(order.shipping_service_name)} (AusPost)</td>
                 <td style="padding:9px 0;border-bottom:1px solid #1f2937;color:#cbd5e1;text-align:right;">${Number(order.shipping_cost_aud) > 0 ? money(order.shipping_cost_aud) : 'FREE'}</td></tr>`
            : '';
          const itemsText = (order.line_items || [])
            // deno-lint-ignore no-explicit-any
            .map((item: any) => `${item.quantity}x ${item.size ? `${item.name} (Size ${item.size})` : item.name} — ${money(Number(item.price_aud || 0) * Number(item.quantity || 1))}`)
            .join('\n');

          await sendBrandedEmail(confirmationEmail, `Order confirmed — #${orderNumber}`, {
            text: `Thanks for your order!\n\nOrder #${orderNumber}\n\n${itemsText}\n${order.shipping_service_name ? `Shipping (${order.shipping_service_name}): ${Number(order.shipping_cost_aud) > 0 ? money(order.shipping_cost_aud) : 'FREE'}\n` : ''}Total: ${money(order.total_aud)} AUD\n\nTrack your order: ${siteUrl()}/account\n\nRugby League Takeover`,
            preheader: `Order #${orderNumber} confirmed — ${money(order.total_aud)} AUD`,
            heading: 'Order confirmed',
            bodyHtml: `<p style="margin:0 0 14px;">Thanks${order.customer_name ? ` ${escapeHtml(String(order.customer_name).split(/\s+/)[0])}` : ''} — your payment is in and the crew is on it.</p>
              <p style="margin:0 0 18px;color:#94a3b8;">Order <strong style="color:#f97316;">#${orderNumber}</strong></p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;">
                ${itemRows}
                ${shippingRow}
                <tr>
                  <td style="padding:12px 0 0;color:#ffffff;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Total</td>
                  <td style="padding:12px 0 0;color:#f97316;font-weight:bold;text-align:right;font-size:16px;">${money(order.total_aud)} AUD</td>
                </tr>
              </table>
              <p style="margin:20px 0 0;color:#94a3b8;">We'll email again when it ships. You can follow every step from your account.</p>`,
            ctaLabel: 'Track my order',
            ctaUrl: `${siteUrl()}/account`,
            footerNote: `Sent to ${confirmationEmail} because an order was placed in the Vegas Takeover Store.`,
          });
        }
      }
    }

    return json({ received: true });
  } catch (error) {
    console.error('stripeWebhook error:', error);
    return json({ error: (error as Error).message }, 400);
  }
});
