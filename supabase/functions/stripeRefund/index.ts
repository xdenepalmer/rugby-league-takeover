// Admin-issued Stripe refunds. Until RLT-STRIPE-001 the admin surfaces could
// only RECORD a refund (order fields + timeline) while the money moved
// separately in the Stripe dashboard. This function closes that loop: it
// issues the refund through Stripe's API against the order's PaymentIntent,
// then writes the same honest record — so the timeline says "issued", and
// means it.
//
// Rules (the canonical, unit-tested copy lives in tests/checkout-rules.mjs —
// keep the two in sync):
//   • admin-only (profiles.role === 'admin'), verified server-side
//   • amount is rounded to cents FIRST, must be ≥ $0.01, and can never exceed
//     what's still refundable (order total minus refunds already recorded)
//   • the order must carry a Stripe payment (payment_intent, or a session we
//     can resolve one from) — otherwise 409 so the UI can fall back to the
//     record-only flow for legacy/manual orders
//   • idempotency: the Stripe idempotency key is derived from order + amount,
//     so a double-click can never double-refund
//   • raw Stripe/Postgres errors are logged, never echoed to the client
import Stripe from 'npm:stripe@22.2.0';
import { json, preflight, serviceClient, getCaller, getStripeSecretKey, sendBrandedEmail, siteUrl, escapeHtml } from './shared.ts';

// Mirrors validateRefundAmount (workflow-helpers.js) + the remaining-balance
// cap. Returns { ok, amountAud, amountCents, error }.
export function validateStripeRefundAmount(rawAmount: unknown, orderTotalAud: unknown, alreadyRefundedAud: unknown = 0) {
  const raw = Number(rawAmount);
  if (!Number.isFinite(raw)) {
    return { ok: false as const, error: 'Enter a refund amount greater than $0.' };
  }
  const amountAud = Number(raw.toFixed(2));
  if (amountAud < 0.01) {
    return { ok: false as const, error: 'Enter a refund amount greater than $0.' };
  }
  const total = Number(orderTotalAud);
  const refunded = Number(alreadyRefundedAud);
  const priorAud = Number.isFinite(refunded) && refunded > 0 ? Number(refunded.toFixed(2)) : 0;
  if (Number.isFinite(total) && total > 0) {
    const remaining = Number((Number(total.toFixed(2)) - priorAud).toFixed(2));
    if (amountAud > remaining) {
      return {
        ok: false as const,
        error: priorAud > 0
          ? `Refund can't exceed the remaining balance ($${remaining.toFixed(2)} AUD — $${priorAud.toFixed(2)} already refunded).`
          : `Refund can't exceed the order total ($${total.toFixed(2)} AUD).`,
      };
    }
  }
  return { ok: true as const, amountAud, amountCents: Math.round(amountAud * 100), error: null };
}

