# Native iOS Product Architecture (RLT-IOS-003)

_Last updated: 2026-07-10 · branch `rlt-ios-003-native-product` (incl. Architect corrections 003F–003H and adversarial-review corrections 003I–003M)_

The Capacitor shell no longer mirrors the website. Web/PWA and native iOS are
**two presentation layers over one shared system**:

```
        Supabase (Postgres+RLS · Auth · Edge Functions · Storage)
                      base44Client · TanStack Query cache
                 shared hooks/libs · localStorage contracts
                          ↓                    ↓
                   Web/PWA routes        Native iOS routes
                   PublicLayout          NativePublicShell (5 fan tabs)
                   AdminLayout           NativeAdminShell  (5 admin tabs)
```

Nothing business-bearing is duplicated: entities, edge-function contracts
(`createCheckout`, `submitForumPost`, `forumAction`, `submitTip`,
`auspostRates`, …), query keys, `AuthContext`, RLS and the Stripe webhook
remain single-sourced. Native screens re-use the same query keys as the web
pages, so both platforms share one cache.

## Platform split

`src/App.jsx → AuthenticatedApp` renders the web `<Routes>` (unchanged from
pre-003 apart from the checkout-return alias routes) or a lazy
`NativeAppRoutes` when `isNativeApp()`. The native chunk is never
modulepreloaded on web (verified per build). For scale context: the web
entry chunk itself is small (~71KB), but TOTAL preloaded web JS (entry +
modulepreloaded vendor chunks) is ~1.07MB raw / ~320KB gzipped — quote the
total, not just the entry, when talking about web payload.

`isNativeApp()`/`getPlatform()` **latch their first answer**
(`src/lib/native/native-env.js`): the platform cannot change mid-session, and
the `@capacitor/core` web runtime would otherwise replace a pre-set
`window.Capacitor` when the first plugin module loads (observed in the
Chromium smoke harness) and flip the route tree mid-flight.

## Native fan shell

- **Tabs (exactly five):** Home `/` · News `/news` · Forum `/forum` · Store
  `/store` · Account `/account` (`src/native/app/native-tabs.js`). Admin is
  **never** a public tab.
- **Takeover (More) sheet:** Plan the Trip (MobileCommandSheet), Gallery,
  FAQ, Terms, Privacy, accent-theme picker (dispatches the pre-existing
  `rlt_theme_change` contract), Admin entry (authorized users only, emerald),
  sign-in/join CTAs, build stamp.
- **Tab behavior:** per-tab last-route memory (session-persisted), reselect
  pops to root, reselect-at-root scrolls to top, cart + unread-notification
  badges, idle prefetch of tab chunks. Per-path window-scroll memory
  restores position before paint (`src/native/navigation/*`). Screens
  remount on tab switch but restore instantly from the query cache + scroll
  memory (documented trade-off vs. parallel keep-alive trees).
- **Chrome exclusions (test-locked):** no SiteNav, website footer, web ad
  banners, scroll progress bar, or PWA install/update prompts inside the
  shell. Offline banner retained. Sponsor inventory returns through
  `NativeSponsorCard` (wraps `AdSlot`, collapses with no fill).

## Route map (canonical on BOTH platforms)

| Path | Native | Web |
|---|---|---|
| `/news/:id` | native article reader | `NewsArticle` page |
| `/forum/thread/:id` | native thread screen | redirect → `/forum?thread=` |
| `/store/product/:id` | native product screen | redirect → `/store?product=` (opens quick view) |
| `/gallery?item=:id` | opens native viewer | opens web lightbox |
| `/store/checkout/success·cancel` | native confirmation screens | redirect → `/store?success·cancelled` |
| `/account/<section>` | native list/detail (`notifications`, `fanhub`, `orders`, `posts`, `achievements`, `leaderboard`, `profile`, `interest`, `security`) | `?tab=` (unchanged) |

Aliases: native `/forum?thread=` → `/forum/thread/:id`; native
`/store?product=` → `/store/product/:id`; native `/account?tab=` → child
routes — all resolved centrally by `NativePublicShell` via `nativeAliasFor`
(`src/native/navigation/native-aliases.js`).
Share URLs (`src/lib/native/share.js`) now emit these canonical per-entity
paths, so universal links resolve everywhere.

## Native fan screens (`src/native/screens/`)

- **Home** — dashboard: SiteSettings countdown, latest headline, trending
  thread (engagement×recency), next matchup, upcoming event, merch rail,
  Plan CTA (fires `rlt_open_plan`), signed-in strip with unread count.
- **News** — feed (lead + windowed rows, category chips, offline fallback via
  the bounded `rlt_recent_news` cache) and reader (progress bar, 3-step text
  size, bounded MRU bookmarks `rlt_saved_articles`, related articles,
  offline-copy notice).
