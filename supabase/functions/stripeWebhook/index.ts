// Stripe webhook: verifies signatures, processes payment exactly once in an
// atomic database transaction, and reconciles expiry/failure/refund events.
import Stripe from 'npm:stripe@22.2.0';
import {
  escapeHtml,
  getStripeSecretKey,
  getStripeWebhookSecret,
  sendBrandedEmail,
  serviceClient,
  siteUrl,
  stripeMode,
} from './shared.ts';

const CHECKOUT_CURRENCY = 'aud';
const MAX_WEBHOOK_BYTES = 1_048_576;

const webhookJson = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const paymentIntentId = (session: Stripe.Checkout.Session) =>
  typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id || '';

// Stripe's current API nests this under collected_information; accepting the
// legacy property keeps older webhook endpoint API versions safe during rollout.
// deno-lint-ignore no-explicit-any
const checkoutShippingDetails = (session: any) =>
  session?.collected_information?.shipping_details || session?.shipping_details || null;

// deno-lint-ignore no-explicit-any
function verifyPaidSession(session: any, order: any) {
  const expectedAppId = Deno.env.get('RLT_APP_ID') || 'rugby-league-takeover';
  const expectedLiveMode = stripeMode() === 'live';
  const shipping = checkoutShippingDetails(session);

  if (!session || !order) return { ok: false, error: 'Missing session or order' };
  if (session.mode !== 'payment') return { ok: false, error: 'Unexpected Checkout mode' };
  if (session.payment_status !== 'paid') return { ok: false, error: 'Checkout session is not paid' };
  if (session.id !== order.stripe_session_id) return { ok: false, error: 'Checkout session does not match order' };
  if (session.client_reference_id !== order.id) return { ok: false, error: 'Checkout client reference does not match order' };
  if (session.metadata?.order_id !== order.id) return { ok: false, error: 'Session order metadata does not match order' };
  if (session.metadata?.rlt_app_id !== expectedAppId) return { ok: false, error: 'Session app metadata does not match this app' };
  if (Boolean(session.livemode) !== expectedLiveMode) return { ok: false, error: 'Stripe mode does not match server mode' };
  if (String(session.currency || '').toLowerCase() !== CHECKOUT_CURRENCY) return { ok: false, error: 'Checkout currency does not match' };

  const expectedCents = Math.round(Number(order.total_aud || 0) * 100);
  if (!Number.isSafeInteger(expectedCents) || expectedCents <= 0 || Number(session.amount_total) !== expectedCents) {
    return { ok: false, error: 'Checkout amount does not match order total' };
  }
  if (!shipping?.address?.line1 || String(shipping.address.country || '').toUpperCase() !== 'AU') {
    return { ok: false, error: 'A valid Australian shipping address is required' };
  }
  return { ok: true };
}

// deno-lint-ignore no-explicit-any
async function sendOrderConfirmation(order: any) {
  const confirmationEmail = order.customer_email;
  if (!confirmationEmail) return;

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
    ? `<tr><td style="padding:9px 0;border-bottom:1px solid #e2e8f0;color:#334155;">Shipping — ${escapeHtml(order.shipping_service_name)}</td>
         <td style="padding:9px 0;border-bottom:1px solid #e2e8f0;color:#334155;text-align:right;">${Number(order.shipping_cost_aud) > 0 ? money(order.shipping_cost_aud) : 'FREE'}</td></tr>`
    : '';
  const discountRow = Number(order.discount_amount_aud) > 0
    ? `<tr><td style="padding:9px 0;border-bottom:1px solid #e2e8f0;color:#15803d;">Promo — ${escapeHtml(order.promo_code || 'discount')}</td>
         <td style="padding:9px 0;border-bottom:1px solid #e2e8f0;color:#15803d;text-align:right;">−${money(order.discount_amount_aud)}</td></tr>`
    : '';
  const itemsText = (order.line_items || [])
    // deno-lint-ignore no-explicit-any
    .map((item: any) => `${item.quantity}x ${item.size ? `${item.name} (Size ${item.size})` : item.name} — ${money(Number(item.price_aud || 0) * Number(item.quantity || 1))}`)
    .join('\n');

  await sendBrandedEmail(confirmationEmail, `Order confirmed — #${orderNumber}`, {
    text: `Thanks for your order!\n\nOrder #${orderNumber}\n\n${itemsText}\n${Number(order.discount_amount_aud) > 0 ? `Promo (${order.promo_code || 'discount'}): -${money(order.discount_amount_aud)}\n` : ''}${order.shipping_service_name ? `Shipping (${order.shipping_service_name}): ${Number(order.shipping_cost_aud) > 0 ? money(order.shipping_cost_aud) : 'FREE'}\n` : ''}Total: ${money(order.total_aud)} AUD\n\nTrack your order: ${siteUrl()}/account\n\nRugby League Takeover`,
    preheader: `Order #${orderNumber} confirmed — ${money(order.total_aud)} AUD`,
    heading: 'Order confirmed',
    bodyHtml: `<p style="margin:0 0 14px;">Thanks${order.customer_name ? ` ${escapeHtml(String(order.customer_name).split(/\s+/)[0])}` : ''} — your payment is in and the crew is on it.</p>
      <p style="margin:0 0 18px;color:#64748b;">Order <strong style="color:#ea580c;">#${orderNumber}</strong></p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;">
        ${itemRows}
        ${discountRow}
        ${shippingRow}
        <tr>
          <td style="padding:12px 0 0;color:#0b1220;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Total</td>
          <td style="padding:12px 0 0;color:#ea580c;font-weight:bold;text-align:right;font-size:16px;">${money(order.total_aud)} AUD</td>
        </tr>
      </table>
      <p style="margin:20px 0 0;color:#64748b;">You can follow fulfilment and tracking from Account → Orders.</p>`,
    ctaLabel: 'Track my order',
    ctaUrl: `${siteUrl()}/account`,
    footerNote: `Sent to ${confirmationEmail} because an order was placed in the Vegas Takeover Store.`,
  });
}

