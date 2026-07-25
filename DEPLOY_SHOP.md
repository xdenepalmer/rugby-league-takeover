# Deploy: real Stripe refunds, cancel + shop hardening

Everything below is already written, tested and committed on
`claude/supabase-migration-f5no9k`. This is the live-deploy step.

**Why it matters:** the admin "Issue Refund" button used to only write
`status = 'refunded'` to the order row — it never called Stripe, so customers
were never actually refunded. After this deploy, refunds move real money.

Two steps, in this order: **① database migration → ② edge functions.**
The frontend (already on the branch) needs no separate deploy beyond your normal
Vercel build.

---

## ① Database migration

Adds the refund/cancel columns, the `partially_refunded` status, and the
indexes the orders table never had. It is additive, re-runnable, and touches no
existing data.

**Easiest path — Supabase SQL editor** (no DB password needed):

1. Open the [SQL editor](https://supabase.com/dashboard/project/ohytlrgfpcpvnqgdpqap/sql/new).
2. Paste the entire contents of `supabase/migrations/0010_store_refunds.sql`.
3. Run. Expect `Success. No rows returned`.

**Or via CLI** (needs the DB password):

```bash
export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx
npx supabase@2 link --project-ref ohytlrgfpcpvnqgdpqap
npx supabase@2 db push
```

### Verify the migration

```sql
-- 1. the five new columns exist
select column_name from information_schema.columns
where table_name = 'store_orders'
  and column_name in ('stripe_refund_id','stripe_payment_intent_id',
                      'cancelled_at','cancel_reason','restocked_at');
-- expect 5 rows

-- 2. the status check now allows partially_refunded
select pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.store_orders'::regclass and contype = 'c';
-- expect a check listing ... 'refunded', 'partially_refunded'

-- 3. indexes are in place
select indexname from pg_indexes where tablename = 'store_orders';
-- expect store_orders_stripe_session_idx, _status_idx, _created_idx, _user_email_idx
```

---

## ② Edge functions

```bash
export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx    # supabase.com/dashboard/account/tokens
./scripts/deploy-shop-backend.sh
```

That deploys four functions (safe to re-run — each deploy is a new version):

| Function | Change | JWT |
|---|---|---|
| `stripeRefund` | **new** — real Stripe refund, admin-only, idempotent, partial/full, restocks on full | off (self-auth + `role==='admin'`) |
| `cancelOrder` | **new** — cancel + guarded restock, no auto-refund | off (self-auth + `role==='admin'`) |
| `createCheckout` | hardened — no longer leaks internal errors | off (public guest checkout) |
| `stripeWebhook` | hardened — acks permanently-invalid events so Stripe stops retrying forever | off (Stripe signs the request) |

`--no-verify-jwt` is deliberate: each function authenticates in its own body.
`stripeRefund`/`cancelOrder` resolve the caller's profile from the bearer token
and reject anyone who isn't an admin.

> **Stripe mode:** refunds use the same `STRIPE_MODE` secret as checkout
> (`test` or `live`). Refunding a **live** order requires `STRIPE_MODE=live`,
> otherwise Stripe can't find the payment intent.

### Verify the functions

1. Admin → Orders → expand any **paid** order.
2. Confirm you see: **Ship To** address block, **Edit**, **Print slip**,
   **Issue Refund**, **Cancel Order**.
3. Safest live test — refund **$0.50** on a real paid order:
   - expect the toast *"Partial refund issued"*,
   - the order flips to **Part. Refunded**,
   - the refund appears in the [Stripe dashboard](https://dashboard.stripe.com/payments) within seconds,
   - the timeline gains a "Refunded $0.50 AUD via Stripe" entry.
4. Then refund the remainder to confirm it flips to **Refunded** and restocks.

---

## Behaviour you chose

- **Refund** restocks the items — but only on a *full* refund, and only once
  (guarded by `restocked_at`, so a later cancel can't double-count stock).
- **Partial refunds** are supported; the order shows `Part. Refunded` and how
  much is left to refund. Repeated partials can never exceed the order total.
- **Cancel** marks the order cancelled and returns stock for a paid order, but
  does **not** auto-refund — issue the refund separately if money is owed. The
  UI warns you when cancelling a paid order.
- Refunded/cancelled statuses were removed from the manual status dropdown, so
  they can only be reached through the actions that actually move money/stock.

## Rollback

The migration is additive — nothing needs undoing. To revert the code, redeploy
the previous function versions from the Supabase dashboard
(Edge Functions → *function* → Versions), or `git revert` the commits and re-run
the deploy script. Refunds already issued in Stripe are, of course, permanent.
