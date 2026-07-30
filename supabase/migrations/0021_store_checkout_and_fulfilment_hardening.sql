-- Atomic Stripe checkout/payment processing, promo audit fields, durable
-- throttling, and fulfilment guards. Active checkout uses a fixed $15 domestic
-- rate (free from $150) and does not call a carrier API.

alter table public.store_orders
  add column if not exists checkout_request_id text,
  add column if not exists checkout_expires_at timestamptz,
  add column if not exists merchandise_subtotal_aud numeric,
  add column if not exists discount_amount_aud numeric not null default 0,
  add column if not exists promo_code text,
  add column if not exists stripe_promotion_code_id text,
  add column if not exists stripe_refund_status text;

create unique index if not exists store_orders_checkout_request_uidx
  on public.store_orders (checkout_request_id)
  where checkout_request_id is not null;
create unique index if not exists store_orders_stripe_session_uidx
  on public.store_orders (stripe_session_id)
  where stripe_session_id is not null;
create index if not exists store_orders_status_created_idx
  on public.store_orders (status, created_date desc);

create table if not exists public.checkout_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts > 0),
  updated_at timestamptz not null default now()
);
alter table public.checkout_rate_limits enable row level security;
revoke all on table public.checkout_rate_limits from anon, authenticated, public;
create index if not exists checkout_rate_limits_updated_idx
  on public.checkout_rate_limits (updated_at);

create or replace function public.claim_checkout_attempt(
  p_key_hash text,
  p_limit integer default 8,
  p_window_seconds integer default 600
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.checkout_rate_limits%rowtype;
  v_now timestamptz := now();
  v_window interval;
begin
  if p_key_hash is null or length(p_key_hash) < 32 then
    raise exception 'Invalid checkout throttle key';
  end if;
  if p_limit < 1 or p_limit > 100 or p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'Invalid checkout throttle configuration';
  end if;
  v_window := make_interval(secs => p_window_seconds);
  delete from public.checkout_rate_limits where updated_at < v_now - interval '2 days';

  select * into v_row
    from public.checkout_rate_limits
    where key_hash = p_key_hash
    for update;
  if not found then
    insert into public.checkout_rate_limits (key_hash, window_started_at, attempts, updated_at)
    values (p_key_hash, v_now, 1, v_now);
    return query select true, 0;
    return;
  end if;
  if v_row.window_started_at + v_window <= v_now then
    update public.checkout_rate_limits
      set window_started_at = v_now, attempts = 1, updated_at = v_now
      where key_hash = p_key_hash;
    return query select true, 0;
    return;
  end if;
  if v_row.attempts >= p_limit then
    return query select false,
      greatest(1, ceil(extract(epoch from (v_row.window_started_at + v_window - v_now)))::integer);
    return;
  end if;
  update public.checkout_rate_limits
    set attempts = attempts + 1, updated_at = v_now
    where key_hash = p_key_hash;
  return query select true, 0;
end;
$$;
revoke execute on function public.claim_checkout_attempt(text, integer, integer)
  from anon, authenticated, public;
grant execute on function public.claim_checkout_attempt(text, integer, integer)
  to service_role;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  session_id text,
  order_id text,
  result text not null default 'processing',
  processed_at timestamptz not null default now()
);
alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from anon, authenticated, public;

