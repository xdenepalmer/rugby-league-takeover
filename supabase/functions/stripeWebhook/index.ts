// Stripe webhook: verifies the signature, marks orders paid, decrements stock,
// flags oversells for admin review, closes out abandoned/failed checkouts, and
// reconciles dashboard-issued refunds. The canonical, unit-tested copy of these
// rules lives in tests/checkout-rules.mjs — keep the two in sync.
//
// Events handled (subscribe the endpoint to exactly these — docs/STRIPE_GO_LIVE.md):
//   checkout.session.completed        → mark paid (or ack-and-wait for async methods)
//   checkout.session.async_payment_succeeded → mark paid (bank-debit style methods)
//   checkout.session.async_payment_failed    → cancel the pending order
//   checkout.session.expired          → cancel the abandoned pending order
//   charge.refunded                   → reconcile a refund issued in Stripe
// Anything else is acknowledged untouched, so extra subscribed events never
// cause retry storms.
import Stripe from 'npm:stripe@22.2.0';
import { json, serviceClient, getStripeSecretKey, getStripeWebhookSecrets, sendBrandedEmail, siteUrl, escapeHtml } from './shared.ts';

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

// Classify a checkout session against the order it claims to pay.
//   'paid'    → every binding holds and the money is in: write payment state.
//   'pending' → bindings hold but payment isn't complete (async methods still
//               settling): acknowledge and wait for async_payment_succeeded.
//               A non-2xx here would make Stripe retry a healthy event for days.
//   'reject'  → a binding/amount/currency mismatch: 400 so the anomaly stays
//               loud in the Stripe dashboard instead of being swallowed.
// deno-lint-ignore no-explicit-any
function classifyCheckoutSession(session: any, order: any, expectedAppId = '') {
  if (!session || !order) return { outcome: 'reject' as const, reason: 'Missing session or order' };
  if (order.stripe_session_id && session.id !== order.stripe_session_id) return { outcome: 'reject' as const, reason: 'Checkout session does not match order' };
  if (session.metadata?.order_id && session.metadata.order_id !== order.id) return { outcome: 'reject' as const, reason: 'Session order metadata does not match order' };
  if (expectedAppId && session.metadata?.rlt_app_id && session.metadata.rlt_app_id !== expectedAppId) return { outcome: 'reject' as const, reason: 'Session app metadata does not match this app' };
  if (String(session.currency || '').toLowerCase() !== CHECKOUT_CURRENCY) return { outcome: 'reject' as const, reason: 'Checkout currency does not match' };

  const expectedCents = Math.round(Number(order.total_aud || 0) * 100);
  if (Number(session.amount_total) !== expectedCents) return { outcome: 'reject' as const, reason: 'Checkout amount does not match order total' };

  // Same confirmation rule the return screens apply (checkout-return.js):
  // Stripe's payment_status is the EXCLUSIVE authority.
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    return { outcome: 'pending' as const, reason: 'Checkout session is not paid yet' };
  }
  return { outcome: 'paid' as const };
}

// The session's payment_intent is a string id on webhook payloads (it is only
// an expanded object when explicitly requested via the API).
// deno-lint-ignore no-explicit-any
function sessionPaymentIntentId(session: any) {
  const pi = session?.payment_intent;
  if (typeof pi === 'string') return pi;
  return typeof pi?.id === 'string' ? pi.id : '';
}

// deno-lint-ignore no-explicit-any
async function markOrderPaid(svc: any, session: any, order: any) {
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
    stripe_payment_intent_id: sessionPaymentIntentId(session) || order.stripe_payment_intent_id || '',
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
  }).eq('id', order.id);

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
        <td style="padding:9px 0;border-bottom:1px solid #e2e8f0;color:#334155;">${escapeHtml(label)} <span style="color:#94a3b8;">× ${Number(item.quantity || 1)}</span></td>
        <td style="padding:9px 0;border-bottom:1px solid #e2e8f0;color:#334155;text-align:right;white-space:nowrap;">${money(Number(item.price_aud || 0) * Number(item.quantity || 1))}</td>
      </tr>`;
    }).join('');
    const shippingRow = order.shipping_service_name
      ? `<tr><td style="padding:9px 0;border-bottom:1px solid #e2e8f0;color:#334155;">Shipping — ${escapeHtml(order.shipping_service_name)} (AusPost)</td>
           <td style="padding:9px 0;border-bottom:1px solid #e2e8f0;color:#334155;text-align:right;">${Number(order.shipping_cost_aud) > 0 ? money(order.shipping_cost_aud) : 'FREE'}</td></tr>`
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
        <p style="margin:0 0 18px;color:#64748b;">Order <strong style="color:#ea580c;">#${orderNumber}</strong></p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;">
          ${itemRows}
          ${shippingRow}
          <tr>
            <td style="padding:12px 0 0;color:#0b1220;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Total</td>
            <td style="padding:12px 0 0;color:#ea580c;font-weight:bold;text-align:right;font-size:16px;">${money(order.total_aud)} AUD</td>
          </tr>
        </table>
        <p style="margin:20px 0 0;color:#64748b;">We'll email again when it ships. You can follow every step from your account.</p>`,
      ctaLabel: 'Track my order',
      ctaUrl: `${siteUrl()}/account`,
      footerNote: `Sent to ${confirmationEmail} because an order was placed in the Vegas Takeover Store.`,
    });
  }
}

