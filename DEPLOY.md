# Deploy / Publish checklist

This app is **GitHub-synced to the Base44 Builder**. Code and the `base44/` schema
in this repo are reflected in the Builder; clicking **Publish** on Base44.com makes
them live. New entity fields, new entities, RLS, and functions only take effect
after publishing — until then the UI silently drops unknown fields (e.g. a saved
countdown date or profile change won't persist).

## How to deploy
1. Push to `main` (already done by the build).
2. Open **Base44.com → your app** ("Rugby League Takeover", id `6a18d49a2b8f40f0f81cc26e`).
3. If prompted, **sync/pull from GitHub** so the Builder has the latest.
4. Click **Publish**.
5. Hard-refresh the live site + `/admin`.

If a field/permission didn't apply from the synced schema, set it in the Builder's
**Data → Entities** panel (fields) and each entity's **permissions/security** panel
(RLS), then Publish again.

## Entities — fields to ensure exist
- **Ban** (new): `ban_type` (enum ip/email/user), `value`, `reason`, `banned_by`, `expires_at` (date-time), `is_active` (bool, default true)
- **User**: `phone`, `postcode`, `favourite_team`, `avatar_url`, `marketing_opt_in` (bool)
- **EventContent**: `event_date` (date-time), `start_time`, `location`, `address`, `ticket_url`, `tickets` (array of objects: name, price_aud, url, note, sold_out), `is_published`, `sort_order`, `is_coming_soon`
- **TravelPackage**: `image_url`
- **StoreOrder**: `user_email`, `user_id`, `stripe_payment_status`, `payment_verified_at`
- **ForumPost**: `user_email`, `user_id`, `ip_address`
- **InterestRegistration**: `user_email`, `user_id`, `ip_address`
- **SiteSettings**: `countdown_enabled` (bool), `countdown_title`, `countdown_subtitle`, `countdown_date` (date-time), `countdown_cta_label`, `countdown_cta_url`

## Entities — permissions (RLS)
- **User**: read = role `admin` OR own record; update = role `admin`.
- **Ban**: admin only (read/create/update/delete).
- **InterestRegistration**, **StoreOrder**: public create; read restricted to owner (`user_email == me`) or admin. Never public-listable (PII).
- **ForumPost**: public read only where `is_published == true`; users read their own; admin full.
- `ip_address` fields: admin-only.
- **EventContent**, **SiteSettings**: already carry RLS in their `.jsonc` (admin write, public read of published).

## Functions — deploy + secrets
- `createCheckout`, `stripeWebhook`, `submitForumPost`, `submitRegistration` (all self-contained — no shared imports).
- Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BASE44_APP_ID`; optional `CHECKOUT_ALLOWED_ORIGINS`, `CHECKOUT_DEFAULT_ORIGIN`.

## Post-publish smoke test
- Set countdown date in Settings → Save → homepage counts down.
- Edit profile name/phone → Save → persists after refresh.
- Post in the forum (logged in or guest) → succeeds, appears as pending.
- `/admin/people` Users list + Bans panel load without errors.
- Create an event with ticket tiers → tiers show as external "Buy" buttons.

Docs: https://docs.base44.com/Integrations/Using-GitHub