-- One transaction claims the event, locks the order/product rows, decrements
-- aggregate and per-size stock, writes the structured Stripe address and marks
-- payment verified. Duplicate webhooks cannot decrement inventory twice.
create or replace function public.process_store_order_payment(
  p_event_id text,
  p_event_type text,
  p_order_id text,
  p_session_id text,
  p_payment_intent_id text,
  p_customer_email text,
  p_customer_name text,
  p_shipping_address text,
  p_shipping jsonb,
  p_paid_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed integer;
  v_order public.store_orders%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_product_id text;
  v_size text;
  v_qty integer;
  v_available integer;
  v_variant_available integer;
  v_variant_found boolean;
  v_sizes jsonb;
  v_oversold boolean := false;
  v_oversold_details jsonb := '[]'::jsonb;
  v_timeline jsonb;
begin
  if coalesce(length(trim(p_event_id)), 0) = 0
     or coalesce(length(trim(p_order_id)), 0) = 0
     or coalesce(length(trim(p_session_id)), 0) = 0 then
    raise exception 'Missing payment identifiers';
  end if;

  insert into public.stripe_webhook_events (event_id, event_type, session_id, order_id)
  values (p_event_id, p_event_type, p_session_id, p_order_id)
  on conflict (event_id) do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then
    return jsonb_build_object('result', 'duplicate_event');
  end if;

  select * into v_order
    from public.store_orders
    where id = p_order_id
    for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.stripe_session_id is distinct from p_session_id then
    raise exception 'Checkout session does not match order';
  end if;
  if v_order.payment_verified_at is not null then
    update public.stripe_webhook_events
      set result = 'duplicate_order', processed_at = now()
      where event_id = p_event_id;
    return jsonb_build_object('result', 'duplicate_order', 'order_id', v_order.id);
  end if;

  for v_item in
    select value from jsonb_array_elements(coalesce(v_order.line_items, '[]'::jsonb))
  loop
    v_product_id := nullif(trim(v_item ->> 'product_id'), '');
    v_size := trim(coalesce(v_item ->> 'size', ''));
    v_qty := least(20, greatest(1, coalesce((v_item ->> 'quantity')::integer, 1)));
    if v_product_id is null then continue; end if;

    select * into v_product
      from public.products
      where id = v_product_id
      for update;
    if not found then
      v_oversold := true;
      v_oversold_details := v_oversold_details || jsonb_build_array(
        jsonb_build_object('product_id', v_product_id, 'size', v_size, 'ordered', v_qty, 'available', 0, 'reason', 'missing_product')
      );
      continue;
    end if;

    v_available := greatest(0, trunc(v_product.stock_quantity)::integer);
    if v_qty > v_available then
      v_oversold := true;
      v_oversold_details := v_oversold_details || jsonb_build_array(
        jsonb_build_object('product_id', v_product_id, 'size', v_size, 'ordered', v_qty, 'available', v_available, 'reason', 'total_stock')
      );
    end if;

    v_sizes := coalesce(v_product.sizes, '[]'::jsonb);
    if v_size <> '' and jsonb_array_length(v_sizes) > 0 then
      v_variant_found := false;
      select true, greatest(0, trunc(coalesce((entry ->> 'stock_quantity')::numeric, 0))::integer)
        into v_variant_found, v_variant_available
        from jsonb_array_elements(v_sizes) as variants(entry)
        where lower(trim(entry ->> 'size')) = lower(v_size)
        limit 1;
      if not coalesce(v_variant_found, false) then
        v_oversold := true;
        v_oversold_details := v_oversold_details || jsonb_build_array(
          jsonb_build_object('product_id', v_product_id, 'size', v_size, 'ordered', v_qty, 'available', 0, 'reason', 'missing_variant')
        );
      else
        if v_qty > v_variant_available then
          v_oversold := true;
          v_oversold_details := v_oversold_details || jsonb_build_array(
            jsonb_build_object('product_id', v_product_id, 'size', v_size, 'ordered', v_qty, 'available', v_variant_available, 'reason', 'variant_stock')
          );
        end if;
        select coalesce(jsonb_agg(
          case when lower(trim(entry ->> 'size')) = lower(v_size)
            then jsonb_set(entry, '{stock_quantity}', to_jsonb(greatest(0, v_variant_available - v_qty)), true)
            else entry end
          order by ordinal
        ), '[]'::jsonb)
          into v_sizes
          from jsonb_array_elements(v_sizes) with ordinality as variants(entry, ordinal);
      end if;
    end if;

    update public.products
      set stock_quantity = greatest(0, v_available - v_qty),
          sizes = v_sizes
      where id = v_product_id;
  end loop;

  v_timeline := coalesce(v_order.timeline, '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
      'action', 'payment_confirmed',
      'timestamp', coalesce(p_paid_at, now()),
      'note', 'Stripe payment verified',
      'actor', 'stripe'
    ));
  if v_oversold then
    v_timeline := v_timeline || jsonb_build_array(jsonb_build_object(
      'action', 'stock_oversold',
      'timestamp', coalesce(p_paid_at, now()),
      'note', 'One or more paid items exceeded available inventory',
      'actor', 'system',
      'details', v_oversold_details
    ));
  end if;

  update public.store_orders
    set status = 'paid',
        stripe_session_id = p_session_id,
        stripe_payment_intent_id = nullif(trim(p_payment_intent_id), ''),
        customer_email = coalesce(nullif(trim(p_customer_email), ''), customer_email),
        customer_name = coalesce(nullif(trim(p_customer_name), ''), customer_name),
        stripe_payment_status = 'paid',
        payment_verified_at = coalesce(p_paid_at, now()),
        shipping_address = coalesce(nullif(trim(p_shipping_address), ''), shipping_address),
        shipping_name = coalesce(nullif(p_shipping ->> 'name', ''), shipping_name),
        shipping_address_line1 = coalesce(nullif(p_shipping ->> 'line1', ''), shipping_address_line1),
        shipping_address_line2 = coalesce(nullif(p_shipping ->> 'line2', ''), shipping_address_line2),
        shipping_suburb = coalesce(nullif(p_shipping ->> 'city', ''), shipping_suburb),
        shipping_state = coalesce(nullif(p_shipping ->> 'state', ''), shipping_state),
        shipping_postcode = coalesce(nullif(p_shipping ->> 'postal_code', ''), shipping_postcode),
        shipping_country = coalesce(nullif(p_shipping ->> 'country', ''), shipping_country),
        stock_oversold = v_oversold,
        customer_status_note = case
          when v_oversold then 'Payment confirmed. One or more items sold out as you ordered — our team will contact you.'
          else 'Payment confirmed. Your order is being prepared.'
        end,
        timeline = v_timeline
    where id = v_order.id;

  update public.stripe_webhook_events
    set result = case when v_oversold then 'processed_oversold' else 'processed' end,
        processed_at = now()
    where event_id = p_event_id;
  return jsonb_build_object(
    'result', 'processed',
    'order_id', v_order.id,
    'oversold', v_oversold,
    'oversold_details', v_oversold_details
  );
