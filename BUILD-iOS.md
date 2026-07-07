# Building the Rugby League Takeover iOS app

The iOS app is the **same** Rugby League Takeover web app, wrapped in a native
iOS shell with [Capacitor](https://capacitorjs.com). The web build (HTML/JS/CSS)
is **bundled inside the app** — it ships in the app bundle and loads locally, so
the app opens instantly and doesn't depend on a website being up. It still talks
to the same Supabase backend for live data (products, FAQs, orders, auth, etc.),
exactly like the website.

Everything here is already wired up and committed:

- `capacitor.config.json` — app id, name, splash + status-bar theming
- `ios/` — the native Xcode project (App icon + splash already branded)
- npm scripts: `ios:sync`, `ios:open`, `ios:add`

App identity (change these if you want):

| Setting          | Value                          | Where to change            |
| ---------------- | ------------------------------ | -------------------------- |
| Display name     | `Rugby League Takeover`        | `capacitor.config.json`    |
| Bundle ID (App ID) | `com.rugbyleaguetakeover.app`| `capacitor.config.json` + Xcode |

---

## The short version

Apple only lets you **compile and sign** an iOS app on a Mac with Xcode — that's
an Apple rule, not a Capacitor one. No tool builds a signed `.ipa` on Windows.

So the split is:

- **Windows laptop** — do all the app development: edit code, build the web app,
  bundle it into the iOS project, commit, push. (`npm run ios:sync`)
- **MacBook Pro (2019)** — open the project in Xcode, sign it with your Apple ID,
  and run it on your iPhone / export the app. (`npm run ios:open` → Xcode)

You do 95% on Windows. The Mac is only for the final signing + install step.

---

## One-time setup

### On the Windows laptop

1. Install [Node.js LTS](https://nodejs.org) (v18+).
2. In the project folder:
   ```bash
   npm install
   ```

### On the MacBook Pro

1. Install **Xcode** from the Mac App Store (free), open it once, and let it
   install the command-line components.
2. Install **CocoaPods** (native dependency manager Capacitor uses):
   ```bash
   sudo gem install cocoapods
   ```
3. Install [Node.js LTS](https://nodejs.org) here too.
4. Sign in to Xcode with your Apple ID: **Xcode → Settings → Accounts → +**.
   A free Apple ID is enough to install on your own iPhone (7-day signing).
   An Apple Developer Program membership ($99/yr) is needed for TestFlight / the
   App Store and removes the 7-day limit.

---

## Everyday workflow

### 1. On Windows — build + bundle the web app into the iOS project

```bash
npm run ios:sync
```

This runs `vite build` (produces `dist/`) and `cap sync ios` (copies the fresh
web build into the native project and updates native plugins). Commit and push:

```bash
git add -A
git commit -m "Update app"
git push
```

### 2. On the Mac — sign and run

```bash
git pull
npm install
npx cap sync ios      # regenerates the bundled assets + runs `pod install`
npm run ios:open      # opens ios/App/App.xcworkspace in Xcode
```

Then in Xcode:

1. Select the **App** target → **Signing & Capabilities** tab.
2. Tick **Automatically manage signing** and pick your **Team** (your Apple ID).
   If Xcode complains the bundle ID is taken, change it to something unique like
   `com.yourname.rugbyleaguetakeover` (also update `capacitor.config.json`).
3. Plug in your iPhone, pick it as the run target, press **▶ Run** to install it.
4. To share/export instead: **Product → Archive → Distribute App**.

> First launch on your iPhone: **Settings → General → VPN & Device Management →**
> trust your developer certificate.

---

## Why the Mac still runs a couple of commands

The native `ios/` project references CocoaPods dependencies (`Podfile`) that live
in `node_modules` and get resolved by `pod install` — and `pod install` +
`xcodebuild` only run on macOS. The generated/bundled bits
(`ios/App/App/public`, the Pods) are intentionally **not** committed (they're
regenerated), which keeps the repo clean. `npx cap sync ios` on the Mac
regenerates them in one command before you open Xcode. Everything you *author*
(code, config, icons) is committed and comes straight from Windows.

---

## Updating the app icon / splash (optional)

The icon and splash are already generated from the site logo
(`assets/icon.png`). To regenerate from a higher-resolution source, drop a
1024×1024 `assets/icon.png` (and optionally `assets/splash.png`,
`assets/splash-dark.png`) in place and run:

```bash
npx @capacitor/assets generate --ios \
  --iconBackgroundColor '#0a0a0a' --splashBackgroundColor '#0a0a0a'
```

Then `npx cap sync ios` and rebuild.

---

## Native behaviour (already wired up)

The web app detects when it's running inside the iOS shell and adjusts itself —
you don't need to do anything for these, they're in the code:

- **No service worker** in the app (the web assets are already bundled, so the
  PWA cache + "update available" prompts are disabled on device).
- **Splash + status bar** are handled natively (dark status bar, splash hides
  once the app has painted).
- **Stripe checkout** opens in an in-app Safari view and returns to the app when
  dismissed, instead of navigating away.
- **Photo / camera uploads** (avatar, forum media) work — the required
  permission prompts are declared in `Info.plist`. iOS shows your usage strings
  the first time; edit them in `Info.plist` if you want different wording.

## Google sign-in (one-time Supabase setup)

Native Google sign-in is wired up (in-app browser + deep link back into the
app via the `com.rugbyleaguetakeover.app://` URL scheme, registered in
`Info.plist`). **Email + password already works with no setup.** To turn on the
Google button in the app, add the app's redirect URL to Supabase:

1. Supabase dashboard → **Authentication → URL Configuration → Redirect URLs**.
2. Add: `com.rugbyleaguetakeover.app://auth/callback`
3. Save. (Google itself is already configured for the website, so nothing to
   change in Google Cloud.)

Until that URL is added, the Google button will fail on device — email/password
is the fallback. Web sign-in is unaffected either way.

## Remaining limitation

- Email links (verification / password reset) open in the phone's browser, then
  you return to the app — same as any web-backed app.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `pod: command not found` (Mac) | `sudo gem install cocoapods` |
| Xcode: "Signing requires a development team" | Pick your Team under Signing & Capabilities |
| Blank white screen on launch | You skipped `npx cap sync ios` after pulling — run it, then rebuild |
| Bundle ID already in use | Change it in Xcode **and** `capacitor.config.json` to something unique |
| Data won't load on device | The device needs internet — data comes live from Supabase |
| Google sign-in fails on device | Add `com.rugbyleaguetakeover.app://auth/callback` to Supabase → Auth → Redirect URLs (see above) |
| Photo picker does nothing / app closes | Old build — rebuild after `npx cap sync ios` so the `Info.plist` permission strings are included |

> **Changed the bundle ID?** Also update the URL scheme: `capacitor.config.json`
> doesn't hold it, but `ios/App/App/Info.plist` (`CFBundleURLSchemes`) and
> `AUTH_CALLBACK_URL` in `src/lib/native.js` must match your new ID, and so must
> the Supabase redirect URL.
