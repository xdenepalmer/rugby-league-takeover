# RLT-IOS-003 — Phase 0 Audit: Native Product Split

Program: **RLT-IOS-003 — Transform the Capacitor shell into a distinct native iOS fan and admin app**
Baseline: `main` @ `98f917df361282e277c2f24ccee576a4e9b38e80` · branch `rlt-ios-003-native-product`
Audit method: 4 parallel read-only agents (routing/chrome/PWA · fan surfaces · admin surface · native infra/auth/tests) + baseline validation run. No files modified during audit.

## 0. Baseline validation (verified on this machine)

| Gate | Result |
|---|---|
| `npm test` | ✅ 129/129 pass |
| `npm run lint` | ✅ |
| `npm run typecheck` | ✅ |
| `npm run build` | ✅ (dist 6.9 MB, 105 JS chunks, entry 68 KB) |
| `npx cap sync ios` | ✅ (10 Capacitor plugins, SPM) |
| Xcode / device / TestFlight | ❌ **not verifiable here** (Linux container). Codemagic signing is still being established (cert/key work in progress in the Apple portal); no green cloud build recorded yet. |

Largest chunks: `vendor-charts` 316K, `vendor-misc` 224K, `vendor-supabase` 204K, `vendor-ui` 156K, `vendor-motion`/`vendor-react` 144K, `Forum` 104K, `AdsPanel` 96K.

## 1. Why does the iOS app still feel like the PWA?

One `BrowserRouter` route tree in `src/App.jsx` (`AuthenticatedApp`, lines 49–92) serves both platforms. Native gets:
- The web `PublicLayout` — `SiteNav`, website footer, `AdSlot banner-top`/`footer` web ad chrome, `ScrollProgressBar`.
- The responsive bottom tab bar (`PublicLayout.jsx:159-285`): Home / **Plan (a modal button, not a route)** / Shop / Forum / Account **+ a 6th emerald Admin tab for admins** — hidden at `xl:` for desktop.
- The same long marketing Home (551 ln), the same modal-based detail patterns (news `PublicDetailSheet`, store quick-view, forum `ThreadDetailModal` via `?thread=`), a keyboard-driven gallery lightbox, and the desktop admin command centre squeezed onto a phone.
- No per-tab navigation state, no detail routes (`/news/:id`, `/forum/thread/:id`, `/store/product/:id` do not exist), no per-article share URLs (`shareArticle` → bare `/news`).

`NativeAppBootstrap` adds native *behavior* (status bar, splash, deep links, link interception) but no native *presentation*. The `is-native-app` class is applied to `<html>/<body>` and **zero CSS rules use it**.

## 2. Which web layouts are currently shared with native?

- `PublicLayout` wraps the 12 public routes (layout route). `/admin/*` (own `AdminLayout`) and `/account/*` are siblings *outside* it.
- Route transition = `motion.div` keyed on pathname, public routes only.
- Scrolling = window/document scroll; custom `ScrollToTop` (POP preserved, else instant top).
- Theme = CSS vars; 5 accents in `App.jsx` `themeConfigs`, persisted `localStorage["rlt_theme_accent"]`, switched by `rlt_theme_change` event — **which nothing dispatches; there is no accent picker UI today**.

## 3/4. What must split vs what can be shared?

**Split (platform-specific presentation):** route tree; shell chrome (tab bar, top bars, sheets); screen compositions (Home dashboard vs marketing page; detail screens vs modals); gallery viewer; admin shell.

