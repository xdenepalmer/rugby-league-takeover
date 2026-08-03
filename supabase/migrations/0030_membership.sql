-- ---------------------------------------------------------------------------
-- 0030 — RLT Membership: a real, time-bounded entitlement.
--
-- Until now "membership" was only a store product: buying it created a paid
-- store_orders row and did nothing whatsoever to the buyer's account. There
-- was no notion of being a member, no expiry, no badge, and nothing a bar
-- could check.
--
-- Design notes:
--   * Expiry is evaluated AT READ TIME (public.membership_active). There is no
--     cron in this project, so a nightly "flip to expired" job would be a lie
--     waiting to happen — the timestamp is the truth.
--   * A membership is granted by the SAME idempotent transaction that confirms
--     a Stripe payment, so a member is created exactly once per paid order.
--   * Which SKU grants membership is data, not a hardcoded id: any product can
--     carry membership_months (12 for the annual RLT membership).
--   * membership_number is the human-readable identity on the card. It is
--     stable for life once issued, so a renewal keeps the same number.
-- ---------------------------------------------------------------------------

-- 1. Entitlement columns on the single user record.
alter table public.profiles
  add column if not exists membership_started_at timestamptz,
  add column if not exists membership_expires_at timestamptz,
  add column if not exists membership_number text,
  add column if not exists membership_source text;

comment on column public.profiles.membership_expires_at is
  'When the RLT membership lapses. NULL = never been a member. Compared against now() at read time — there is no expiry sweep.';
comment on column public.profiles.membership_number is
  'Human-readable member number shown on the membership card (RLT-XXXXXX). Stable across renewals.';
comment on column public.profiles.membership_source is
  'How the current membership was granted: store order id, or admin:<profile id> for a comped one.';

create unique index if not exists profiles_membership_number_uidx
  on public.profiles (membership_number)
  where membership_number is not null;

create index if not exists profiles_membership_expires_idx
  on public.profiles (membership_expires_at)
  where membership_expires_at is not null;

-- 2. A member must NEVER be able to grant themselves membership.
--    profiles is self-updatable (RLS), so every server-owned column has to be
--    reverted here for non-admin writers. Missing one is a self-serve
--    entitlement bug — this trigger is the only thing standing in the way.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    new.role := old.role;
    new.disabled := old.disabled;
    new.auth_user_id := old.auth_user_id;
    new.email := old.email;
    new.is_verified := old.is_verified;
    new.created_date := old.created_date;
    new.casino_xp := old.casino_xp;
    new.casino_chips := old.casino_chips;
    new.casino_rank := old.casino_rank;
    new.casino_streak := old.casino_streak;
    new.casino_last_active_date := old.casino_last_active_date;
    new.casino_total_posts := old.casino_total_posts;
    new.casino_total_replies := old.casino_total_replies;
    new.casino_total_reactions_given := old.casino_total_reactions_given;
    new.casino_total_reactions_received := old.casino_total_reactions_received;
    new.badges := old.badges;
    new.slot_last_spin_date := old.slot_last_spin_date;
    new.slot_total_spins := old.slot_total_spins;
    new.slot_streak := old.slot_streak;
    new.slot_extra_date := old.slot_extra_date;
    new.slot_extra_count := old.slot_extra_count;
    new.daily_bonus_date := old.daily_bonus_date;
    -- Membership is paid-for: server-owned, never self-writable.
    new.membership_started_at := old.membership_started_at;
    new.membership_expires_at := old.membership_expires_at;
    new.membership_number := old.membership_number;
    new.membership_source := old.membership_source;
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_profile_columns() from anon, authenticated, public;

-- 3. Which products grant membership, and for how long.
alter table public.products
  add column if not exists membership_months integer not null default 0;

comment on column public.products.membership_months is
  'Months of RLT membership granted per unit purchased. 0 = ordinary merch. 12 = the annual membership.';

alter table public.products
  drop constraint if exists products_membership_months_check;
alter table public.products
  add constraint products_membership_months_check
  check (membership_months >= 0 and membership_months <= 120);

-- 4. Read-time membership predicate. Mirrors the is_admin()/is_moderator()
--    pattern (0001) so RLS policies and views can consult it.
create or replace function public.membership_active(p_expires timestamptz)
returns boolean
language sql immutable
as $$ select p_expires is not null and p_expires > now() $$;

create or replace function public.is_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where auth_user_id = auth.uid()
      and membership_expires_at is not null
      and membership_expires_at > now()
  );
$$;

grant execute on function public.membership_active(timestamptz) to anon, authenticated;
grant execute on function public.is_member() to anon, authenticated;

-- 5. Member number allocator. RLT-000001 upward, skipping any collision.
create sequence if not exists public.membership_number_seq start 1001;

create or replace function public.next_membership_number()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_candidate text;
begin
  loop
    v_candidate := 'RLT-' || lpad(nextval('public.membership_number_seq')::text, 6, '0');
    exit when not exists (select 1 from public.profiles where membership_number = v_candidate);
  end loop;
  return v_candidate;
end;
$$;

revoke execute on function public.next_membership_number() from anon, authenticated, public;

