-- Defense-in-depth bounds on the fixed-shipping money columns, matching the
-- sibling GST/card-fee columns' style and the [0, $1000] guardrail the
-- application already applies (money-rules.js / createCheckout clampFlatRateCents
-- and clampOverrideCents). A DB-level check stops a malformed value from ever
-- landing, independent of the app. NOT VALID so existing in-range rows
-- (12.50 / 15.90 / NULL) are unaffected; new writes are checked.
alter table public.site_settings
  drop constraint if exists site_settings_shipping_flat_single_valid;
alter table public.site_settings
  add constraint site_settings_shipping_flat_single_valid
  check (shipping_flat_single_aud >= 0 and shipping_flat_single_aud <= 1000) not valid;

alter table public.site_settings
  drop constraint if exists site_settings_shipping_flat_multi_valid;
alter table public.site_settings
  add constraint site_settings_shipping_flat_multi_valid
  check (shipping_flat_multi_aud >= 0 and shipping_flat_multi_aud <= 1000) not valid;

alter table public.products
  drop constraint if exists products_flat_shipping_valid;
alter table public.products
  add constraint products_flat_shipping_valid
  check (flat_shipping_aud is null or (flat_shipping_aud >= 0 and flat_shipping_aud <= 1000)) not valid;
