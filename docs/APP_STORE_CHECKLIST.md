# App Store / TestFlight Checklist — Rugby League Takeover

Status legend: ✅ done in repo · 🔧 manual Mac/portal step · ⏳ deferred story

## Identity & assets

- ✅ Bundle ID `com.rugbyleaguetakeover.app`, app name "Rugby League Takeover" (`capacitor.config.json`)
- 🔧 App Store name/subtitle, category (Sports), age rating questionnaire
- 🔧 **1024×1024 marketing icon (no alpha)** — needs master art from the design
  owner; only 512px web icons exist (`public/icons/`)
- 🔧 Splash/launch assets via `@capacitor/assets` (dark `#030712` background configured)
- 🔧 Screenshots: 6.7" and 6.1" iPhone sets minimum

## Capabilities & privacy

- 🔧 Push Notifications capability + APNs key (do NOT submit push marketing
  claims while delivery is unimplemented). ✅ AppDelegate token-forwarding
  hooks are already committed
- 🔧 Associated Domains `applinks:rugbyleaguetakeover.com`; replace `TEAMID` in
  `public/.well-known/apple-app-site-association` (served correctly by
  `vercel.json` already ✅)
- 🔧 Info.plist usage strings: `NSCameraUsageDescription`,
  `NSMicrophoneUsageDescription`, `NSPhotoLibraryUsageDescription`
  (upload pickers in forum/account/admin can invoke the camera)
- 🔧 `PrivacyInfo.xcprivacy` privacy manifest (UserDefaults CA92.1, file
  timestamp C617.1, boot time 35F9.1)
- 🔧 App Privacy questionnaire: account data (name, email), user content
  (posts, photos), purchase history (Stripe — **physical merch, so external
  payment is allowed**; no IAP required for physical goods)

## Guideline 4.2 (wrapper-rejection) mitigation — cite what's real

Implemented native behavior to list in the review notes:
- Native share sheet (news/forum/gallery/store shares)
- Haptic feedback across tab bar, cart, forum posting, checkout handoff
- System-browser handoff for checkout and external links (no in-webview escapes)
- Deep-link / universal-link routing into app screens
- Offline banner + cached recent news for offline opens
- Native status-bar/splash integration, safe-area-native layout, no PWA prompts
- Planned (do not claim yet): push notifications

## Deferred stories (blockers for specific claims, not for TestFlight)

- ⏳ Push delivery pipeline (APNs key + Supabase send function + apply
  migration 0009; UI toggle in Account notification preferences)
- ⏳ In-app return for Supabase auth links + Google OAuth (Associated Domains
  + Supabase redirect allow-list + `detectSessionInUrl` handling of the
  returned URL). ✅ Interim: Google OAuth is hidden in the shell
  (`canUseGoogleOAuth`); email/password works natively
- ⏳ In-app return from Stripe checkout (add native return URL to
  `CHECKOUT_ALLOWED_ORIGINS`)

## TestFlight smoke test (per build)

Routes (from `src/App.jsx`):
1. `/` — home loads, countdown, background video, marquee ticker animates
2. `/store` — products render; add to cart (haptic tap); checkout opens the
   **system browser sheet**, not the webview; cancel returns to a working app
3. `/forum` — feed loads; composer opens keyboard-safe; post succeeds (success
   haptic); share opens the **native share sheet** with an `https://` link;
   a `mailto:` link in a post opens the Mail sheet
4. `/news` — loads; then enable Airplane Mode, relaunch: recent articles still
   render + offline banner shows
5. `/gallery` — lightbox opens, swipes, shares
6. `/faq`, `/terms`, `/privacy` — render
7. `/login` → **no Google button in the shell** (email/password only); sign in
   → `/account` loads; sign out returns cleanly
8. `/admin` — non-admin blocked; admin account sees dashboard
9. **No PWA prompts anywhere** ("Add to home screen" / "Update available" must
   never appear in the shell)
10. Safe areas: tab bar clears the home indicator; content clears the notch
11. Deep link: open `https://rugbyleaguetakeover.com/forum?thread=<id>` from
    Notes → app opens on the thread (after Associated Domains is live)
12. Theme accents (Account → accent picker) still apply and persist

## Native product (RLT-IOS-003) — status

- ✅ Distinct native shell: five fan tabs, Takeover sheet, no web chrome in-app
- ✅ Native fan screens (Home dashboard, News reader `/news/:id`, Forum feed +
  `/forum/thread/:id`, Store + `/store/product/:id` + cart, touch Gallery,
  Account hub) and native admin shell (all 22 managers reachable)
- ✅ Canonical share/deep-link routes valid on web AND native
- ✅ Query-cache persistence with PII denylist; notification tap-routing map
- ✅ Checkout return screens (webhook remains payment authority) — 🔧 device
  verification once universal links are live
- ⏳ Native Google OAuth (exact plan in `docs/NATIVE_ARCHITECTURE.md`) — Google
  stays hidden in the shell until device-proven
- ⏳ APNs delivery pipeline (RLT-IOS-004) — tokens register; nothing sends yet
- 🔧 Screenshots for the store listing should be retaken from the NATIVE
  screens once a signed build runs