-- Assign a member number WITHOUT touching the term. Needed for members who
-- predate the allocator and for admin comps — routing this through
-- grant_membership would silently add a month to their membership.
create or replace function public.ensure_membership_number(p_profile_id text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_number text;
begin
  select nullif(trim(membership_number), '') into v_number
    from public.profiles where id = p_profile_id for update;
  if v_number is not null then return v_number; end if;
  v_number := public.next_membership_number();
  update public.profiles set membership_number = v_number where id = p_profile_id;
  return v_number;
end;
$$;

revoke execute on function public.ensure_membership_number(text) from anon, authenticated, public;
grant execute on function public.ensure_membership_number(text) to service_role;

-- 6. Grant / extend. Renewing while still active EXTENDS from the existing
--    expiry (you never lose time you paid for); renewing after lapsing starts
--    a fresh term from today.
create or replace function public.grant_membership(
  p_profile_id text,
  p_months integer,
  p_source text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_base timestamptz;
  v_expires timestamptz;
  v_number text;
  v_months integer := greatest(1, least(120, coalesce(p_months, 12)));
begin
  select * into v_profile from public.profiles where id = p_profile_id for update;
  if not found then
    return jsonb_build_object('result', 'no_profile');
  end if;

  v_base := case
    when v_profile.membership_expires_at is not null and v_profile.membership_expires_at > now()
      then v_profile.membership_expires_at
    else now()
  end;
  v_expires := v_base + make_interval(months => v_months);
  v_number := coalesce(nullif(trim(v_profile.membership_number), ''), public.next_membership_number());

  update public.profiles
    set membership_number = v_number,
        membership_started_at = coalesce(v_profile.membership_started_at, now()),
        membership_expires_at = v_expires,
        membership_source = coalesce(nullif(trim(p_source), ''), v_profile.membership_source)
    where id = p_profile_id;

  return jsonb_build_object(
    'result', 'granted',
    'membership_number', v_number,
    'expires_at', v_expires,
    'months', v_months,
    'renewed', v_profile.membership_expires_at is not null and v_profile.membership_expires_at > now()
  );
end;
$$;

revoke execute on function public.grant_membership(text, integer, text) from anon, authenticated, public;
grant execute on function public.grant_membership(text, integer, text) to service_role;

-- 7. Revoke (admin action / refund). Keeps the member number so a later
--    re-join reuses the same identity.
create or replace function public.revoke_membership(p_profile_id text, p_source text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles
    set membership_expires_at = now(),
        membership_source = coalesce(nullif(trim(p_source), ''), membership_source)
    where id = p_profile_id;
  if not found then return jsonb_build_object('result', 'no_profile'); end if;
  return jsonb_build_object('result', 'revoked');
end;
$$;

revoke execute on function public.revoke_membership(text, text) from anon, authenticated, public;
grant execute on function public.revoke_membership(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Grant membership as part of confirming payment.
--
-- Same function as 0021 with one addition: while walking the paid line items
-- it accumulates membership months and, at the end, grants them to the
-- ordering account. It lives INSIDE the idempotent transaction — the caller
-- already bails on a duplicate event — so a Stripe retry can never double the
-- term. Guest checkouts (user_id null) can't be granted: the order timeline
-- records that so an admin can attach it by hand.
-- ---------------------------------------------------------------------------
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
  v_membership_months integer := 0;
  v_membership jsonb := null;
  v_member_profile text;
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

    -- Membership entitlement comes from the PRODUCT row, never the client.
    if coalesce(v_product.membership_months, 0) > 0 then
      v_membership_months := v_membership_months + (v_product.membership_months * v_qty);
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

  -- Membership grant. Prefer the account that placed the order; fall back to
  -- matching the checkout email so a member who checked out signed-out still
  -- gets what they paid for.
  if v_membership_months > 0 then
    v_member_profile := nullif(trim(coalesce(v_order.user_id, '')), '');
    if v_member_profile is null then
      select id into v_member_profile
        from public.profiles
        where lower(email) = lower(nullif(trim(coalesce(p_customer_email, v_order.customer_email, '')), ''))
        limit 1;
    end if;

    if v_member_profile is not null then
      v_membership := public.grant_membership(
        v_member_profile,
        v_membership_months,
        'order:' || v_order.id
      );
      v_timeline := v_timeline || jsonb_build_array(jsonb_build_object(
        'action', 'membership_granted',
        'timestamp', coalesce(p_paid_at, now()),
        'note', format('%s months of RLT membership — expires %s',
          v_membership_months, to_char((v_membership ->> 'expires_at')::timestamptz, 'DD Mon YYYY')),
        'actor', 'system',
        'details', v_membership
      ));
    else
      -- Paid for, but no account to attach it to. Surface it loudly rather
      -- than silently swallowing an entitlement someone bought.
      v_timeline := v_timeline || jsonb_build_array(jsonb_build_object(
        'action', 'membership_unassigned',
        'timestamp', coalesce(p_paid_at, now()),
        'note', format('%s months of membership paid for with no matching account — assign manually.', v_membership_months),
        'actor', 'system'
      ));
    end if;
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
    'oversold_details', v_oversold_details,
    'membership', v_membership
  );
end;
$$;

revoke execute on function public.process_store_order_payment(
  text, text, text, text, text, text, text, text, jsonb, timestamptz
) from anon, authenticated, public;
grant execute on function public.process_store_order_payment(
  text, text, text, text, text, text, text, text, jsonb, timestamptz
) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Public member directory for the forum badge.
--
-- profiles is self/admin-only under RLS, so the browser cannot read another
-- member's row. The forum already gets its per-author flair from the
-- forumAvatars edge function; this view gives that function (and anything
-- else) a cheap, minimal, PUBLIC projection: who is currently a member, and
-- nothing else. No dates, no number, no email — membership status is a badge
-- people wear in public, the rest is theirs.
-- ---------------------------------------------------------------------------
create or replace view public.forum_members_view
with (security_barrier = true)
as
select id as profile_id
from public.profiles
where disabled = false
  and membership_expires_at is not null
  and membership_expires_at > now();

grant select on public.forum_members_view to anon, authenticated;
