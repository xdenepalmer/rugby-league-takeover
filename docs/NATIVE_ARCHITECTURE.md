# Native iOS Product Architecture (RLT-IOS-003)

_Last updated: 2026-07-10 · branch `rlt-ios-003-native-product`_

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

`src/App.jsx → AuthenticatedApp` renders the web `<Routes>` (byte-identical
to pre-003) or a lazy `NativeAppRoutes` when `isNativeApp()`. The native
chunk is never modulepreloaded on web (verified per build).

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
`/account?tab=` → child routes (`src/native/navigation/native-aliases.js`).
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
- **Hubs → modules:** every one of the 22 web managers renders full-screen
  behind a native top bar with its panel's exact data wiring
  (`admin-modules.jsx`). Native-only URL addressability:
  `/admin/store/orders`, `/admin/community/forum`, `/admin/people/bans`,
  `/admin/settings/settings`, … (web admin URLs still stop at the section —
  unchanged).
- Attention badges (pending posts / paid orders) poll id-only projections.
- Guards unchanged: `RequireAdmin` wraps the subtree; RLS/edge functions
  remain the enforcement. Transitional note: managers are the web
  implementations (fully functional, card-based); true native list/detail
  rebuilds (Orders, Forum moderation, Registrations ranked highest-value)
  are a follow-up story.

## State, performance & caching rules

- **Query persistence (native only):** `src/lib/native/query-persistence.js`
  — localStorage persister, 24h `maxAge`, build-id `buster`, loaded via
  dynamic import (persist packages are exempted from web-preloaded vendor
  chunks in `vite.config.js`). **Denylist (never persisted):** `orders`,
  `registrations`, `users`, `bans`, `invites`, `adminAttention`, `myOrders`
  — enforced at dehydrate time; only successful queries persist. Sign-out
  clears the store and the in-memory cache.
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

## Checkout return

Stripe's server-derived redirect (`/store?success=true|cancelled=true` on the
canonical origin) enters the app via universal link → native Store redirects
into `/store/checkout/success|cancel` screens: the lingering browser sheet is
closed, `myOrders`/`products` refetch, success clears the cart exactly like
the web return. **The URL is a UI signal only — the Stripe webhook remains
the sole payment authority** (order status renders from webhook-written
data). Requires AASA verification on a real device (see status).

## Push

- Token registration: complete (explicit opt-in toggle → APNs token →
  `user_push_tokens`; migration **not yet applied** to the remote DB).
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

## Known gaps / deferred

- APNs **send** pipeline (RLT-IOS-004): JWT provider auth via Edge Function,
  enabled-token targeting, preferences, event types (reply/mention/drop/
  order/admin), deep-link payloads per `push-routing.js`, badge counts,
  delivery logs/rate limits, live-device verification.
- Native OAuth + auth-email deep-link return (plan above).
- True native list/detail rebuilds for Orders / Forum moderation /
  Registrations (highest-value next admin step).
- Edge-swipe back gesture (deferred: conflicts with gallery swipe; Back
  buttons are explicit).
- Xcode/simulator/TestFlight validation — requires the Codemagic signing
  completion (Apple portal work in progress); use the `ios-build-verify`
  workflow for unsigned macOS smoke builds.

## Validation

`npm test` (181) · `npm run lint` · `npm run typecheck` · `npm run build` ·
`npx cap sync ios` — all green at each of the five story commits. Chromium
smoke (iPhone viewport + Capacitor stub): native Home/News/Forum/Store/
Gallery/Login render the native shell (5 tabs, no Admin tab, one Takeover
trigger), web Home/Login unchanged (SiteNav + Google button present, no page
errors). Contract tests: `tests/native-app-shell.test.mjs`,
`native-fan-screens.test.mjs`, `native-admin-shell.test.mjs`,
`native-state-flows.test.mjs`.
