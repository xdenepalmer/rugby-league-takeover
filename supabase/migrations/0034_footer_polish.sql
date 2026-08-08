-- Footer + storefront polish, all admin-controlled.
--
-- 1. store_show_stock_numbers — whether the live store shows numeric stock
--    ("121 left") or only qualitative state (In stock / Low stock / Sold out).
--    Off by default per the owner: counts read as inventory disclosure, but
--    the toggle keeps drop-day scarcity marketing one click away. Admin always
--    sees exact counts in the Products manager regardless.
-- 2. legal_shipping / legal_refunds — admin-editable policy pages (LegalPage
--    pattern, same as legal_terms/legal_privacy) linked from the footer.
alter table public.site_settings
  add column if not exists store_show_stock_numbers boolean not null default false,
  add column if not exists legal_shipping text,
  add column if not exists legal_refunds text;

-- Re-expose the public read view with the new columns appended at the END of
-- the select list (CREATE OR REPLACE raises 42P16 if existing output columns
-- are reordered or renamed). Body below is the LIVE view definition captured
-- via pg_get_viewdef at migration-authoring time, plus the three new columns.
create or replace view public.site_settings_view as
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
        CASE
            WHEN ( SELECT is_admin() AS is_admin) THEN shipping_sender_name
            ELSE NULL::text
        END AS shipping_sender_name,
        CASE
            WHEN ( SELECT is_admin() AS is_admin) THEN shipping_sender_business_name
            ELSE NULL::text
        END AS shipping_sender_business_name,
        CASE
            WHEN ( SELECT is_admin() AS is_admin) THEN shipping_sender_address_line1
            ELSE NULL::text
        END AS shipping_sender_address_line1,
        CASE
            WHEN ( SELECT is_admin() AS is_admin) THEN shipping_sender_address_line2
            ELSE NULL::text
        END AS shipping_sender_address_line2,
        CASE
            WHEN ( SELECT is_admin() AS is_admin) THEN shipping_sender_suburb
            ELSE NULL::text
        END AS shipping_sender_suburb,
        CASE
            WHEN ( SELECT is_admin() AS is_admin) THEN shipping_sender_state
            ELSE NULL::text
        END AS shipping_sender_state,
        CASE
            WHEN ( SELECT is_admin() AS is_admin) THEN shipping_sender_postcode
            ELSE NULL::text
        END AS shipping_sender_postcode,
    created_date,
    updated_date,
        CASE
            WHEN ( SELECT is_admin() AS is_admin) THEN created_by
            ELSE NULL::text
        END AS created_by,
        CASE
            WHEN ( SELECT is_admin() AS is_admin) THEN created_by_id
            ELSE NULL::text
        END AS created_by_id,
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
    pickup_instructions,
    travel_agent_email,
    store_show_stock_numbers,
    legal_shipping,
    legal_refunds
   FROM site_settings;