// deno-lint-ignore no-explicit-any
async function processPaidCheckout(svc: any, event: Stripe.Event, session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId) throw new Error('Checkout session is missing order metadata');

  const { data: order, error: orderError } = await svc
    .from('store_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError || !order) throw new Error('Order not found');

  const verification = verifyPaidSession(session, order);
  if (!verification.ok) throw new Error(verification.error);

  const shipping = checkoutShippingDetails(session);
  const shippingAddress = [
    shipping?.name,
    shipping?.address?.line1,
    shipping?.address?.line2,
    shipping?.address?.city,
    shipping?.address?.state,
    shipping?.address?.postal_code,
    shipping?.address?.country,
  ].filter(Boolean).join(', ');

  const { data: result, error: processError } = await svc.rpc('process_store_order_payment', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_order_id: order.id,
    p_session_id: session.id,
    p_payment_intent_id: paymentIntentId(session),
    p_customer_email: session.customer_details?.email || session.customer_email || order.customer_email || '',
    p_customer_name: session.customer_details?.name || shipping?.name || order.customer_name || '',
    p_shipping_address: shippingAddress,
    p_shipping: {
      name: shipping?.name || '',
      line1: shipping?.address?.line1 || '',
      line2: shipping?.address?.line2 || '',
      city: shipping?.address?.city || '',
      state: shipping?.address?.state || '',
      postal_code: shipping?.address?.postal_code || '',
      country: shipping?.address?.country || '',
    },
    p_paid_at: new Date(event.created * 1000).toISOString(),
  });
  if (processError) throw processError;

  if (result?.result === 'processed') {
    const { data: paidOrder } = await svc.from('store_orders').select('*').eq('id', order.id).single();
    if (paidOrder) await sendOrderConfirmation(paidOrder);
  }
  return result;
}

// deno-lint-ignore no-explicit-any
async function closePendingCheckout(svc: any, session: Stripe.Checkout.Session, reason: string, action: string) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;
  const { data: order } = await svc.from('store_orders').select('id,status,timeline,stripe_session_id').eq('id', orderId).maybeSingle();
  if (!order || order.status !== 'pending' || order.stripe_session_id !== session.id) return;

  await svc.from('store_orders').update({
    status: 'cancelled',
    stripe_payment_status: session.payment_status || 'unpaid',
    customer_status_note: reason,
    timeline: [
      ...(Array.isArray(order.timeline) ? order.timeline : []),
      { action, timestamp: new Date().toISOString(), note: reason, actor: 'stripe' },
    ],
  }).eq('id', order.id).eq('status', 'pending');
}

