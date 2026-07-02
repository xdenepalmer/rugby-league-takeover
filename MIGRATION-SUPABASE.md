# Base44 → Supabase Migration Record

Full platform migration completed 2026-07-02. The app now runs entirely on
Supabase project **RUGBY LEAGUE TAKEOVER** (`ohytlrgfpcpvnqgdpqap`,
`ap-southeast-2`). Base44 is no longer required at runtime.

## What moved

### 1. Database (22 entities → Postgres + RLS)
Every `base44/entities/*.jsonc` entity became a Postgres table
(`supabase/migrations/0001_core_schema.sql`). Original Base44 record ids were
preserved as text primary keys, so all cross-references (forum replies, likes,
reactions, notifications, reward events) survived unchanged.

| Base44 entity | Table | Rows migrated |
|---|---|---|
| User | `profiles` | 6 |
| Team | `teams` | 30 |
| Faq | `faqs` | 2 |
| Partner | `partners` | 2 |
| NewsArticle | `news_articles` | 3 |
| EventContent | `event_contents` | 3 |
| TravelPackage | `travel_packages` | 3 |
| GalleryItem | `gallery_items` | 1 |
| Matchup | `matchups` | 3 |
| Product | `products` | 4 |
| StoreOrder | `store_orders` | 4 |
| SiteSettings | `site_settings` | 1 |
| InterestRegistration | `interest_registrations` | 11 |
| ForumPost | `forum_posts` | 11 |
| ForumRewardEvent | `forum_reward_events` | 11 |
| Notification | `notifications` | 9 |
| TippingEntry | `tipping_entries` | 109 |
| Ban / Testimonial / SiteAd / AchievementUnlock / ProductReleaseSubscription | tables created | 0 (were empty) |

Data source: the `RLT DB.zip` CSV export (uploaded to `src/`), cross-checked
against the live Base44 API.

### 2. Security model (RLS)
`supabase/migrations/0002_rls_policies.sql` mirrors every Base44 `rls` block:
- Public content readable by anyone; admin-only writes via `public.is_admin()`.
- Own-row access for orders, registrations, notifications, reward events,
  achievement unlocks.
- Base44's **field-level** rules (admin-only `ip_address`, linked user emails)
  are enforced by sanitising security-barrier views — `forum_posts_view`,
  `testimonials_view`, `tipping_entries_view` — which mask those columns for
  non-admins. The frontend reads exclusively through these views; base tables
  have no anon/user SELECT. (The Supabase linter flags these views as
  SECURITY DEFINER — that is intentional; they *are* the masking mechanism.)
- A `profiles` column-protection trigger stops non-admins editing their own
  role/XP/chips/badges.

### 3. Auth (Base44 accounts → Supabase Auth)
- `profiles.auth_user_id` links to `auth.users`; the `handle_new_auth_user`
  trigger **auto-links by email** — anyone signing in (password or Google
  OAuth) with a known email automatically claims their migrated profile, XP,
  avatar and admin role.
- Auth accounts were pre-created for the two active admins
  (`deneop24@gmail.com`, `t_mace@hotmail.com`) with temporary passwords
  (delivered out-of-band — change them after first login). The other four
  migrated profiles (aftermathraves, dene_palmer_24, carlislebj,
  kaylarhodes416) auto-link on their first sign-in/sign-up.

### 4. Backend functions (15 Base44 functions → Supabase Edge Functions)
All of `base44/functions/*` were ported 1:1 to `supabase/functions/*` and
deployed: adminUsers, createCheckout, evaluateAchievements, forumAction,
forumAvatars, leaderboard, notifyProductRelease, recordAdEvent, searchUsers,
stripeWebhook, submitForumPost, submitRegistration, submitTestimonial,
submitTip, subscribeProductRelease.

- Deployed with `verify_jwt: false` (public forms/webhooks need anonymous
  access); every function authenticates callers in-code via the Authorization
  header, exactly like the Base44 originals.
- Shared helpers live in `supabase/functions/_shared/shared.ts`; each function
  directory carries a synced copy (`node scripts/sync-shared.mjs`).
- Email sending (`notifyProductRelease`) now uses Resend when
  `RESEND_API_KEY` is set; in-app notifications are always created.

### 5. Frontend
- `src/api/base44Client.js` was rewritten as a **compat client**: the same
  `base44.entities/auth/functions/integrations` surface, implemented on
  `@supabase/supabase-js`. No component call-sites needed changing.