end;
$$;
revoke execute on function public.process_store_order_payment(
  text, text, text, text, text, text, text, text, jsonb, timestamptz
) from anon, authenticated, public;
grant execute on function public.process_store_order_payment(
  text, text, text, text, text, text, text, text, jsonb, timestamptz
) to service_role;

-- Browser/admin writes may update fulfilment details, but never Stripe-owned
-- money/payment fields. They also cannot mark an order shipped without payment,
-- manual carrier/tracking, and a complete structured Australian address.
create or replace function public.protect_store_order_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce((select auth.role()), '') = 'service_role'
     or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
    return new;
  end if;

  if new.total_aud is distinct from old.total_aud
     or new.subtotal_aud is distinct from old.subtotal_aud
     or new.merchandise_subtotal_aud is distinct from old.merchandise_subtotal_aud
     or new.discount_amount_aud is distinct from old.discount_amount_aud
     or new.promo_code is distinct from old.promo_code
     or new.stripe_promotion_code_id is distinct from old.stripe_promotion_code_id
     or new.line_items is distinct from old.line_items
     or new.stripe_session_id is distinct from old.stripe_session_id
     or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
     or new.stripe_payment_status is distinct from old.stripe_payment_status
     or new.payment_verified_at is distinct from old.payment_verified_at
     or new.checkout_request_id is distinct from old.checkout_request_id
     or new.checkout_expires_at is distinct from old.checkout_expires_at
     or new.shipping_service_code is distinct from old.shipping_service_code
     or new.shipping_service_name is distinct from old.shipping_service_name
     or new.shipping_cost_aud is distinct from old.shipping_cost_aud
     or new.fulfilment_method is distinct from old.fulfilment_method
     or new.gst_amount_aud is distinct from old.gst_amount_aud
     or new.gst_rate_percent is distinct from old.gst_rate_percent
     or new.gst_included is distinct from old.gst_included
     or new.card_fee_aud is distinct from old.card_fee_aud
     or new.card_fee_included is distinct from old.card_fee_included
     or new.stripe_refund_id is distinct from old.stripe_refund_id
     or new.stripe_refund_status is distinct from old.stripe_refund_status
     or new.refund_amount is distinct from old.refund_amount
     or new.refund_reason is distinct from old.refund_reason
     or new.refunded_at is distinct from old.refunded_at then
    raise exception 'Payment and checkout fields are managed by Stripe workflows';
  end if;

  if new.status is distinct from old.status then
    if new.status in ('paid', 'refunded', 'partially_refunded') then
      raise exception 'Use the Stripe payment/refund workflow for this status';
    end if;
    if not (
      (old.status = 'pending' and new.status = 'cancelled')
      or (old.status = 'paid' and new.status in ('packing', 'shipped'))
      or (old.status = 'packing' and new.status = 'shipped')
      or (
        old.status in ('paid', 'packing')
        and new.status = 'completed'
        and old.fulfilment_method in ('pickup', 'none')
      )
      or (old.status = 'shipped' and new.status = 'completed')
    ) then
      raise exception 'Invalid order status transition from % to %', old.status, new.status;
    end if;
  end if;

  if new.status in ('packing', 'shipped', 'completed') and old.payment_verified_at is null then
    raise exception 'Payment must be verified before fulfilment';
  end if;
  if new.status = 'shipped' and new.fulfilment_method <> 'shipping' then
    raise exception 'Only delivery orders can be marked shipped';
  end if;
  if new.status = 'shipped'
     and (coalesce(trim(new.tracking_number), '') = '' or coalesce(trim(new.carrier), '') = '') then
    raise exception 'Carrier and tracking number are required before shipping';
  end if;
  if new.status = 'shipped' and not (
    coalesce(trim(new.shipping_address_line1), '') <> ''
    and coalesce(trim(new.shipping_suburb), '') <> ''
    and coalesce(trim(new.shipping_state), '') <> ''
    and coalesce(trim(new.shipping_postcode), '') ~ '^[0-9]{4}$'
    and upper(coalesce(trim(new.shipping_country), '')) = 'AU'
  ) then
    raise exception 'A complete structured Australian shipping address is required before shipping';
  end if;
  return new;
end;
$$;

drop trigger if exists store_orders_protect_integrity on public.store_orders;
create trigger store_orders_protect_integrity
before update on public.store_orders
for each row execute function public.protect_store_order_integrity();
revoke execute on function public.protect_store_order_integrity()
  from anon, authenticated, public;