**Share (single source of truth — do NOT fork):** `base44Client` entities + edge-function contracts (`createCheckout`, `submitForumPost`, `forumAction`, `submitTip`, `auspostRates`, `leaderboard`, …); TanStack Query cache + string query keys (`["news"]`, `["forumPosts"]`, `["products"]`, `["gallery"]`, `["notifications", userId]`, `["siteSettings"]`, …); `AuthContext`; `src/lib/native/*` plumbing; localStorage contracts (`rlt_cart` + `rlt_cart_changed`/`rlt_open_cart`, `rlt_forum_draft`, `rlt_saved_posts`, `rlt_recent_news`, read-tracker); prop-driven components (forum `feed/*`, `forumHelpers`, `NewsSection` data model, `CountdownTimer`, account tab components, admin managers, shared admin primitives `AdminConfirmSheet`/`AdminFilterBar`/`MediaUploader`/`ImageField`); CSS primitives (`.ios-tabbar`, `.ios-sheet`, `.ios-pressable`, safe-area tokens).

**Notable gap:** there are **no shared data hooks** — every screen embeds its own `useQuery`. Native screens will re-use query keys and extract small screen-model hooks where duplication would otherwise occur.

## 5. Which fan screens require platform-specific composition?

| Surface | Today | Native need |
|---|---|---|
| Home | 551-ln marketing page | Concise dashboard (countdown from `SiteSettings.countdown_*`, headline, trending thread, next matchup, event, merch drop, travel CTA; signed-in/out modes) |
| News | `/news` + detail modal; share → `/news` | `/news/:id` reader route, per-article share/deep link, bounded offline cache (extend `recent-news.js` pattern) |
| Forum | 1,822-ln monolith; `?thread=` modal | Feed screen + `/forum/thread/:id` detail + keyboard-safe composer; keep drafts/read-tracker/edge functions |
| Store | 1,423-ln page; quick-view modal; cart drawer | Catalogue + `/store/product/:id` + cart sheet; keep `rlt_cart` contract; checkout return is a 003D story |
| Gallery | keyboard lightbox, no touch gestures | Touch-first viewer: swipe / pinch / drag-dismiss / prefetch |
| Account | `?tab=` tabs page | Native list/detail; add the missing accent picker (dispatch `rlt_theme_change`) |

## 6. Which admin capabilities must be retained?

All 8 sections (`/admin/overview|content|events|store|community|people|settings|ads`), every manager: Orders (961 ln), Forum moderation (749), Registrations (563), Products, News, Travel, Gallery, FAQs, Partners, Testimonials, Events/Teams/Matchups, Users/Invites/Bans, SiteSettings (720), Ads suite (AdsManager 1050 / SponsorManager 881 / AdRevenueTracker 937 / CampaignCalendar 506), DataExporter. Guard = `RequireAdmin` over the whole subtree; enforcement is server-side (RLS + sanitizing views). **Sub-tabs are local `useState` — nothing below `/admin/<section>` is URL-addressable today.** Hover-reveal actions (17 files) are the top mobile usability defect. PII-dense query keys (never persist): `orders`, `registrations`, `forumPosts` (admin view), `users`, `bans`, invites.

## 7. Native feature completeness (verified)

| Feature | Status |
|---|---|
| Env detection, deep links, share, haptics, open-external, network | ✅ complete (`src/lib/native/*`, dynamic-import only) |
| Status bar / splash / link interception | ✅ `NativeAppBootstrap` |
| Push permission + APNs token persistence | ✅ foundation (explicit opt-in toggle; `user_push_tokens` migration **not yet applied to remote DB**) |
| Push delivery (send pipeline) | ❌ none (explicitly out of scope — RLT-IOS-004 design only) |
| Notification tap routing | ❌ listeners exist, no routing map |
| Universal links (AASA + entitlements) | ✅ code-complete (real Team ID in `public/.well-known`); ❌ not device-verified |
| Native Google OAuth | ❌ deliberately hidden (`canUseGoogleOAuth`); Supabase client uses default **implicit** flow, no PKCE; `redirectBase()` points native auth links at the web origin |
| Checkout return to app | ❌ Stripe `success_url`/`cancel_url` are server-derived → land on **web** `/store?success=true`; native never auto-returns |
| Query persistence / virtualization libs | none installed |

## 8. TestFlight/Codemagic truth

