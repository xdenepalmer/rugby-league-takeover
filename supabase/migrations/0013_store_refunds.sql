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

-- Allow a 'partially_refunded' status. The original inline CHECK has an
-- auto-generated name, so it's found by the COLUMN it constrains rather than by
-- name or by a text match on its definition — matching '%status%' in the
-- definition would be ambiguous (store_orders also has stripe_payment_status /
-- customer_status_note columns and a shipping_method CHECK). conkey pins it to
-- single-column CHECKs on exactly `status`. Loops so re-running is safe and
-- multiple matches are all cleared before the new constraint is added.
-- Don't queue behind a long transaction and stall the store. Plain SET (not SET
-- LOCAL) so it works whether or not the runner wraps this in a transaction.
set lock_timeout = '5s';

-- The DROP and the re-ADD happen inside ONE DO block (a single statement, so a
-- single implicit transaction): as separate statements, a failure after the
-- drop would leave store_orders with NO status constraint at all.
do $$
declare
  c record;
  status_attnum smallint;
begin
  select attnum into status_attnum
  from pg_attribute
  where attrelid = 'public.store_orders'::regclass
    and attname = 'status'
    and not attisdropped;

  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.store_orders'::regclass
      and contype = 'c'
      and conkey = array[status_attnum]
  loop
    execute format('alter table public.store_orders drop constraint %I', c.conname);
  end loop;

  execute $ddl$
    alter table public.store_orders
      add constraint store_orders_status_check
      check (status in ('pending', 'paid', 'packing', 'shipped', 'completed',
                        'cancelled', 'refunded', 'partially_refunded'))
  $ddl$;
end $$;

-- Indexes the store had none of beyond the PK. The webhook looks orders up by
-- stripe_session_id on every Stripe event (idempotency), the admin list sorts
-- by created_date and filters by status, and customers read their own orders
-- by lower(user_email) — all full table scans until now.
create index if not exists store_orders_stripe_session_idx on public.store_orders (stripe_session_id);
create index if not exists store_orders_status_idx on public.store_orders (status);
create index if not exists store_orders_created_idx on public.store_orders (created_date desc);
create index if not exists store_orders_user_email_idx on public.store_orders (lower(user_email));
