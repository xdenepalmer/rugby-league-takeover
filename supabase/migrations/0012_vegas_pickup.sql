-- Vegas pickup fulfilment + Australia-only shipping.
--
-- Shipping is AusPost domestic, so it can only ever serve Australian
-- addresses. Overseas supporters instead collect their order in person at the
-- Las Vegas event. Both the feature and its audience are admin-controlled so
-- the option can be switched off out of season.
--
--   pickup_enabled   — master on/off for the collect-in-Vegas option
--   pickup_audience  — 'international' (non-AU only) | 'everyone'
--   pickup_label     — what the customer sees at checkout
--   pickup_instructions — where/when to collect, shown at checkout and on the order

alter table public.site_settings
  add column if not exists pickup_enabled boolean not null default false,
  add column if not exists pickup_audience text not null default 'international',
  add column if not exists pickup_label text,
  add column if not exists pickup_instructions text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.site_settings'::regclass
      and conname = 'site_settings_pickup_audience_check'
  ) then
    alter table public.site_settings
      add constraint site_settings_pickup_audience_check
      check (pickup_audience in ('international', 'everyone'));
  end if;
end $$;

-- How each order is fulfilled. Existing rows are all shipped orders, and the
-- NOT NULL default keeps the admin UI from having to treat NULL as a third
-- state. Pickup orders legitimately carry no address and get no AusPost label.
alter table public.store_orders
  add column if not exists fulfilment_method text not null default 'shipping';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.store_orders'::regclass
      and conname = 'store_orders_fulfilment_method_check'
  ) then
    alter table public.store_orders
      add constraint store_orders_fulfilment_method_check
      check (fulfilment_method in ('shipping', 'pickup'));
  end if;
end $$;