- **Forum** — feed (hot/new/top, categories, search, unread markers from the
  shared read-tracker, windowed rendering, casino fan tools: ScorePredictor
  + badge slots), thread detail (reactions, nested replies, report sheet,
  keyboard-safe sticky reply composer with per-thread drafts
  `rlt_native_reply_draft_<id>`, session-deduped view counts), full-screen
  composer (draft `rlt_native_forum_draft`). Writes go through
  `submitForumPost`/`forumAction` only; forum writes are **not** queued
  offline (no idempotency protection server-side — deliberate).
- **Store** — catalogue, product detail (size/stock rules shared via
  `src/lib/store-products.js`), cart sheet (shared `rlt_cart` contract via
  `src/lib/cart-store.js`, AusPost live rates, free-ship display ≥ $150,
  server-authoritative `createCheckout` → system-browser handoff).
- **Gallery** — touch grid + gesture viewer: swipe next/prev, pinch zoom
  (photos), drag-down dismiss, adjacent prefetch, native share; pure gesture
  math in `gallery-gestures.js`. Facebook items open externally; web
  keyboard controls remain web-only.
- **Account** — hub (profile summary + list/detail into the existing section
  components) + native notification centre (mark read / mark all read; taps
  follow the notification link through the aliases).

## Native admin shell (`src/native/admin/`)

Five tabs: **Overview · Content · Store · Community · More** (More: Events,
People, Ads & Sponsors, Site Settings, Export Data, Back to Fan App, Sign
Out). Desktop chrome (sidebar, command palette, live clock, keyboard
shortcuts, breadcrumbs) is not carried onto the phone.

- **Overview:** revenue/orders/signups/posts tiles + a needs-attention queue
  (fulfil, moderate, registrations, low/out-of-stock, unpublished news,
  problem orders) deep-linking into modules.
- **True native workflows (003G)** for the three highest-value modules:
  - **Orders** — `/admin/store/orders` searchable/pipeline-filtered list →
    `/admin/store/orders/:orderId` detail: customer contact actions
    (email/call/copy address), line items, tracking editor + copy, AusPost
    label/track via the existing edge functions, confirmed status
    transitions with **payload parity** for packing/shipped (incl.
    `estimated_delivery`)/delivered/cancel, and a refund sheet writing the
    full web refund field set (amount/reason/refunded_at; available on any
    non-refunded order, delivered included). The adversarial review found
    the original 003G payloads dropped `estimated_delivery` and the refund
    fields — fixed in 003K. Payment state is labeled webhook-authoritative.
  - **Forum moderation** — `/admin/community/forum` queues
    (pending/reported/live/removed with counts), search,
    publish/hide/pin/remove/restore with **payload parity** to the web
    manager (hide/remove capture an optional `moderation_reason`),
    author/IP bans via the shared `BanDialog` + `Ban.create` shape —
    author bans write BOTH the email and (when known) user-id records like
    the web, and are only offered when a real `user_email` exists — plus
    the web's `rlt_admin_log` audit events and open-fan-thread navigation.
    The original 003G build had single-record email bans, an
    `author_name` ban fallback and no reason capture — fixed in 003K.
  - **Registrations** — `/admin/people/registrations` list →
    `/:regId` detail with contact actions and bulk BCC email; read-only.
- **Remaining 19 modules:** the existing (card-based, functional) web
  managers render full-screen behind native chrome with panel-identical
  data wiring (`admin-modules.jsx`) — functional parity, not yet native
  presentation. Classic Orders/Forum/Registrations managers stay exported
  as escape hatches.
- Native-only URL addressability throughout (`/admin/store/orders/:orderId`,
  `/admin/community/forum`, `/admin/settings/settings`, …); web admin URLs
  still stop at the section (unchanged).
- Attention badges (pending posts / paid orders) poll `head:true` count
  queries — no row payloads leave the database. (Before 003M this doc
  claimed "id-only projections" while the query actually fetched full
  rows; both the claim and the query are now fixed.)
- Guards unchanged: `RequireAdmin` wraps the subtree; RLS/edge functions
  remain the enforcement.

## State, performance & caching rules

