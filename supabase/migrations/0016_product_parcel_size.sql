-- Per-product parcel size, so the shop decides the box and the customer only
-- decides the speed.
--
-- AusPost's service.json returns every domestic product that fits the declared
-- dimensions — Parcel Post and Express Post (both priced on actual weight), plus
-- every flat-rate satchel and box above that size. All of them were being handed
-- straight to the shopper, so a single t-shirt offered a "Large $25.20" option
-- next to the correct "$11.70", with several identically-named entries because
-- the satchel and box ranges share size words.
--
-- parcel_size is the largest packaging an item legitimately needs. The cart takes
-- the max across its items and anything bigger is filtered out of the quote.
alter table public.products
  add column if not exists parcel_size text not null default 'satchel';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_parcel_size_check'
  ) then
    alter table public.products
      add constraint products_parcel_size_check
      check (parcel_size in ('satchel', 'small', 'medium', 'large'));
  end if;
end $$;

comment on column public.products.parcel_size is
  'Largest AusPost packaging this item needs: satchel < small < medium < large. The cart uses the max across items and hides anything larger at checkout.';
