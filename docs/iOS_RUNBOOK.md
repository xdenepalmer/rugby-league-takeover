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

## Mac prerequisites

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
  pipeline — see Push status below).
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
- **Auth emails & Google OAuth**: redirect links are built from the canonical
  web origin (`redirectBase()` in `src/api/base44Client.js`), so email
  confirmation / password reset / OAuth land on the **website**, not back in
  the app. Full in-app return requires Associated Domains + Supabase Auth
  redirect allow-list entries — deferred, see APP_STORE_CHECKLIST.
- **Stripe checkout**: opens in the system browser sheet
  (`openExternalUrl`); Stripe's success/cancel return lands on the website.
  Orders are webhook-authoritative (`stripeWebhook`), so a missed redirect
  never loses an order. In-app return via universal link is a follow-up.
- **External links** (tickets, sponsors, user-posted links): a global
  interceptor in `NativeAppBootstrap` opens foreign hosts in the system
  browser and turns absolute links to our own domain into router navigations.
  `mailto:` links are left to WKWebView defaults (known gap — may be inert on
  some devices).

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

All of this runs on Linux/CI. 106 tests at time of writing; the new
native-specific guards are covered by `tests/native-env.test.mjs`,
`tests/native-guards.test.mjs`, `tests/capacitor-config.test.mjs`.

## Common failures

- **Blank screen on launch**: `dist/` is stale or missing — run `npm run ios:build`.
- **Splash never hides**: `NativeAppBootstrap` hides it after React mounts; if
  you see a stuck splash, the JS crashed before mount — check the Xcode console.
- **Signing errors**: set the Team on the App target; automatic signing is fine
  for development.
- **Universal links not opening the app**: TEAMID still placeholder in the AASA
  file, Associated Domains capability missing, or Apple's CDN cache (can take
  up to a day; verify with `curl -s https://rugbyleaguetakeover.com/.well-known/apple-app-site-association`).