- `src/api/supabaseClient.js` — project URL + publishable key (overridable via
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).
- `src/lib/AuthContext.jsx` — Supabase session lifecycle (incl. OAuth
  redirects and cross-tab sign-out via `onAuthStateChange`).
- `@base44/sdk` and `@base44/vite-plugin` removed; `@` path alias now set in
  `vite.config.js`.
- Password reset: `/forgot-password` emails a Supabase recovery link that
  lands on `/reset-password`; registration email confirmation uses Supabase's
  signup flow (see "Manual dashboard steps").

### 6. Media (33 files → Supabase Storage)
Every `media.base44.com` / `base44.app` asset referenced by the DB or code
(logos, product shots, avatars, event photos, background videos ~40 MB) was
copied to the public `media` storage bucket under `migrated/`, and all DB rows
and hard-coded frontend fallbacks were rewritten to the new URLs
(`supabase/media-url-mapping.json` is the full mapping). Nothing breaks when
the Base44 app is deleted.

## Validation
- `npm test` 84/84 · `npm run lint` clean · `npm run typecheck` clean ·
  `npm run build` green.
- Live end-to-end smoke test passed 20/20: anonymous public reads with field
  masking, RLS write blocks, both admin logins, profile auto-link, admin
  reads/writes, `forumAvatars` / `searchUsers` / `leaderboard` functions,
  anonymous form validation.
- Supabase security advisors reviewed; trigger functions revoked from the RPC
  surface and `search_path` pinned. Remaining flags are the three intentional
  sanitising views (documented above).

## Manual dashboard steps (can't be automated via API)
1. **Stripe**: set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` Edge Function
   secrets (live-mode keys); point a Stripe webhook (live mode) at
   `https://ohytlrgfpcpvnqgdpqap.supabase.co/functions/v1/stripeWebhook`.
   To test with Stripe test-mode keys without disturbing the live ones, also
   set `STRIPE_SECRET_KEY_TEST` + `STRIPE_WEBHOOK_SECRET_TEST` (point a
   second, test-mode Stripe webhook at the same URL), then set `STRIPE_MODE`
   to `test`; flip it back to `live` (or unset it) to go live again. See
   `.env.example` for the full variable list.
2. **Google login**: Supabase Dashboard → Auth → Providers → Google (client id
   + secret from Google Cloud Console).
3. **Email confirmation code**: the Register page asks for a 6-digit code —
   add `{{ .Token }}` to the "Confirm signup" email template (Auth →
   Templates), or disable "Confirm email" while testing.
4. **Auth URLs**: set the Site URL + redirect allow-list (Auth → URL
   Configuration) to the production domain so reset/OAuth links land there.
5. Recommended: enable leaked-password protection (Auth → Passwords).
6. Optional: `RESEND_API_KEY` for release-alert emails.
7. When satisfied, the Base44 app can be unpublished/deleted — nothing runtime
   depends on it. `base44/` stays in the repo as historical reference (tests
   still validate those schema files as the migration source of truth).
8. **AusPost shipping** (domestic AU only): set `AUSPOST_API_KEY` (and
   `AUSPOST_ACCOUNT_NUMBER` for label creation) as Edge Function secrets, then
   fill in the sender address under Admin → Site Settings → Shipping
   (AusPost) — rate calc and label creation both fail until a sender postcode
   is set there. Product weight/dimensions (Admin → Products) feed the parcel
   size used for rate calculation and labels; leave dimensions blank to use a
   default small satchel.

   ⚠️ **This integration has not been tested against a live AusPost account.**
   The three edge functions (`auspostRates`, `auspostCreateLabel`,
   `auspostTrack`) were built from AusPost's publicly documented API
   contracts — their JS-rendered developer portal couldn't be fetched for
   live schema verification. Before relying on this in production:
   - Confirm the MyPost Business account has Shipping & Tracking API access
     enabled (AusPost support may need to switch this on).
   - Place a real test order and smoke-test all three flows: rate calc at
     checkout, label creation in Admin → Orders, and tracking refresh.
   - Watch the Edge Function logs (`auspostRates`/`auspostCreateLabel`/
     `auspostTrack`) for any request/response field mismatches and adjust the
     function code if AusPost's actual response shape differs.
