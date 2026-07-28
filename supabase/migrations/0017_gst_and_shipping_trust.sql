-- GST on checkout, and moving two money decisions off the client.
--
-- 1. GST
--    Calculated on the taxable supply (items + shipping). Both the rate and
--    whether it is passed on or absorbed are admin-controlled:
--
--      'added'    — exclusive. Added on top as its own line; the customer pays
--                   more than the sticker price.
--      'absorbed' — inclusive. The sticker price already contains the tax; the
--                   shop takes it out of margin and checkout only discloses the
--                   component. Note the component is rate/(100+rate) of the
--                   price, not rate/100 — 6.5% absorbed on $100 is $6.10, not
--                   $6.50.
--
--    The rate is a setting rather than a constant so it can be corrected without
--    a deploy — the ATO rate for Australian GST is 10%, and 6.5% was the rate
--    requested at build time.
--
-- 2. Card processing fee
--    Same absorb/add choice. 'added' is grossed up rather than a flat percentage,
--    because Stripe's percentage applies to the final amount including the
--    surcharge — charging percent x subtotal under-recovers on every order.
--    Off by default. In Australia a card surcharge must not exceed the actual
--    cost of acceptance (RBA standard, enforced by the ACCC), so the configured
--    percent and fixed amount should match the real Stripe pricing.
--
-- 3. Free-shipping threshold
--    Was a hardcoded 150 in the storefront, with the browser sending
--    price_aud: 0 whenever it decided the cart qualified. createCheckout took
--    that on trust, so a crafted request got free shipping on any order. The
--    threshold now lives here and the server applies it against prices it looks
--    up itself.
alter table public.site_settings
  add column if not exists gst_enabled boolean not null default true,
  add column if not exists gst_rate_percent numeric not null default 6.5,
  add column if not exists gst_mode text not null default 'added',
  add column if not exists gst_label text not null default 'GST',
  add column if not exists card_fee_enabled boolean not null default false,
  add column if not exists card_fee_percent numeric not null default 1.75,
  add column if not exists card_fee_fixed_aud numeric not null default 0.30,
  add column if not exists card_fee_mode text not null default 'absorbed',
  add column if not exists card_fee_label text not null default 'Card processing fee',
  add column if not exists free_shipping_threshold_aud numeric not null default 150;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.site_settings'::regclass
      and conname = 'site_settings_gst_rate_check'
  ) then
    -- A negative or absurd rate would silently distort every order total.
    alter table public.site_settings
      add constraint site_settings_gst_rate_check
      check (gst_rate_percent >= 0 and gst_rate_percent <= 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.site_settings'::regclass
      and conname = 'site_settings_gst_mode_check'
  ) then
    alter table public.site_settings
      add constraint site_settings_gst_mode_check
      check (gst_mode in ('added', 'absorbed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.site_settings'::regclass
      and conname = 'site_settings_card_fee_check'
  ) then
    alter table public.site_settings
      add constraint site_settings_card_fee_check
      check (
        card_fee_mode in ('added', 'absorbed')
        -- Below 100% so the gross-up divisor can never be zero or negative.
        and card_fee_percent >= 0 and card_fee_percent < 100
        and card_fee_fixed_aud >= 0
      );
  end if;
end $$;

-- What was actually charged, captured per order. The rate is stored alongside
-- the amount so a later rate change never rewrites the history of past orders.
alter table public.store_orders
  add column if not exists subtotal_aud numeric,
  add column if not exists gst_amount_aud numeric not null default 0,
  add column if not exists gst_rate_percent numeric,
  add column if not exists gst_included boolean not null default false,
  add column if not exists card_fee_aud numeric not null default 0,
  add column if not exists card_fee_included boolean not null default true;

comment on column public.site_settings.gst_rate_percent is
  'Percent applied to items + shipping at checkout. Australian GST is 10%; verify before relying on any other value.';
comment on column public.store_orders.gst_rate_percent is
  'Rate in force when this order was placed — kept so rate changes do not rewrite past orders.';
comment on column public.store_orders.gst_included is
  'True when the tax was absorbed (already inside total_aud) rather than charged on top.';
comment on column public.store_orders.card_fee_included is
  'True when the processing fee was absorbed by the shop — recorded as cost, not charged to the customer.';
