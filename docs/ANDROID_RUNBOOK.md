# Android Runbook — Rugby League Takeover (Capacitor)

The Android shell lives in `android/` and uses Capacitor 8. The stable Play
identity is `com.rugbyleaguetakeover.app`; do not change it after the first
Play Console upload.

## Toolchain

- Node 22
- Android Studio 2025.2.1 or newer with Android SDK 36
- JDK 21 (JDK 17 is also supported by the Android Gradle plugin)
- Minimum device version: Android 7 / API 24
- Target/compile SDK: 36

## Local build and run

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run android:build
npm run android:open
```

In Android Studio, allow Gradle sync to finish, create an API 35 or 36 emulator,
and run the `app` configuration. `dist/` and the copied native web assets are
generated; never edit `android/app/src/main/assets/public` by hand.

## Signed AAB on Codemagic

The `android-capacitor` workflow in `codemagic.yaml` builds the Play upload
artifact on Linux. One-time setup:

1. Generate a dedicated RSA upload key and keep an offline backup. Do not use
   the Google Play app-signing key locally.
2. In Codemagic, upload that keystore under the exact reference
   `rlt_android_upload`.
3. If Android push registration is enabled, store the base64-encoded Firebase
   `google-services.json` as secure variable `FIREBASE_ANDROID_CONFIG` in the
   existing `rugby_env` group. Do not commit the JSON file.
4. Run the `android-capacitor` workflow. It validates the web app, syncs the
   shell, increments `versionCode` from Codemagic's build number, signs, and
   emits an `.aab` artifact. It does not publish to Google Play automatically.

## Android App Links

The manifest accepts verified HTTPS links for the `.com` and `.com.au` domains.
Verification becomes active only after Play App Signing provides the final
SHA-256 certificate fingerprint. Add that fingerprint to each site's
`/.well-known/assetlinks.json`, redeploy the websites, and confirm with:

```bash
adb shell pm verify-app-links --re-verify com.rugbyleaguetakeover.app
adb shell pm get-app-links com.rugbyleaguetakeover.app
```

## Push notifications

Capacitor's Android push registration uses Firebase Cloud Messaging. A Firebase
Android app with the same package ID and its `google-services.json` are required
before registration can succeed. The current repository only contains token
registration/persistence foundations; do not advertise push delivery until the
server send pipeline has been deployed and tested.