`codemagic.yaml` is a clean shared-certificate reference template (validation gate → build → `fetch-signing-files --certificate-key … --create` → `build-ipa` → TestFlight publish). **No green cloud build yet** — Apple-side signing (shared distribution key + freeing a cert slot) is still being finished by the owner. `xcode_build_validated` and `testflight_validated` are **no** at audit time. Codemagic has no `triggering:` block → pushes do NOT auto-build (safe to push this branch).

## 9. Web-regression risks + test landmines (must respect)

1. `native-shell-polish.test.mjs` bans **any static `@capacitor` import under `src/`** — native code must keep using `src/lib/native/*` dynamic wrappers.
2. `vite.config.js` `manualChunks` must keep the `@capacitor` `return undefined` special-case before `vendor-misc`.
3. `hardening.test.mjs` locks `PublicLayout` tokens (`aria-label="Main navigation"`, `xl:hidden` tab bar) — leave `PublicLayout` alone.
4. `mobile-viewport-shells.test.mjs` hardcodes 8 files that must use `min-h-dvh` (PublicLayout, Account, Forum, Home, Store, AuthLayout, AdminLayout, HeroSection) — don't rename/regress; new native shells should also use `min-h-dvh`.
5. `Login.jsx`/`Register.jsx` must literally contain `canUseGoogleOAuth` and `googleAvailable && (`.
6. `capacitor-config.test.mjs` exact-matches `capacitor.config.json` (and forbids `server.url`).
7. Don't reintroduce deleted `ui/form.jsx`, `ui/skeleton.jsx`, `forum/FanBadgeUnlocks.jsx`; keep `hideBrokenImage` in its 6 listed call sites.
8. `deep-links.js` `CANONICAL_HOSTS` is test-locked; new native paths must resolve to real routes or they 404 via the click interceptor.
9. `NativeAppBootstrap` must stay inside the single `BrowserRouter` (uses `useNavigate`).
10. PWA gates (`pwa-env.js` native short-circuit, SW registration, install/update prompts) are load-bearing and test-locked — do not touch.

## 10. Architecture decision (merged from all findings)

**Platform-specific presentation over a shared data/backend layer.** One `BrowserRouter`; at `AuthenticatedApp`, `isNativeApp()` (stable — the bridge injects before script eval) selects:
- **Web:** the existing route tree, byte-identical behavior.
- **Native:** `src/native/app/NativeAppRoutes.jsx` (lazy — the chunk is only fetched inside the shell), rendering `NativePublicShell` (5 fan tabs: **Home, News, Forum, Store, Account**; More sheet: Travel/Plan, Gallery, FAQ, Theme, Terms, Privacy, Admin entry for authorized users), native screens for fan surfaces, and (003C) `NativeAdminShell` with native-addressable sub-module routes (`/admin/content/news` etc. — native-only; web admin unchanged).

Canonical routes added on **both** platforms so universal links stay valid: `/news/:id`, `/forum/thread/:id` (web → alias to `/forum?thread=`), `/store/product/:id` (web → opens quick-view). Existing `/forum?thread=` links keep working everywhere.

Tab model: independent last-route memory per tab + per-path scroll memory (window-scroll model retained); tab reselect pops to root / scrolls to top; screens remount on switch but restore instantly from query cache + scroll memory (documented trade-off vs. parallel keep-alive trees). Semantic haptic dispatcher (`emitHaptic("tab.select")` …) with per-event throttling over the existing `haptics.js` wrappers.

Interim rule for 003A: tab screens may temporarily render existing page components inside native chrome; 003B replaces fan screens with native compositions. Nothing business-logic-bearing is duplicated at any point.

## 11. Critical blockers

None for 003A–003E (all work is client-side presentation + routing). External (not blocking code): Apple signing completion for TestFlight; `user_push_tokens` migration application; Supabase redirect allow-list + PKCE decision for native OAuth (003D implements behind a safe flag or documents the exact plan).