- **Query persistence (native only):** `src/lib/native/query-persistence.js`
  — localStorage persister, 24h `maxAge`, build-id `buster`, loaded via
  dynamic import (persist packages are exempted from web-preloaded vendor
  chunks in `vite.config.js`). **ALLOWLIST (only these ever persist):**
  `siteSettings`, `news`, `products`, `gallery`, `teams`, `partners`,
  `faqs` — public content roots whose RLS returns the same rows to every
  caller, enforced at dehydrate time; only successful queries persist and
  mutations never dehydrate. `events`/`matchups` are deliberately NOT
  allowlisted: their RLS widens to unpublished rows for admins and the
  native admin modules share the same query keys, so persisting them would
  write unpublished admin content to an admin device (delta-review finding).
  Everything else (forum posts — whose admin projections carry
  `ip_address`/`user_email`/`reported_by` — notifications, orders, all
  user-scoped and admin keys) never touches disk, secure by default. The
  original 003D denylist model leaked those admin projections to
  localStorage — inverted in 003I. Sign-out clears the store and the
  in-memory cache.
- **Lifecycle:** foreground resume invalidates only `notifications`,
  `forumPosts`, `adminAttention`.
- **Windowed feeds:** `useWindowedList` (IntersectionObserver, no dependency)
  on forum + news feeds.
- **Haptics:** semantic vocabulary with per-event throttling
  (`src/lib/native/haptic-events.js`): `tab.select`, `sheet.snap`,
  `nav.back`, `action.primary`, `cart.add`, `checkout.handoff`,
  `forum.react`, `refresh.trigger`, `save.success`, `post.success`,
  `mutation.warning`, `mutation.error`, `casino.win`, `casino.jackpot`.
  Scrolling and repeated renders can never vibrate (min-interval ≥100ms per
  event; outcome events ≥800ms).

## Checkout return (server-authoritative, 003F)

`createCheckout` now sends Stripe to the canonical return routes with a
verifiable reference: `/store/checkout/success?session_id={CHECKOUT_SESSION_ID}`
and `/store/checkout/cancel` (web users flow through the App.jsx aliases into
the existing banner behavior; in the installed app the universal link lands on
the native screens; legacy `/store?success=true` arrivals still redirect
natively).

