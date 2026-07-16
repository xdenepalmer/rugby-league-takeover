-- 0011: store the Stripe PaymentIntent id on orders (RLT-STRIPE-001).
--
-- Refunds move money against a PaymentIntent, not a Checkout Session. The
-- webhook records payment_intent when it marks an order paid so that:
--   • stripeRefund can issue a real Stripe refund without an extra
--     sessions.retrieve round-trip, and
--   • charge.refunded events (refunds issued from the Stripe dashboard) can
--     be reconciled back onto the order they belong to.
-- The partial index backs that reconciliation lookup, and is unique for the
-- same reason the session index is: one Stripe payment binds to one order.
alter table public.store_orders
  add column if not exists stripe_payment_intent_id text;

create unique index if not exists store_orders_stripe_payment_intent_idx
  on public.store_orders (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null and stripe_payment_intent_id <> '';
