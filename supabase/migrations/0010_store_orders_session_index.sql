-- 0010: index store_orders.stripe_session_id (RLT-IOS-003 correction wave).
--
-- verifyCheckoutReturn (unauthenticated, read-only) resolves orders by
-- stripe_session_id BEFORE calling Stripe. Without an index every probe is a
-- sequential scan of store_orders — an unauthenticated caller could drive
-- unbounded full-table scans. A partial UNIQUE index makes the lookup O(log n)
-- and guarantees the double-bind's maybeSingle() can never hit an ambiguous
-- duplicate (it would fail closed today, but the invariant belongs in the
-- schema). Empty/legacy values are excluded so pre-Stripe rows don't collide.
create unique index store_orders_stripe_session_idx
  on public.store_orders (stripe_session_id)
  where stripe_session_id is not null and stripe_session_id <> '';
