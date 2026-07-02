-- Structured destination address fields, populated directly from Stripe's
-- shipping_details.address at payment time (see stripeWebhook). The existing
-- shipping_address text column stays as the human-readable joined string for
-- admin display; these structured fields are what the AusPost label API
-- actually needs (it takes discrete address components, not a free-text
-- string).
alter table public.store_orders
  add column shipping_name text,
  add column shipping_address_line1 text,
  add column shipping_address_line2 text,
  add column shipping_suburb text,
  add column shipping_state text,
  add column shipping_postcode text,
  add column shipping_country text;