// deno-lint-ignore no-explicit-any
async function resolvePaymentIntentId(stripe: Stripe, svc: any, order: any) {
  if (order.stripe_payment_intent_id) return order.stripe_payment_intent_id;
  if (!order.stripe_session_id) return '';
  try {
    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || '';
    if (paymentIntentId) {
      // Backfill for orders paid before the webhook stored payment intents.
      await svc.from('store_orders').update({ stripe_payment_intent_id: paymentIntentId }).eq('id', order.id);
    }
    return paymentIntentId;
  } catch (error) {
    console.error('stripeRefund could not resolve the payment intent from the session:', error);
    return '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const caller = await getCaller(req, svc);
    if (!caller || caller.role !== 'admin') {
      return json({ error: 'Admin access required' }, 403);
    }

    const { orderId, amount, reason = '' } = await req.json();
    const id = String(orderId ?? '').trim();
    if (!id) return json({ error: 'orderId is required' }, 400);

    const { data: order } = await svc.from('store_orders').select('*').eq('id', id).maybeSingle();
    if (!order) return json({ error: 'Order not found' }, 404);
    if (order.status === 'refunded') {
      return json({ error: 'This order is already fully refunded.' }, 409);
    }
    if (!order.payment_verified_at && !['paid', 'packing', 'shipped', 'completed'].includes(order.status || '')) {
      return json({ error: 'This order has no verified payment to refund.' }, 409);
    }

    const priorRefundAud = Number(order.refund_amount);
    const check = validateStripeRefundAmount(amount, order.total_aud, Number.isFinite(priorRefundAud) ? priorRefundAud : 0);
    if (!check.ok) return json({ error: check.error }, 400);

    const stripe = new Stripe(getStripeSecretKey());
    const paymentIntentId = await resolvePaymentIntentId(stripe, svc, order);
    if (!paymentIntentId) {
      // Signals the admin UI to offer the honest record-only fallback.
      return json({ error: 'This order has no Stripe payment attached, so a refund cannot be issued here.', code: 'no_stripe_payment' }, 409);
    }

    let refund;
    try {
      refund = await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          amount: check.amountCents,
          reason: 'requested_by_customer',
          metadata: {
            rlt_app_id: Deno.env.get('RLT_APP_ID') || 'rugby-league-takeover',
            order_id: order.id,
            issued_by: caller.email || caller.id || 'admin',
          },
        },
        // Order + amount derived: a retried/double-clicked identical request
        // returns the SAME refund instead of moving the money twice.
        { idempotencyKey: `rlt-refund-${order.id}-${check.amountCents}` },
      );
    } catch (error) {
      console.error('stripeRefund Stripe API error:', error);
      // deno-lint-ignore no-explicit-any
      const code = (error as any)?.code || (error as any)?.raw?.code;
      if (code === 'charge_already_refunded') {
        return json({ error: 'Stripe reports this payment is already fully refunded.' }, 409);
      }
      return json({ error: 'Stripe declined the refund. Nothing was changed — check the Stripe dashboard.' }, 502);
    }

    const priorAud = Number.isFinite(priorRefundAud) && priorRefundAud > 0 ? Number(priorRefundAud.toFixed(2)) : 0;
    const cumulativeAud = Number((priorAud + check.amountAud).toFixed(2));
    const totalAud = Number(Number(order.total_aud || 0).toFixed(2));
    const fullyRefunded = totalAud > 0 && cumulativeAud >= totalAud;
    const at = new Date().toISOString();
    const trimmedReason = String(reason || '').trim().slice(0, 500);

    const { error: updateError } = await svc.from('store_orders').update({
      ...(fullyRefunded ? { status: 'refunded' } : {}),
      stripe_payment_intent_id: paymentIntentId,
      refund_amount: cumulativeAud,
      refund_reason: trimmedReason,
      refunded_at: at,
      customer_status_note: fullyRefunded
        ? 'Your order has been refunded. The money is on its way back to your original payment method.'
        : `A partial refund of $${check.amountAud.toFixed(2)} AUD has been issued to your original payment method.`,
      timeline: [
        ...(Array.isArray(order.timeline) ? order.timeline : []),
        {
          action: fullyRefunded ? 'refund_issued' : 'partial_refund_issued',
          timestamp: at,
          actor: caller.email || 'admin',
          note: `$${check.amountAud.toFixed(2)} AUD refund issued via Stripe (${refund.id}, status ${refund.status})${trimmedReason ? ` — ${trimmedReason}` : ''}.`,
        },
      ],
    }).eq('id', order.id);
    if (updateError) {
      // The money HAS moved — surface loudly rather than pretending it didn't.
      console.error('stripeRefund issued the refund but could not update the order record:', updateError);
      return json({
        ok: true,
        refundId: refund.id,
        amount: check.amountAud,
        fullyRefunded,
        warning: 'Refund issued in Stripe, but the order record could not be updated — refresh and check the order.',
      });
    }

    // Best-effort refund email; a failed send must never fail the refund.
    const customerEmail = order.customer_email || order.user_email;
    if (customerEmail) {
      const orderNumber = String(order.id).slice(-6).toUpperCase();
      await sendBrandedEmail(customerEmail, `Refund issued — order #${orderNumber}`, {
        text: `Hi${order.customer_name ? ` ${String(order.customer_name).split(/\s+/)[0]}` : ''},\n\nWe've refunded $${check.amountAud.toFixed(2)} AUD${fullyRefunded ? '' : ' (partial refund)'} for order #${orderNumber}. Depending on your bank it can take 5–10 business days to appear on your statement.\n\nRugby League Takeover`,
        preheader: `$${check.amountAud.toFixed(2)} AUD refunded on order #${orderNumber}`,
        heading: fullyRefunded ? 'Refund issued' : 'Partial refund issued',
        bodyHtml: `<p style="margin:0 0 14px;">We've sent <strong style="color:#ea580c;">$${check.amountAud.toFixed(2)} AUD</strong>${fullyRefunded ? '' : ' (a partial refund)'} back to your original payment method for order <strong>#${escapeHtml(orderNumber)}</strong>.</p>
          <p style="margin:0;color:#64748b;">Banks usually post refunds within 5–10 business days.</p>`,
        ctaLabel: 'View my orders',
        ctaUrl: `${siteUrl()}/account`,
        footerNote: `Sent to ${customerEmail} about an order in the Vegas Takeover Store.`,
      });
    }

    return json({ ok: true, refundId: refund.id, amount: check.amountAud, refundedTotal: cumulativeAud, fullyRefunded });
  } catch (error) {
    console.error('stripeRefund error:', error);
    return json({ error: 'Refund could not be processed. Please try again.' }, 500);
  }
});
