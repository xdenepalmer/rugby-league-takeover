# Deploy checklist

> The Base44 Builder flow this file used to describe is **dead** — the app was
> fully migrated to Supabase + Vercel (see `MIGRATION-SUPABASE.md`). The
> `base44/` directory is archived reference only (a schema test reads it).

## Web (Vercel)

1. Merge to `main`. Vercel builds `npm run build` and deploys `dist/`
   automatically (SPA rewrites, cache headers, CSP all in `vercel.json`).
2. Hard-refresh the live site + `/admin` after deploy; the service worker
   update prompt handles returning visitors.

Env vars (Vercel project settings): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` (safe client-side defaults ship in
`src/api/supabaseClient.js`).

## Backend (Supabase)

- **Migrations**: files in `supabase/migrations/` are the source of truth;
  apply new ones with `supabase db push` (or the SQL editor, in order).
  ⚠️ `0009_user_push_tokens.sql` is committed but **not yet applied** — apply
  it when the push-notification story starts.
  ⚠️ `0011_store_orders_payment_intent.sql` + the updated `stripeWebhook` +
  new `stripeRefund` function are committed but **not yet deployed** — the
  exact commands are step 0 of `docs/STRIPE_GO_LIVE.md`.
- **Edge functions**: deploy changed functions from `supabase/functions/` with
  `supabase functions deploy <name>` (run `node scripts/sync-shared.mjs` first
  if `_shared/shared.ts` changed). `stripeWebhook` must keep
  `--no-verify-jwt` — Stripe can't send a Supabase JWT; the signature check is
  its authenticity gate.
- **Secrets** (functions): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `SITE_URL`; optional `CHECKOUT_ALLOWED_ORIGINS`, `CHECKOUT_DEFAULT_ORIGIN`,
  AusPost keys. Full list + values: `.env.example`.
- **Stripe**: the complete go-live checklist (secrets, webhook endpoint, the
  five events to subscribe, test cards, refunds) is
  `docs/STRIPE_GO_LIVE.md`.
- **Auth**: redirect allow-list must contain the production domain routes
  (`/account`, `/reset-password`). Native in-app auth return will add entries
  in a later story.

## iOS (Capacitor)

The native shell in `ios/` ships separately through Xcode → TestFlight →
App Store. See `docs/iOS_RUNBOOK.md` (build/run) and
`docs/APP_STORE_CHECKLIST.md` (submission). Web deploys do NOT update
installed apps — ship a new build via `npm run ios:build` + Xcode archive.

## Post-deploy smoke test

- Homepage countdown + background video play.
- Profile edit persists after refresh.
- Forum post succeeds and appears.
- `/admin` panels load for an admin account.
- Store checkout reaches Stripe and the webhook records the order.
