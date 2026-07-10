# iOS Runbook — Rugby League Takeover (Capacitor)

The native iOS shell lives in `ios/` and is driven by Capacitor 8 (SPM-based —
**no CocoaPods required**). The web app is unchanged: everything native is
behind `isNativeApp()` guards in `src/lib/native/`.

## What works where

| Step | Linux/CI (this repo's automation) | Mac + Xcode |
|---|---|---|
| `npm ci` / test / lint / typecheck / build | ✅ | ✅ |
| `npx cap add ios` (scaffold) | ✅ (already committed) | ✅ |
| `npx cap sync ios` (copy dist → shell, update SPM plugin list) | ✅ | ✅ |
| Resolve SPM packages, build, sign, run, archive | ❌ | ✅ |

## Building without a Mac — Codemagic (recommended for Windows)

A starter `codemagic.yaml` at the repo root builds the iOS app on Codemagic's
macOS runners and can push straight to TestFlight — no local Mac required.
One-time setup in the Codemagic UI:

This app follows the shared **team** signing convention used by every iOS app
in the account: ONE Apple distribution certificate, reused via a single RSA key.
One-time setup in the Codemagic UI (all of it is team-level except the runtime
group):

1. Connect this GitHub repo to a Codemagic app **in the same Codemagic team**
   as the other iOS apps — otherwise it can't see the shared `appstore` group
   or the `codemagic` integration below.
2. The shared **App Store Connect API key** integration is named `codemagic`
   (issuer `05b5e87a-6136-41db-96c9-8e9ccb3c824a`); it is team-level, so no
   per-app setup — `codemagic.yaml` just references it.
3. The shared `appstore` variable group holds ONLY `CERTIFICATE_PRIVATE_KEY`
   (secure) — the account-wide distribution key. Do not add anything else to
   it. The `Set up code signing` step runs `app-store-connect
   fetch-signing-files "$BUNDLE_ID" --type IOS_APP_STORE
   --certificate-key=@file:… --create`, which **reuses** the distribution
   certificate that matches the shared key and only mints one if none exists.
   (After a green build, the Apple Developer portal must still show exactly 3
   distribution certs — a 4th means the key didn't match.)
4. Create this app's OWN `rugby_env` variable group with its runtime config —
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable, RLS-guarded),
   and optionally `VITE_RAPIDAPI_KEY`. Never reuse another app's. Safe defaults
   are baked into `src/api/supabaseClient.js`, so the group overrides them
   rather than being strictly required. Stripe/AusPost/Resend secrets are NOT
   build vars — they live in Supabase Edge Function secrets (see `.env.example`).
5. In the Apple Developer portal, add **Push Notifications** and
   **Associated Domains** capabilities to the App ID — with cloud builds
   there is no Xcode UI, so capabilities live on the App ID + entitlements
   (`ios/App/App` target) rather than being clicked in Xcode.
6. Info.plist usage strings and PrivacyInfo.xcprivacy (below) must be added
   to the committed `ios/` project since every build starts from git.

The `ios` workflow installs deps, builds the web bundle + `cap sync ios`, sets
up shared-cert signing, drives a unique build number from Codemagic's
incrementing `$BUILD_NUMBER` (the project pins `CURRENT_PROJECT_VERSION=1`, and
a fixed version is rejected as a duplicate upload — "attribute with a value
that has already been used"), then runs `xcode-project build-ipa` on the
SPM-based `App.xcodeproj` and publishes to App Store Connect / TestFlight.
NOTE: `$BUILD_NUMBER` must stay ahead of the highest build TestFlight already
has; if this Codemagic app is new, bump its build-number counter in the UI
before the first upload so it doesn't collide with an existing build.

## Mac prerequisites (only if building locally instead of Codemagic)

- macOS with **Xcode 15+** (16+ recommended) and command-line tools
- Node 22 + npm (`nvm use 22`)
- An Apple Developer account (Team) for signing; App Store Connect access for TestFlight
- No CocoaPods needed — the project uses Swift Package Manager (`ios/App/CapApp-SPM`)

## Build & run

```bash
npm ci
npm run ios:build        # vite build && cap sync ios
npm run ios:open         # opens ios/App in Xcode
```

In Xcode:
1. Select the **App** target → Signing & Capabilities → set your Team.
   Bundle ID is `com.rugbyleaguetakeover.app` (change only with a matching
   update to `capacitor.config.json` and the AASA file).
2. First open: let Xcode resolve the Swift packages (CapApp-SPM).
3. Pick a simulator or plugged-in iPhone → Run.

Every time web code changes: `npm run ios:build` again (or `npm run ios:sync`
if `dist/` is already fresh). **Never edit `ios/App/App/public` by hand** — it
is generated and gitignored.

## Capabilities & Info.plist (manual, one-time in Xcode)

- **Push Notifications** capability + **Background Modes → Remote notifications**.
  Create an APNs key in the Apple Developer portal (needed later for the send
  pipeline — see Push status below). The APNs token-forwarding hooks in
  `AppDelegate.swift` (`didRegisterForRemoteNotificationsWithDeviceToken` →
  `NotificationCenter`) are **already in place** — nothing else native is
  needed for token registration once the capability is enabled.
- **Associated Domains**: add `applinks:rugbyleaguetakeover.com`.
  Then replace `TEAMID` in `public/.well-known/apple-app-site-association`
  with the real Team ID and redeploy the website (Vercel serves the file with
  `Content-Type: application/json` — rule already in `vercel.json`).
- **Info.plist usage strings** (the forum/admin upload pickers can offer the
  camera; missing strings crash the app when a user taps "Take Photo"):
  - `NSCameraUsageDescription` — "Take a photo or video to attach to your forum post or profile."
  - `NSMicrophoneUsageDescription` — "Record video with sound for forum and gallery uploads."
  - `NSPhotoLibraryUsageDescription` — "Choose photos or videos to attach to posts and your profile."
- **PrivacyInfo.xcprivacy**: add an app privacy manifest declaring
  UserDefaults (CA92.1), file timestamp (C617.1) and system boot time (35F9.1)
  accessed-API reasons; Capacitor's SPM packages ship their own manifests.

## Fonts

Inter and Oswald are **self-hosted** via `@fontsource` (imported in
`src/main.jsx`); the woff2 files ship as hashed `/assets`, so brand typography
works offline and in the shell with no Google CDN dependency.

## Icons & splash

Only 192/512px web icons exist in `public/icons/`. For the App Store you need
a **1024×1024 master (no alpha)** and ideally a 2732×2732 splash source from
the design owner. Then, on any machine:

```bash
npm i -D @capacitor/assets
npx capacitor-assets generate --ios
```

Until then the scaffold's default asset catalog is a placeholder. The splash
background color (`#030712`) is already configured in `capacitor.config.json`
and matches the site's anti-white-flash background.

## Auth, checkout and links inside the shell — current behavior

- **Service worker / install / update prompts**: disabled in the shell
  (`shouldEnablePwaForEnvironment` + `getInstallPromptMode` guards). Web/PWA
  unchanged.
- **Auth emails**: redirect links are built from the canonical web origin
  (`redirectBase()` in `src/api/base44Client.js`), so email confirmation /
  password reset land on the **website**, not back in the app. Full in-app
  return requires Associated Domains + Supabase Auth redirect allow-list
  entries — deferred, see APP_STORE_CHECKLIST.
- **Google OAuth is hidden inside the shell** (`canUseGoogleOAuth` guard in
  Login/Register): Google blocks WebView logins (disallowed_useragent) and the
  session would land on the web origin anyway. Email/password sign-in works
  natively today; a Capacitor Browser + deep-link OAuth flow is the deferred
  fix. Web OAuth is unchanged.
- **Stripe checkout**: opens in the system browser sheet
  (`openExternalUrl`). The native in-app return is code-complete: Stripe
  redirects to `/store/checkout/success?session_id=…`, the universal link
  lands on the verification-gated native return screen, and
  `verifyCheckoutReturn` checks the session server-side (see "Checkout-return
  deployment" below — the edge functions still need deploying; until then
  legacy returns redirect into the verified page's soft "Order confirming"
  state, since 003O removed the URL-trusting success banner). Orders are
  webhook-authoritative (`stripeWebhook`), so a missed redirect never loses
  an order.
- **External links** (tickets, sponsors, user-posted links): a global
  interceptor in `NativeAppBootstrap` opens foreign hosts in the system
  browser and turns absolute links to our own domain into router navigations.
  `mailto:`/`tel:`/`sms:` links are routed to the OS handler via
  `@capacitor/app-launcher` (WKWebView ignores them from in-page navigation).

## Push notifications — status: token foundation only

- `src/lib/native/push.js` wraps permission/registration/token listeners.
  **Nothing prompts automatically** (an unexplained permission prompt is an
  App Review rejection).
- `supabase/migrations/0009_user_push_tokens.sql` defines the token table +
  RLS. **It has not been applied to the remote database** — apply it via the
  normal migration flow when the push story starts.
- No send pipeline exists. Do not enable the Push capability messaging claims
  in App Store Connect until delivery is actually implemented.

## Validation gate (run before every commit)

```bash
npm run lint && npm run typecheck && npm test && npm run build && npx cap sync ios
```

All of this runs on Linux/CI. 225 tests at time of writing; the new
native-specific guards are covered by `tests/native-env.test.mjs`,
`tests/native-guards.test.mjs`, `tests/capacitor-config.test.mjs`,
`tests/native-shell-polish.test.mjs` (chunking, OAuth guard, link classification,
fonts, AppDelegate hooks).

## Common failures

- **Blank screen on launch**: `dist/` is stale or missing — run `npm run ios:build`.
- **Splash never hides**: `NativeAppBootstrap` hides it after React mounts; if
  you see a stuck splash, the JS crashed before mount — check the Xcode console.
- **Signing errors**: set the Team on the App target; automatic signing is fine
  for development.
- **Universal links not opening the app**: TEAMID still placeholder in the AASA
  file, Associated Domains capability missing, or Apple's CDN cache (can take
  up to a day; verify with `curl -s https://rugbyleaguetakeover.com/.well-known/apple-app-site-association`).

## Native product architecture (RLT-IOS-003)

The shell now renders its OWN route tree (`src/native/`) — five fan tabs,
native detail routes, a native admin shell — while the web tree is untouched.
Read `docs/NATIVE_ARCHITECTURE.md` before changing navigation, share URLs,
caching or haptics; the architecture contracts are test-locked
(`tests/native-*.test.mjs`).

Codemagic now has two workflows:
- `ios` ("Rugby League Takeover (iOS)") — full signed build + TestFlight
  publish via the shared team cert (start manually).
- `ios-build-verify` — validation gate + web build + `cap sync` + UNSIGNED
  xcodebuild. No signing, no publishing; safe on any branch.

### Checkout-return deployment (RLT-IOS-003F)

The authoritative checkout return needs two Supabase Edge Function deploys:
`createCheckout` (changed: canonical session-id return URLs) and
`verifyCheckoutReturn` (new: read-only server-side session verification).
No new secrets. Until both are deployed, live checkouts still return to
`/store?success=true`, which redirects into the verified return page's soft
"Order confirming" state on both platforms (003O removed the URL-trusting
success banner and cart clear); full session verification kicks in once the
new `createCheckout` ships a `session_id`.