**The URL proves navigation only (on native).** The native return screen
runs a verification state machine: it calls the read-only
`verifyCheckoutReturn` edge function, which (in order) validates the
session-id format, looks up `store_orders` by that exact
`stripe_session_id` — unknown ids 404 **before any Stripe call**
(anti-amplification; bind #1) — then retrieves the session from Stripe
server-side, rejects foreign apps via `rlt_app_id` metadata, and requires
the session's own `metadata.order_id` to point back at the same order row
(bind #2) before reporting a PII-free
`{paymentStatus, sessionStatus, orderStatus}`. (The original 003F called
Stripe first and its order bind only decorated `orderStatus`; the DB-first
double-bind landed in 003I.) States: `confirming → confirmed | pending |
cancelled | unverified`, plus a soft `confirming_offline` state when the
return URL carries no `session_id` at all (deploy skew from an
un-redeployed `createCheckout`) — that case defers to the webhook and never
shows a red failure. Success copy and the single, guarded, exactly-once
cart clear happen **only on verified payment**; pending polls politely
(5×4s) and keeps the cart; unverified never claims success. Guest-safe:
possession of the unguessable `cs_` session id delivered by Stripe's
redirect is the return credential. The **webhook remains the only writer**
of order state.

**Honesty note (web, pre-existing):** the WEB `/store?success=true` banner
flow still clears the cart on URL arrival without server verification —
unchanged pre-003 behavior, kept deliberately to leave web/PWA intact. Only
the native return is verification-gated.

**Deployment required (not yet live):** `createCheckout` (changed) and
`verifyCheckoutReturn` (new) must be deployed to Supabase. No new secrets
(reuses the Stripe key + `RLT_APP_ID`). Until deployed, production still uses
the legacy web-banner return. Device verification of the universal-link
return is still outstanding.

## Push

- Token registration: code-complete (explicit opt-in toggle → APNs token →
  `user_push_tokens`; migration **not yet applied** to the remote DB).
  RLS is own-row **with an admin override on select/update/delete**, and
  the insert policy requires a resolved profile (003I fix — the original
  coalesce fallback let anonymous callers insert `user_id=''` rows).
- Tap routing: `src/lib/native/push-routing.js` maps sender payloads to
  screens — `forum_reply|forum_mention {thread_id}` → thread,
  `news {article_id}` → article, `product_drop {product_id}` → product,
  `order_update` → orders, `{link:"/path"}` → path (host-injection
  rejected), anything else → notification centre. Wired in `NativeRuntime`.
- **Delivery: not implemented** (RLT-IOS-004 — design notes below).

## Native Google OAuth — exact plan (deliberately not enabled)

Google stays hidden in the shell (`canUseGoogleOAuth`) because the safe flow
cannot be device-proven from this environment. To implement:

1. Supabase client: `flowType: "pkce"` (verify web OAuth/email links still
   work — supabase-js exchanges the code automatically with
   `detectSessionInUrl`), keep default storage.
2. Add `https://rugbyleaguetakeover.com/auth/native-callback` to the Supabase
   redirect allow-list.
3. Native sign-in: `signInWithOAuth({ provider:"google", options:{
   redirectTo: CANONICAL_WEB_ORIGIN + "/auth/native-callback?next=<path>",
   skipBrowserRedirect: true }})` → open `data.url` with `@capacitor/browser`
   (system auth sheet — never WKWebView).
4. Universal link returns → native route `/auth/native-callback`: validate
   expected path + `next` allow-list (app-relative only), call
   `supabase.auth.exchangeCodeForSession(code)`, `Browser.close()`,
   `refreshUser()`, navigate to `next`.
5. Device-verify on TestFlight (AASA must be live); only then flip
   `canUseGoogleOAuth` to allow native. Also route password-reset/confirm
   emails through verified universal links at that point.

## Honest status matrix

```
native_routes_complete: yes            native_fan_shell_complete: yes
native_admin_shell_complete: yes       native_admin_functional_parity: yes
native_admin_priority_workflows_complete: yes (Orders, Moderation, Registrations)
native_admin_all_workflows_native: no  (19 modules remain wrapped web managers)

checkout_return_routes_complete: yes
checkout_server_verification_complete: yes (code; edge fns NOT yet deployed)
checkout_return_deployed: no           checkout_return_device_verified: no

push_token_registration_code_complete: yes
push_token_migration_applied: no       push_token_registration_live_verified: no
push_delivery_complete: no

codemagic_config_complete: yes         signed_ipa_build_verified: no
testflight_upload_verified: no         testflight_install_verified: no

oauth_return_complete: no (exact plan above; Google hidden natively)
universal_links: fixed in 003J (003A-H version was defective under
  launch-URL re-entry: every navigation re-consumed getLaunchUrl and
  yanked the user back to the launch route), device-unverified
app_store_ready: no
```

## Known gaps / deferred

- **Deploy** `createCheckout` + `verifyCheckoutReturn` to Supabase and apply
  migration `0010_store_orders_session_index.sql` (unique index backing the
  session-id lookup), then device-verify the universal-link checkout return.
- **Moderator-native gap (accepted limitation, decide in a follow-up):**
  non-admin moderators can moderate nothing natively. The web grants
  moderators pin/delete through the `forumAction` edge function; the native
  product only exposes moderation under `RequireAdmin`
  (`/admin/community/forum`). Options: expose mod actions in the native
  thread screen for `isModerator`, or keep this as a documented native
  limitation. Until decided, moderators must use the web.
- **Push shared-device reassignment (PUSH2 → RLT-IOS-004):** own-row SELECT
  hides another user's row for the same device token, so after user A signs
  out and user B opts in, B's `create` hits the `unique(token)` index, the
  swallowed `.catch` hides the failure, and A's row keeps pointing at B's
  device. Needs a `SECURITY DEFINER` upsert-by-token RPC that reassigns
  ownership, plus disable-tokens-on-signout. Blocked into RLT-IOS-004 with
  the send pipeline.
- APNs **send** pipeline (RLT-IOS-004): JWT provider auth via Edge Function,
  enabled-token targeting, preferences, event types (reply/mention/drop/
  order/admin), deep-link payloads per `push-routing.js`, badge counts,
  delivery logs/rate limits, live-device verification. Apply the
  `user_push_tokens` migration (with the 003I insert-policy fix) first.
- Native OAuth + auth-email deep-link return (plan above).
- Native presentation for the remaining 19 admin modules (wrapped web
  managers today — functional, not native).
- Edge-swipe back gesture (deferred: conflicts with gallery swipe; Back
  buttons are explicit).
- Xcode/simulator/TestFlight validation — requires the Codemagic signing
  completion (Apple portal work in progress); use the `ios-build-verify`
  workflow for unsigned macOS smoke builds.

## Validation

`npm test` (220+) · `npm run lint` · `npm run typecheck` · `npm run build` ·
`npx cap sync ios` — all green at each story commit (A–E, corrections F–H,
and adversarial-review corrections I–M). Chromium smoke (iPhone viewport +
Capacitor stub): native Home/News/
Forum/Store/Gallery/Login render the native shell (5 tabs, no Admin tab, one
Takeover trigger), web Home/Login keep their layout (SiteNav + Google button
present, no page errors). Contract tests: `tests/native-app-shell.test.mjs`,
`native-fan-screens.test.mjs`, `native-admin-shell.test.mjs`,
`native-state-flows.test.mjs`, `checkout-return.test.mjs`,
`native-admin-workflows.test.mjs`.