// Abandoned (expired) and failed-async checkouts: close out the order so the
// admin pipeline isn't littered with phantom pendings. ONLY a still-pending
// order is touched — a paid/fulfilled order is never clobbered by a late or
// out-of-order event.
// deno-lint-ignore no-explicit-any
async function cancelPendingOrder(svc: any, order: any, { action, note, customerNote }: { action: string; note: string; customerNote: string }) {
  if (!order || (order.status || 'pending') !== 'pending' || order.payment_verified_at) {
    return { skipped: true };
  }
  const at = new Date().toISOString();
  await svc.from('store_orders').update({
    status: 'cancelled',
    customer_status_note: customerNote,
    timeline: [
      ...(Array.isArray(order.timeline) ? order.timeline : []),
      { action, timestamp: at, note, actor: 'stripe' },
    ],
  }).eq('id', order.id);
  return { skipped: false };
}

// Refund reconciliation: a refund issued anywhere (our stripeRefund function
// OR directly in the Stripe dashboard) fires charge.refunded; this folds it
// back onto the order so DB state never silently diverges from Stripe.
// amount_refunded is CUMULATIVE cents; charge.refunded (the flag) means fully
// refunded. Partial refunds record the running amount without flipping status.
// deno-lint-ignore no-explicit-any
async function reconcileChargeRefund(svc: any, charge: any) {
  const paymentIntentId = typeof charge?.payment_intent === 'string' ? charge.payment_intent : charge?.payment_intent?.id;
  if (!paymentIntentId) return { skipped: true };

  const { data: order } = await svc.from('store_orders').select('*').eq('stripe_payment_intent_id', paymentIntentId).maybeSingle();
  if (!order) return { skipped: true }; // not one of ours (or a pre-integration order)

  const refundedAud = Number((Number(charge.amount_refunded || 0) / 100).toFixed(2));
  const fullyRefunded = charge.refunded === true;

  // Idempotency: our own stripeRefund already wrote this state, and Stripe
  // may deliver the event more than once.
  if (Number(order.refund_amount) === refundedAud && (!fullyRefunded || order.status === 'refunded')) {
    return { skipped: true, duplicate: true };
  }

  const at = new Date().toISOString();
  await svc.from('store_orders').update({
    ...(fullyRefunded ? { status: 'refunded' } : {}),
    refund_amount: refundedAud,
    refunded_at: at,
    timeline: [
      ...(Array.isArray(order.timeline) ? order.timeline : []),
      {
        action: fullyRefunded ? 'refund_confirmed' : 'partial_refund_confirmed',
        timestamp: at,
        note: `Stripe confirmed $${refundedAud.toFixed(2)} AUD refunded${fullyRefunded ? ' (full refund)' : ' (partial)'}.`,
        actor: 'stripe',
      },
    ],
  }).eq('id', order.id);
  return { skipped: false };
}

Deno.serve(async (req) => {
  try {
    const svc = serviceClient();
    const stripe = new Stripe(getStripeSecretKey());
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    // Verify against every configured signing secret (primary mode first).
    // This lets a live-mode AND a test-mode Stripe webhook point at the same
    // URL: each event verifies against its own endpoint's secret instead of
    // the off-mode endpoint 400ing forever. Session/order binding below keeps
    // events scoped to the exact order row their checkout created.
    let event = null;
    for (const secret of getStripeWebhookSecrets()) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature!, secret);
        break;
      } catch {
        // try the next configured secret
      }
    }
    if (!event) {
      return json({ error: 'Webhook signature verification failed' }, 400);
    }

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded' ||
      event.type === 'checkout.session.async_payment_failed' ||
      event.type === 'checkout.session.expired'
    ) {
      // deno-lint-ignore no-explicit-any
      const session = event.data.object as any;
      const orderId = session.metadata?.order_id;
      if (!orderId) return json({ received: true }); // not a session this app created

      const { data: order } = await svc.from('store_orders').select('*').eq('id', orderId).maybeSingle();

      if (event.type === 'checkout.session.expired') {
        await cancelPendingOrder(svc, order, {
          action: 'checkout_expired',
          note: 'Stripe checkout session expired without payment',
          customerNote: 'Checkout was not completed. No payment was taken.',
        });
        return json({ received: true });
      }

      if (event.type === 'checkout.session.async_payment_failed') {
        await cancelPendingOrder(svc, order, {
          action: 'payment_failed',
          note: 'Stripe reported the delayed payment method failed',
          customerNote: 'Your payment could not be completed. No money was taken — please try again.',
        });
        return json({ received: true });
      }

      // completed / async_payment_succeeded — the money paths.
      // Idempotency guard: Stripe may deliver these events more than once.
      if (order?.status === 'paid' || order?.payment_verified_at) {
        return json({ received: true, duplicate: true });
      }

      const verdict = classifyCheckoutSession(session, order, Deno.env.get('RLT_APP_ID') || 'rugby-league-takeover');
      if (verdict.outcome === 'pending') {
        // Async payment method (e.g. bank debit) still settling — Stripe will
        // send async_payment_succeeded/failed later. A 400 here would just
        // trigger days of pointless retries on a healthy event.
        return json({ received: true, pending: true });
      }
      if (verdict.outcome === 'reject') {
        return json({ error: verdict.reason }, 400);
      }

      await markOrderPaid(svc, session, order);
      return json({ received: true });
    }

    if (event.type === 'charge.refunded') {
      // deno-lint-ignore no-explicit-any
      await reconcileChargeRefund(svc, event.data.object as any);
      return json({ received: true });
    }

    return json({ received: true });
  } catch (error) {
    console.error('stripeWebhook error:', error);
    return json({ error: (error as Error).message }, 400);
  }
});
