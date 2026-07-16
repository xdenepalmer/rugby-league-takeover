# Stripe Go-Live Runbook

Everything needed to take the store from zero to live payments. The code side
is fully wired — checkout, webhook, verified return screens, refunds — so this
is purely the Stripe-dashboard + Supabase-secrets checklist. Work top to
bottom; ~20 minutes.

The store is **PCI SAQ A**: Stripe-hosted checkout, no card data ever touches
the app, the site, or the database.

## 0. Deploy the RLT-STRIPE-001 backend pieces (one-time)

The refund function, upgraded webhook, and payment-intent column are in the
repo but need one deploy from a machine logged into the RLT Supabase project
(`supabase login`, or `SUPABASE_ACCESS_TOKEN` for that account):

```sh
node scripts/sync-shared.mjs   # only if _shared/shared.ts changed since last sync
supabase link --project-ref ohytlrgfpcpvnqgdpqap
supabase db push               # applies 0011_store_orders_payment_intent.sql
supabase functions deploy stripeWebhook --no-verify-jwt
supabase functions deploy stripeRefund --no-verify-jwt
```

(`--no-verify-jwt` is required: Stripe can't send a Supabase JWT to the
webhook, and stripeRefund verifies the caller's admin role in-code from the
Authorization header, like every other function here.)

## 1. Set the Supabase Edge Function secrets

Dashboard → Edge Functions → Secrets (or `supabase secrets set NAME=value`),
project `ohytlrgfpcpvnqgdpqap`:

| Secret | Value | Required |
|---|---|---|
| `STRIPE_SECRET_KEY` | **Live** secret key (`sk_live_…`) from [Stripe → Developers → API keys](https://dashboard.stripe.com/apikeys) | yes (live) |
| `STRIPE_WEBHOOK_SECRET` | **Live** webhook signing secret (`whsec_…`) — created in step 2 | yes (live) |
| `STRIPE_SECRET_KEY_TEST` | **Test** secret key (`sk_test_…`) | for test runs |
| `STRIPE_WEBHOOK_SECRET_TEST` | **Test** webhook signing secret | for test runs |
| `STRIPE_MODE` | `test` while rehearsing, `live` (or unset) to go live | optional |
| `CHECKOUT_ALLOWED_ORIGINS` | Comma-separated origins allowed as checkout return targets, e.g. `https://rugbyleaguetakeover.com,https://www.rugbyleaguetakeover.com` | recommended |
| `RESEND_API_KEY` | Enables order-confirmation + refund emails | recommended |

Never put any of these in frontend env — the browser bundle must not carry
Stripe secrets.

## 2. Create the webhook endpoint

[Stripe → Developers → Webhooks](https://dashboard.stripe.com/webhooks) → **Add endpoint**:

- **Endpoint URL:**
  `https://ohytlrgfpcpvnqgdpqap.supabase.co/functions/v1/stripeWebhook`
- **Events to send** (exactly these five):
  - `checkout.session.completed` — marks the order paid, decrements stock, emails the confirmation
  - `checkout.session.async_payment_succeeded` — same, for delayed payment methods
  - `checkout.session.async_payment_failed` — cancels the pending order
  - `checkout.session.expired` — closes out abandoned checkouts so the admin pipeline stays clean
  - `charge.refunded` — folds dashboard-issued refunds back onto the order record
- Copy the endpoint's **signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET` (step 1).

For test mode, create a second endpoint the same way **while the dashboard is
toggled to Test mode**, pointed at the *same URL*, and put its signing secret
in `STRIPE_WEBHOOK_SECRET_TEST`. The webhook verifies against every configured
secret, so the two endpoints coexist safely.

> The function is deployed with `verify_jwt: false` (Stripe cannot send a
> Supabase JWT); authenticity is enforced by the signature check instead.
> Keep it that way when redeploying: `supabase functions deploy stripeWebhook --no-verify-jwt`.

## 3. Rehearse in test mode

1. Set `STRIPE_MODE=test` (with the `_TEST` secrets in place).
2. Buy something in the store with card `4242 4242 4242 4242` (any future
   expiry, any CVC, any AU postcode).
3. Confirm the full loop:
   - Redirected to `/store/checkout/success?session_id=…` and the page shows
     **verified** payment (it calls `verifyCheckoutReturn` — the URL alone is
     never trusted).
   - The order flips to **Paid** in Command Centre → Store → Orders (webhook).
   - Stock decremented; confirmation email arrives (if Resend is configured).
4. Refund it from the admin order screen (**Refund via Stripe**) — money moves
   back in the Stripe test dashboard, the order flips to **Refunded**, the
   timeline records the refund id.
5. Also rehearse a decline (`4000 0000 0000 0002`) and an abandoned checkout
   (start one, wait for expiry ≈24h or expire it in the dashboard) — the
   pending order self-cancels.

## 4. Flip to live

1. Set `STRIPE_MODE=live` (or delete it — live is the default).
2. Confirm `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` are the **live** pair
   and the live webhook endpoint (step 2) shows **Enabled**.
3. Make one small real purchase and refund it from the admin screen.

## 5. What the platform does for you (no action needed)

- **Server-authoritative pricing** — `createCheckout` prices every line item
  from the database; the client can only send product ids + quantities.
- **Payment truth** — only Stripe's `payment_status` (via webhook +
  `verifyCheckoutReturn`) can mark an order paid. Success URLs prove nothing.
- **Idempotency** — duplicate webhook deliveries and double-clicked refunds
  are absorbed; a refund can never be issued twice for the same request.
- **Oversell detection** — if paid quantity exceeded stock at payment time the
  order is flagged for review instead of silently shipping air.
- **Refund reconciliation** — refunds issued straight from the Stripe
  dashboard flow back onto the order via `charge.refunded`.
- **Amount binding** — a session only confirms if its amount, currency, app id,
  order id, and session id all match the order row created for it.

## Troubleshooting

| Symptom | Check |
|---|---|
| Order stays **Pending** after a successful test payment | Webhook endpoint URL exact? Signing secret matches the mode you're in? Stripe → Webhooks → the endpoint → recent deliveries shows the response body. |
| Webhook deliveries show `Stripe is not configured for … mode` | `STRIPE_MODE` points at a mode whose `STRIPE_SECRET_KEY[_TEST]` isn't set. |
| `Webhook signature verification failed` | Wrong `whsec_…` (each endpoint has its own), or the secret was rotated in Stripe but not in Supabase. |
| **Refund via Stripe** button shows **Record Refund** instead | The order has no `stripe_session_id`/`stripe_payment_intent_id` (pre-Stripe or manual order) — record-only is correct for it. |
| Checkout returns to the wrong domain | Add the domain to `CHECKOUT_ALLOWED_ORIGINS`. |
