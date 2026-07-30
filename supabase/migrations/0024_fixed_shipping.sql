-- Fixed-rate shipping mode (toggleable from AusPost-calculated), per the
-- WhatsApp brief:
--   1 item        $12.50
--   2 or more     $15.90
--   Membership    $15.90 (per-product flat override)
--   over $150     free (existing free_shipping_threshold_aud)
--
-- shipping_mode defaults to 'calculated' so nothing changes until an admin
-- flips it. The flat rates are editable (future-proof). Actual postage is
-- always re-computed server-side in createCheckout — these settings are the
-- source, never a client-supplied amount.
alter table public.site_settings
  add column if not exists shipping_mode text not null default 'calculated',
  add column if not exists shipping_flat_single_aud numeric not null default 12.50,
  add column if not exists shipping_flat_multi_aud numeric not null default 15.90;

alter table public.site_settings
  drop constraint if exists site_settings_shipping_mode_valid;
alter table public.site_settings
  add constraint site_settings_shipping_mode_valid
  check (shipping_mode in ('calculated', 'fixed')) not valid;

comment on column public.site_settings.shipping_mode is
  'calculated = live AusPost PAC quotes; fixed = flat single/multi rates below.';

-- Per-product flat postage override. When set (and shipping_mode = fixed), a
-- cart containing this product is charged at least this amount, and the product
-- is treated as shippable even if shipping_required is false (e.g. a membership
-- that still posts a card). NULL = no override, product follows the item-count
-- rule.
alter table public.products
  add column if not exists flat_shipping_aud numeric;

comment on column public.products.flat_shipping_aud is
  'Fixed-mode per-product flat postage override in AUD (e.g. Membership Package 15.90). NULL = follow the item-count rule.';

-- site_settings_view is the public read path; expose the three new settings
-- columns (masks unchanged). Recreated because a view cannot be altered to add
-- columns in place.
drop view if exists public.site_settings_view;

create view public.site_settings_view as
 SELECT id,
    site_logo_url,
    hero_eyebrow,
    hero_eyebrow_visible,
    hero_title,
    hero_description,
    hero_button_label,
    ticker_items,
    background_video_urls,
    contact_email,
    social_facebook_url,
    social_instagram_url,
    social_tiktok_url,
    facebook_fans,
    legal_terms,
    legal_privacy,
    news_eyebrow,
    news_title,
    news_description,
    about_eyebrow,
    about_title,
    about_description,
    about_body,
    about_highlight,
    about_image_url,
    about_image_caption,
    travel_eyebrow,
    travel_title,
    travel_description,
    registration_eyebrow,
    registration_title,
    registration_description,
    merch_eyebrow,
    merch_title,
    merch_description,
    footer_text,
    footer_powered_by,
    countdown_enabled,
    countdown_title,
    countdown_subtitle,
    countdown_date,
    countdown_cta_label,
    countdown_cta_url,
    ads_enabled,
    CASE WHEN (SELECT is_admin()) THEN shipping_sender_name ELSE NULL::text END AS shipping_sender_name,
    CASE WHEN (SELECT is_admin()) THEN shipping_sender_business_name ELSE NULL::text END AS shipping_sender_business_name,
    CASE WHEN (SELECT is_admin()) THEN shipping_sender_address_line1 ELSE NULL::text END AS shipping_sender_address_line1,
    CASE WHEN (SELECT is_admin()) THEN shipping_sender_address_line2 ELSE NULL::text END AS shipping_sender_address_line2,
    CASE WHEN (SELECT is_admin()) THEN shipping_sender_suburb ELSE NULL::text END AS shipping_sender_suburb,
    CASE WHEN (SELECT is_admin()) THEN shipping_sender_state ELSE NULL::text END AS shipping_sender_state,
    CASE WHEN (SELECT is_admin()) THEN shipping_sender_postcode ELSE NULL::text END AS shipping_sender_postcode,
    created_date,
    updated_date,
    CASE WHEN (SELECT is_admin()) THEN created_by ELSE NULL::text END AS created_by,
    CASE WHEN (SELECT is_admin()) THEN created_by_id ELSE NULL::text END AS created_by_id,
    gst_enabled,
    gst_rate_percent,
    gst_mode,
    gst_label,
    card_fee_enabled,
    card_fee_percent,
    card_fee_fixed_aud,
    card_fee_mode,
    card_fee_label,
    free_shipping_threshold_aud,
    shipping_mode,
    shipping_flat_single_aud,
    shipping_flat_multi_aud,
    pickup_enabled,
    pickup_audience,
    pickup_label,
    pickup_instructions
   FROM public.site_settings;

grant select on public.site_settings_view to anon, authenticated, service_role;