// deno-lint-ignore no-explicit-any
async function reconcileRefund(svc: any, refund: any) {
  const orderId = refund.metadata?.order_id;
  if (!orderId) return;
  const { data: order } = await svc.from('store_orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return;

  if (refund.status === 'succeeded') {
    const { error } = await svc.rpc('finalize_store_order_refund', {
      p_order_id: order.id,
      p_refund_id: refund.id,
      p_refund_status: refund.status,
      p_amount_aud: Number(refund.amount || 0) / 100,
      p_reason: refund.metadata?.admin_reason || 'Refund issued',
      p_actor: refund.metadata?.admin_actor || 'stripe',
      p_restock: refund.metadata?.restock === 'true',
    });
    if (error) throw error;
    return;
  }

  if (['failed', 'canceled'].includes(refund.status)) {
    await svc.from('store_orders').update({
      stripe_refund_status: refund.status,
      customer_status_note: 'The attempted refund did not complete. Our team is reviewing it.',
      timeline: [
        ...(Array.isArray(order.timeline) ? order.timeline : []),
        {
          action: 'refund_failed',
          timestamp: new Date().toISOString(),
          note: `Stripe refund ${refund.status}`,
          actor: 'stripe',
        },
      ],
    }).eq('id', order.id);
  }
}

async function reconcileRefundedCharge(svc: any, charge: Stripe.Charge) {
  const intentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id || '';
  if (!intentId || !charge.refunded) return;

  const { data: order } = await svc
    .from('store_orders')
    .select('*')
    .eq('stripe_payment_intent_id', intentId)
    .maybeSingle();
  if (!order || order.status === 'refunded') return;

  const expectedCents = Math.round(Number(order.total_aud || 0) * 100);
  if (
    String(charge.currency || '').toLowerCase() !== CHECKOUT_CURRENCY
    || Number(charge.amount_refunded) !== expectedCents
  ) {
    return; // Partial refunds need manual review; this workflow is full-refund only.
  }

  const succeededRefund = charge.refunds?.data.find((refund) => refund.status === 'succeeded');
  if (!succeededRefund?.id) return;
  const { error } = await svc.rpc('finalize_store_order_refund', {
    p_order_id: order.id,
    p_refund_id: succeededRefund.id,
    p_refund_status: succeededRefund.status,
    p_amount_aud: expectedCents / 100,
    p_reason: succeededRefund.metadata?.admin_reason || 'Full refund recorded in Stripe',
    p_actor: succeededRefund.metadata?.admin_actor || 'stripe',
    p_restock: succeededRefund.metadata?.restock === 'true',
  });
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return webhookJson({ error: 'Method not allowed.' }, 405);

  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) return webhookJson({ error: 'Invalid webhook signature.' }, 400);

    const declaredLength = Number(req.headers.get('content-length') || 0);
    if (declaredLength > MAX_WEBHOOK_BYTES) return webhookJson({ error: 'Webhook payload is too large.' }, 413);
    const body = await req.text();
    if (new TextEncoder().encode(body).byteLength > MAX_WEBHOOK_BYTES) {
      return webhookJson({ error: 'Webhook payload is too large.' }, 413);
    }

    const stripe = new Stripe(getStripeSecretKey());
    const event = await stripe.webhooks.constructEventAsync(body, signature, getStripeWebhookSecret());
    const svc = serviceClient();

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid') {
        const result = await processPaidCheckout(svc, event, session);
        return webhookJson({ received: true, result: result?.result || 'processed' });
      }

      // Delayed payment methods may complete Checkout before funds are paid.
      const orderId = session.metadata?.order_id;
      if (orderId) {
        await svc.from('store_orders').update({
          stripe_payment_status: session.payment_status || 'unpaid',
          customer_status_note: 'Payment is processing. We will prepare the order after Stripe confirms the funds.',
        }).eq('id', orderId).eq('status', 'pending');
      }
      return webhookJson({ received: true, result: 'payment_processing' });
    }

    if (event.type === 'checkout.session.async_payment_failed') {
      await closePendingCheckout(
        svc,
        event.data.object as Stripe.Checkout.Session,
        'Payment did not complete. No order will be fulfilled.',
        'payment_failed',
      );
      return webhookJson({ received: true, result: 'payment_failed' });
    }

    if (event.type === 'checkout.session.expired') {
      await closePendingCheckout(
        svc,
        event.data.object as Stripe.Checkout.Session,
        'Checkout expired before payment. No payment was taken.',
        'checkout_expired',
      );
      return webhookJson({ received: true, result: 'checkout_expired' });
    }

    if (event.type === 'refund.updated') {
      await reconcileRefund(svc, event.data.object);
      return webhookJson({ received: true, result: 'refund_reconciled' });
    }

    if (event.type === 'charge.refunded') {
      await reconcileRefundedCharge(svc, event.data.object as Stripe.Charge);
      return webhookJson({ received: true, result: 'charge_refund_reconciled' });
    }

    return webhookJson({ received: true, result: 'ignored' });
  } catch (error) {
    console.error('stripeWebhook rejected event:', error);
    return webhookJson({ error: 'Webhook could not be processed.' }, 400);
  }
});
