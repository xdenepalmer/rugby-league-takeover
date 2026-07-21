# Google Play Checklist — Rugby League Takeover

Status legend: ✅ done in repo · 🔧 console/manual step · ⛔ release blocker

## Build identity and security

- ✅ App name: Rugby League Takeover
- ✅ Package ID: `com.rugbyleaguetakeover.app`
- ✅ Capacitor Android 8 shell; minimum API 24; target/compile API 36
- ✅ Branded adaptive/round/legacy launcher icons and dark splash assets
- ✅ Cleartext traffic and Android data backup/transfer disabled
- ✅ Release signing reads protected Codemagic variables; no keystore or password is committed
- 🔧 Enable Google Play App Signing and upload the first signed `.aab` to Internal testing
- 🔧 Publish `assetlinks.json` after the Play app-signing SHA-256 fingerprint exists

## Store listing

- 🔧 Default language: English (Australia); type: App; category: Sports
- 🔧 App access instructions for a non-admin test account
- 🔧 Short/full descriptions, support contact, privacy-policy URL
- 🔧 512 × 512 store icon, 1024 × 500 feature graphic, and phone screenshots
- 🔧 Content rating, target audience, ads declaration, news-app declaration,
  government-app declaration, financial-features declaration, and Data safety

## Policy blockers

- ⛔ **Account deletion:** the app supports account creation but currently has
  no prominent in-app deletion path or public deletion-request page. Google Play
  requires both. Add a reviewed `/account-deletion` page and a prominent link in
  Account/Profile, deploy it to the website, then use that public URL in Play
  Console before production submission.
- 🔧 Complete the Data safety form from actual production behavior. The app can
  handle account/profile data, user-generated forum/media content, purchase and
  order data, and diagnostics. Stripe processes card details outside the app;
  verify every answer against the deployed build and backend retention policy.
- 🔧 If Play Console applies the personal-account testing gate, complete its
  required closed test before applying for production access.

## Release sequence

1. Finish the policy blocker and production privacy/retention wording.
2. Create the Play app and enable Play App Signing.
3. Upload the signed AAB to Internal testing as a draft.
4. Finish App content and store-listing forms without making unimplemented push
   or payment claims.
5. Install from the internal-test link on a real Android device and run the
   smoke tests below.
6. Move beyond Internal testing only after the owner explicitly approves.

## Android smoke test

1. Cold launch shows the branded splash and home page without a white flash.
2. Register/sign in with email and password; Google OAuth remains hidden in the
   native shell until its native redirect flow is implemented.
3. Store checkout opens Stripe in the system browser and cancel/success returns
   to a usable app/site path.
4. Forum feed, composer, camera/gallery picker, reactions, and native share work.
5. External HTTPS, `mailto:`, `tel:`, and `sms:` links leave the WebView safely.
6. Offline banner appears and cached recent news remains readable.
7. No PWA install or update prompt appears inside the native app.
8. `.com` and `.com.au` links open the app after App Links verification is live.
9. Account deletion instructions are reachable from Account/Profile and work as
   described in the public page.
