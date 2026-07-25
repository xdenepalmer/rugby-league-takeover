-- Real Stripe refunds + cancellations for the store admin.
--
-- The "Issue Refund" button previously only wrote status='refunded' to the row
-- — it never called Stripe, so no money moved. These columns back a
-- server-authoritative stripeRefund/cancelOrder edge function that actually
-- processes the refund and (once) restocks inventory.

alter table public.store_orders
  add column if not exists stripe_refund_id text,          -- Stripe refund object id (audit + idempotency)
  add column if not exists stripe_payment_intent_id text,  -- cached from the checkout session for refunds
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists restocked_at timestamptz;       -- set once when items are returned to stock

-- Allow a 'partially_refunded' status. The original inline CHECK is dropped by
-- discovered name (it's auto-generated), then re-added with the extra value.
do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.store_orders'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';
  if c is not null then
    execute format('alter table public.store_orders drop constraint %I', c);
  end if;
end $$;

alter table public.store_orders
  add constraint store_orders_status_check
  check (status in ('pending', 'paid', 'packing', 'shipped', 'completed', 'cancelled', 'refunded', 'partially_refunded'));

-- Indexes the store had none of beyond the PK. The webhook looks orders up by
-- stripe_session_id on every Stripe event (idempotency), the admin list sorts
-- by created_date and filters by status, and customers read their own orders
-- by lower(user_email) — all full table scans until now.
create index if not exists store_orders_stripe_session_idx on public.store_orders (stripe_session_id);
create index if not exists store_orders_status_idx on public.store_orders (status);
create index if not exists store_orders_created_idx on public.store_orders (created_date desc);
create index if not exists store_orders_user_email_idx on public.store_orders (lower(user_email));
