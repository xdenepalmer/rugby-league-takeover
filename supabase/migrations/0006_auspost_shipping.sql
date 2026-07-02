-- AusPost shipping integration: live rate calculation, label generation and
-- tracking lookup. See MIGRATION-SUPABASE.md for the required Edge Function
-- secrets (AUSPOST_API_KEY, AUSPOST_ACCOUNT_NUMBER) and manual verification
-- steps — these calls are unverified against a live AusPost account and must
-- be smoke-tested with real credentials before relying on them in production.

-- Parcel weight/dimensions per product, used to build the AusPost rate-calc
-- request. Sensible apparel-merch defaults; admins can override per product.
alter table public.products
  add column weight_grams numeric not null default 300,
  add column length_cm numeric,
  add column width_cm numeric,
  add column height_cm numeric;

-- Sender ("from") address for both rate calculation and label creation.
-- Admin-editable via SiteSettingsManager; RLS already covers this table
-- (public read, admin write).
alter table public.site_settings
  add column shipping_sender_name text,
  add column shipping_sender_business_name text,
  add column shipping_sender_address_line1 text,
  add column shipping_sender_address_line2 text,
  add column shipping_sender_suburb text,
  add column shipping_sender_state text,
  add column shipping_sender_postcode text;

-- Live AusPost rate + label/tracking fields on the order. The customer's
-- destination postcode is captured pre-payment (during rate calc, before
-- Stripe collects the full address), so it's stored separately from
-- shipping_address (which Stripe populates post-payment).
alter table public.store_orders
  add column customer_postcode text,
  add column shipping_service_code text,
  add column shipping_service_name text,
  add column shipping_cost_aud numeric,
  add column shipping_label_url text;
