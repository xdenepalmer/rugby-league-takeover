-- Items that don't ship, and the placeholder weight that was quietly inflating
-- every multi-item order.
--
-- 1. shipping_required
--    A membership (and anything else digital) is sitting in the store as a
--    normal product, so it currently attracts postage. Buying only a membership
--    charges the customer to post nothing. Default true so existing physical
--    stock is unaffected; turn it off per item.
alter table public.products
  add column if not exists shipping_required boolean not null default true;

comment on column public.products.shipping_required is
  'False for digital/non-physical items. A cart containing only these skips shipping entirely.';

-- A digital-only order is neither shipped nor collected, so store_orders needs a
-- third fulfilment value. Without this the insert fails the existing CHECK and
-- the customer's payment succeeds while the order never lands.
do $$
declare c record; m_attnum smallint;
begin
  select attnum into m_attnum from pg_attribute
   where attrelid = 'public.store_orders'::regclass
     and attname = 'fulfilment_method' and not attisdropped;

  for c in
    select conname from pg_constraint
     where conrelid = 'public.store_orders'::regclass
       and contype = 'c' and conkey = array[m_attnum]
  loop
    execute format('alter table public.store_orders drop constraint %I', c.conname);
  end loop;

  execute $ddl$
    alter table public.store_orders
      add constraint store_orders_fulfilment_method_check
      check (fulfilment_method in ('shipping', 'pickup', 'none'))
  $ddl$;
end $$;

-- 2. weight_grams
--    Every product still carries the 300g form default with no real weight, and
--    auspostRates multiplies it by quantity. Two ~40g stubbie coolers therefore
--    declared 600g, crossing AusPost''s 500g bracket and pricing at $16.00
--    instead of the $11.70 minimum. The rate code no longer invents a weight
--    silently, and the admin flags anything left unset — but existing rows need
--    real numbers entered before quotes are trustworthy.
comment on column public.products.weight_grams is
  'Real per-unit weight in grams. Multiplied by quantity for the AusPost quote, so a placeholder value overcharges every multi-item order.';
