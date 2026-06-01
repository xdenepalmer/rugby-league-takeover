# Mobile/PWA Admin Upgrade Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Rugby League Takeover feel excellent on phones and as an installable PWA, with admin management fully usable from a phone for orders, forum moderation, products, users, bans, settings, events, content, and invites.

**Architecture:** Keep the current React + Vite + Base44 app. Add a guarded PWA layer, mobile-first admin shell, shared mobile-safe admin primitives, and route-level verification. Do not cache authenticated Base44 API responses. Treat offline admin as read-only/degraded at first, not queued writes.

**Tech Stack:** React 18, Vite 6, Tailwind CSS 3, Radix UI, Vaul drawer, TanStack Query, Framer Motion, Base44 SDK/functions/entities, Node test runner. Optional implementation dependency: `vite-plugin-pwa` if the team wants generated Workbox precaching instead of a small custom service worker.

---

## Sources Checked

- MDN: [Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- MDN: [Offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)
- MDN: [PWA caching strategies](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching)
- MDN: [CSS env() safe-area variables](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env)
- web.dev: [Web app manifest](https://web.dev/learn/pwa/web-app-manifest)
- web.dev: [PWA app design](https://web.dev/learn/pwa/app-design)
- Apple Developer archive: [Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)

## Current Repo State

- Branch observed: `main`, tracking `origin/main`.
- Working tree is not clean at audit time. Existing uncommitted changes touch forum media/mentions:
  - `base44/entities/ForumPost.jsonc`
  - `base44/functions/submitForumPost/entry.ts`
  - `src/components/forum/ReplyTree.jsx`
  - `src/pages/Forum.jsx`
  - `base44/functions/searchUsers/`
  - `src/components/forum/ForumMedia.jsx`
  - `src/components/forum/MediaAttach.jsx`
  - `src/components/forum/MentionTextarea.jsx`
- Implementation must preserve those changes unless the owner explicitly asks to revert them.

## High-Level Audit

### Critical Findings

1. **PWA is currently incomplete.**
   - `index.html` links `/manifest.json`, but no `manifest.json` or `public/` directory exists.
   - There is no service worker registration or offline fallback.
   - The HTML title is still `Base44 APP`.
   - The favicon points at a remote Base44 media URL.

2. **Admin is visually responsive, but not phone-ergonomic yet.**
   - `AdminLayout.jsx` has a mobile drawer, but admin navigation is still desktop-first and not optimized for one-handed phone use.
   - Many controls are `h-7`, `h-8`, `w-7`, `w-8`, `p-1.5`, or `text-[7px]` to `text-[9px]`.
   - These are too small for repeated mobile admin work.

3. **Long admin forms need sticky mobile actions.**
   - `SiteSettingsManager.jsx` is especially risky on phone: large forms, many collapsible areas, and save controls that are not persistently available.
   - Events, products, travel packages, bans, and user management also benefit from sticky confirm/cancel bars and bottom sheets.

4. **Mobile dialogs and popovers need a phone pattern.**
   - `DateTimePicker.jsx` uses a Radix popover with calendar/time controls.
   - `BanDialog.jsx` uses a centered dialog without mobile height/safe-area handling.
   - These should become responsive drawers/sheets on small screens.

5. **Admin overview uses decorative/fake telemetry and heavy motion.**
   - `AdminOverview.jsx` includes random values for API latency and sessions.
   - Recharts and many animated cards load into the mobile admin dashboard.
   - Phone admin should prioritize "needs action now" over charts.

6. **PWA/mobile safe areas are not handled.**
   - The viewport meta lacks `viewport-fit=cover`.
   - Fixed bottom controls/FABs do not account for `env(safe-area-inset-bottom)`.
   - `100vh` appears in admin layout math; use `100dvh` for mobile stability.

7. **Forum mobile is improved but still has touch issues.**
   - The public forum now has a mobile compose sheet and FAB.
   - Reply/reaction/share controls are still small and partially hover-oriented.
   - The mobile compose sheet closes immediately on submit, even before mutation success/failure is known.
   - Current media/mention work is partial: several forum UI paths use it, but mobile compose and thread-detail reply flows still need completion and phone verification.

8. **Admin discovery should be more explicit.**
   - Admin users have `/admin`, public nav drawer "Admin Panel", and account "Admin Center".
   - A phone-first implementation should add a clear installed-app shortcut and persistent admin entry for admins, plus a better no-access explanation for non-admin users.

## Product Principles

- Phone admin is not just "desktop squeezed down". The first mobile screen should show urgent actions: pending forum posts, paid orders to fulfill, new registrations, low stock, and recent errors.
- Every primary admin tap target should be at least 44px high/wide on mobile.
- Mobile admin should have bottom navigation or a command switcher, not only a left drawer.
- PWA offline should keep the shell available and make read-only/degraded state explicit. Do not queue admin writes until conflict handling exists.
- PWA install should be discoverable for admins, but installation must not break browser use.
- Service worker caching must never cache `/api/`, auth/session responses, Stripe checkout responses, or Base44 function/entity mutation payloads.
- Motion should be reduced on small screens and disabled when `prefers-reduced-motion: reduce`.
- Fixed headers, bottom bars, drawers, carts, and FABs must respect safe areas.

## Target Acceptance Criteria

- On iPhone SE width, iPhone 14/15/16 class widths, Pixel 7/8 class widths, and small Android Chrome:
  - Admin nav can switch all sections without awkward reach or horizontal overflow.
  - Orders, forum moderation, products, settings, users, bans, events, and invites can be completed one-handed.
  - No critical action button is smaller than 44px on mobile.
  - Long admin forms have persistent save/cancel or submit/cancel actions.
  - Popovers become drawers/sheets or native inputs on mobile.
  - Fixed bottom controls are not hidden by the home indicator.
- PWA:
  - Manifest loads and contains `name` or `short_name`, `start_url`, `display`, `theme_color`, `background_color`, `id`, and icons including 192px and 512px.
  - App shell loads after the first visit if network is unavailable.
  - Admin screens show an offline/degraded banner and block writes while offline.
  - Preview/dev contexts do not keep stale service workers.
  - Public pages and `/admin` can be launched from installed mode.
- Verification:
  - `npm test`
  - `npm run lint`
  - `npm run build`
  - Browser/mobile viewport checks for `/`, `/forum`, `/store`, `/account`, `/admin`, `/admin/community`, `/admin/store`, `/admin/people`, `/admin/settings`.

## Implementation Plan

### Phase 0 - Protect Current Work

- [ ] Run:

```powershell
git status --short --branch
git diff --stat
```

- [ ] Confirm whether the current uncommitted forum media/mention work should be included in the implementation branch. If implementing immediately, do not overwrite it.
- [ ] Create a working branch only after deciding how to handle current changes:

```powershell
git switch -c codex/mobile-pwa-admin-upgrade
```

- [ ] If keeping the current changes, add tests or complete the partial forum media UI as part of the forum mobile phase.

### Phase 1 - PWA Foundation

#### 1.1 Add PWA Guards

- [ ] Create `src/lib/pwa-env.js`.

```js
const PREVIEW_HOST_PATTERNS = [
  /(^|\.)base44\.app$/i,
  /preview/i,
  /localhost/i,
  /127\.0\.0\.1/i,
];

export function isPreviewLikeUrl(urlString) {
  const url = new URL(urlString);
  if (url.searchParams.has("app_id") || url.searchParams.has("access_token")) return true;
  return PREVIEW_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname));
}

export function shouldEnablePwa({ href, envMode }) {
  if (envMode !== "production") return false;
  if (!("serviceWorker" in navigator)) return false;
  return !isPreviewLikeUrl(href);
}
```

- [ ] Add `tests/pwa-env.test.mjs`.

```js
import test from "node:test";
import assert from "node:assert/strict";
import { isPreviewLikeUrl } from "../src/lib/pwa-env.js";

test("detects preview/auth URLs that should not retain PWA caches", () => {
  assert.equal(isPreviewLikeUrl("https://example.com/?app_id=abc"), true);
  assert.equal(isPreviewLikeUrl("https://example.com/?access_token=abc"), true);
  assert.equal(isPreviewLikeUrl("https://localhost:5173/"), true);
  assert.equal(isPreviewLikeUrl("https://rugbyleaguetakeover.com/"), false);
});
```

#### 1.2 Add Manifest and Icons

- [ ] Create `public/manifest.webmanifest`.
- [ ] Add local icon assets under `public/icons/`.
- [ ] Use non-transparent square PNGs for app icons.
- [ ] Include `shortcuts` for public forum, store, account, and admin:

```json
{
  "id": "/",
  "name": "Rugby League Takeover",
  "short_name": "RLT Vegas",
  "description": "Rugby League Takeover Las Vegas news, store, forum, travel, and admin.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#030512",
  "theme_color": "#f97316",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Admin", "short_name": "Admin", "url": "/admin", "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }] },
    { "name": "Forum", "short_name": "Forum", "url": "/forum", "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }] },
    { "name": "Store", "short_name": "Store", "url": "/store", "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }] }
  ]
}
```

- [ ] Add `tests/manifest.test.mjs` that parses `public/manifest.webmanifest` and checks install-critical fields.

#### 1.3 Fix HTML Metadata

- [ ] Update `index.html`:
  - Replace `/manifest.json` with `/manifest.webmanifest`.
  - Replace title `Base44 APP` with `Rugby League Takeover`.
  - Add `theme-color`.
  - Add local favicon and apple touch icon links.
  - Add `viewport-fit=cover`.
  - Keep the existing preview cache cleanup, but move logic into explicit PWA guard functions if possible.

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#f97316" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" type="image/png" href="/icons/icon-192.png" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
<title>Rugby League Takeover</title>
```

- [ ] Decide on Apple-specific standalone tags only after testing. Prefer manifest-first. If target iOS Safari still needs them for Add to Home Screen behavior, add:

```html
<meta name="apple-mobile-web-app-title" content="RLT Vegas" />
```

#### 1.4 Add Service Worker Strategy

Choose one implementation path:

**Option A: `vite-plugin-pwa`**

- [ ] Install:

```powershell
npm install -D vite-plugin-pwa
```

- [ ] Update `vite.config.js` with `VitePWA`.
- [ ] Cache only app shell/static assets and offline fallback.
- [ ] Use `NetworkOnly` or no SW handling for:
  - `/api/`
  - Base44 entity/function calls
  - auth URLs
  - Stripe checkout
  - requests with `Authorization` or app tokens

**Option B: Custom service worker**

- [ ] Create `public/sw.js`.
- [ ] Precache `"/"` and `"/offline.html"` only.
- [ ] Network-first app navigations with offline fallback.
- [ ] Static asset caching only for safe local build assets and local icons.
- [ ] Explicitly bypass API/auth/payment traffic.

#### 1.5 Register Service Worker

- [ ] Create `src/lib/register-service-worker.js`.

```js
import { shouldEnablePwa } from "@/lib/pwa-env";

export async function registerServiceWorker() {
  if (!shouldEnablePwa({ href: window.location.href, envMode: import.meta.env.MODE })) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    console.warn("Service worker registration failed", error);
  }
}
```

- [ ] Call it from `src/main.jsx`.

```jsx
import { registerServiceWorker } from "@/lib/register-service-worker";

registerServiceWorker();
```

### Phase 2 - Mobile System Primitives

#### 2.1 Add Safe Area and Touch Utilities

- [ ] Update `src/index.css`.

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
}

html, body, #root {
  min-height: 100%;
}

body {
  overscroll-behavior-y: contain;
}

.touch-target {
  min-height: 44px;
  min-width: 44px;
}

.pb-safe {
  padding-bottom: var(--safe-bottom);
}

.bottom-safe {
  bottom: var(--safe-bottom);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.001ms !important;
  }
}
```

- [ ] Replace `min-h-screen` on app shells with `min-h-[100dvh]` where mobile fixed areas are involved.
- [ ] Replace `calc(100vh - 54px)` in `AdminLayout.jsx` with a CSS class based on `100dvh`.

#### 2.2 Add Responsive Dialog/Drawer Abstraction

- [ ] Create `src/components/admin/MobileActionDrawer.jsx`.
- [ ] It should use Vaul `Drawer` below `md`, and Radix `Dialog` or existing `DialogContent` above `md`.
- [ ] Refactor `BanDialog.jsx` to use this abstraction.
- [ ] Ensure max height, scrolling, and safe-area padding:

```jsx
<DrawerContent className="max-h-[92dvh] overflow-y-auto rounded-none pb-safe">
```

#### 2.3 Add Admin Sticky Action Bar

- [ ] Create `src/components/admin/AdminStickyActionBar.jsx`.
- [ ] Use it in long forms and destructive/confirmation flows.

```jsx
export default function AdminStickyActionBar({ children }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-background/95 px-4 py-3 pb-[calc(0.75rem+var(--safe-bottom))] backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">{children}</div>
    </div>
  );
}
```

#### 2.4 Normalize Mobile Buttons

- [ ] Add mobile variants to `src/components/ui/button.jsx`:
  - `mobile`: `h-11 px-4 text-xs`
  - `mobileIcon`: `h-11 w-11`
- [ ] Do not globally change desktop dense buttons. Refactor mobile admin action bars to use mobile variants.

### Phase 3 - Phone-First Admin Shell

#### 3.1 Rework Admin Navigation

- [ ] Update `src/components/admin/AdminLayout.jsx`.
- [ ] Add a bottom tab/nav for mobile:
  - Overview
  - Content
  - Events
  - Store
  - Community
  - People
  - Settings
- [ ] Keep desktop sidebar for `lg+`.
- [ ] Add an "Admin" quick action in public mobile nav and account if `isAdmin` is true.
- [ ] Use manifest shortcut `/admin` so installed admins can launch directly to admin.

#### 3.2 Add Admin Mobile Landing Priority

- [ ] In `AdminOverview.jsx`, add a mobile-first "Needs action" section above charts:
  - Pending forum posts
  - Paid orders not fulfilled
  - Low-stock products
  - New registrations
  - Active bans/users needing review
- [ ] Hide charts behind a "Metrics" collapsible on mobile.
- [ ] Remove random telemetry (`Math.random`) and label unavailable status honestly.

#### 3.3 Add Offline/Degraded Banner

- [ ] Create `src/hooks/use-online-status.js`.
- [ ] Create `src/components/admin/AdminOfflineBanner.jsx`.
- [ ] Show a sticky banner in `AdminLayout.jsx` when offline.
- [ ] Disable mutation buttons while offline and show "Reconnect to save changes".

### Phase 4 - Admin Workflow Upgrades

#### 4.1 Site Settings on Phone

- [ ] Update `src/components/admin/SiteSettingsManager.jsx`.
- [ ] Add sticky save/discard bar for dirty state.
- [ ] Add a compact module picker at the top on mobile.
- [ ] Make category navigation horizontally scrollable with 44px minimum items.
- [ ] Keep preview collapsed by default on phone.
- [ ] Replace remote Unsplash defaults with local or controlled assets when possible.
- [ ] Audit and remove invalid Tailwind utilities such as `rotate-185`.

Acceptance:
- Edit hero title on a phone, scroll away, and save without hunting for the button.
- Dirty state is visible.
- Leaving the screen with unsaved changes prompts or clearly warns.

#### 4.2 Forum Moderation

- [ ] Update `src/components/admin/ForumManager.jsx`.
- [ ] Convert approve/reject/ban/delete controls into a mobile action row or bottom action sheet.
- [ ] Increase switch and action controls to 44px on mobile.
- [ ] Avoid tiny icon-only destructive controls unless they have labels or tooltips.
- [ ] Replace literal emoji/symbol markers with lucide icons.

Acceptance:
- Admin can approve, reject, delete, ban user, and ban IP from a phone with no precision tapping.

#### 4.3 Orders

- [ ] Update `src/components/admin/OrdersManager.jsx`.
- [ ] Keep the mobile accordion pattern; it is a good base.
- [ ] Increase quantity/status controls to 44px on phone.
- [ ] Add a sticky status/notes save area inside expanded cards.
- [ ] Ensure long emails/order ids truncate cleanly.

Acceptance:
- Admin can mark an order fulfilled and add notes from a phone without horizontal scroll.

#### 4.4 Products and Store Admin

- [ ] Update `src/components/admin/ProductsManager.jsx`.
- [ ] Use a phone card layout with:
  - Full-width product image or fixed thumbnail row with stable dimensions.
  - 44px edit/delete/toggle buttons.
  - Stock controls that can be adjusted without tiny taps.
- [ ] Update `src/components/admin/StorePanel.jsx` if its tab/header spacing consumes too much phone viewport.

Acceptance:
- Admin can create, edit price, edit stock, toggle active, and delete with confirmation from a phone.

#### 4.5 Users, Invites, and Bans

- [ ] Update `src/components/admin/UsersManager.jsx`.
- [ ] Use action sheets for role change, disable, ban, and reinstate on mobile.
- [ ] Make role select full-width in mobile cards.
- [ ] Update `src/components/admin/UserInviteManager.jsx` with a compact phone form and sticky send button.
- [ ] Update `src/components/admin/BansManager.jsx` with a mobile add-ban drawer.

Acceptance:
- Admin can invite another admin, demote/promote users, ban, and lift bans from a phone.

#### 4.6 Events, Matchups, Travel, Content

- [ ] Update `DateTimePicker.jsx`:
  - Mobile: native `input type="datetime-local"` or a drawer-based calendar/time UI.
  - Desktop: keep existing popover.
- [ ] Apply to `EventsManager.jsx`, `MatchupsManager.jsx`, and `SiteSettingsManager.jsx`.
- [ ] Update `NewsManager.jsx`, `TravelPackagesManager.jsx`, `TeamsManager.jsx`, `PartnersManager.jsx`, and `FaqManager.jsx` for 44px mobile action controls.

Acceptance:
- Admin can create an event, edit kickoff/countdown date, edit travel copy, and save content from a phone.

### Phase 5 - Public Mobile Polish

#### 5.1 Public Nav and Admin Discovery

- [ ] Update `src/components/public/SiteNav.jsx`.
- [ ] Use safe-area padding for the drawer.
- [ ] Increase close/menu/account/cart touch targets.
- [ ] For admins, include a highly visible "Admin" action in the mobile drawer and account area.
- [ ] Add installed-mode affordance if `display-mode: standalone`, such as a compact back/home row where appropriate.

#### 5.2 Forum Phone UX

- [ ] Complete or remove partial forum media/mention work:
  - Import and use `MediaAttach`.
  - Import and use `ForumMedia`.
  - Import and use `MentionTextarea`, or remove it until ready.
- [ ] Do not close the mobile compose sheet until `createMutation` succeeds.
- [ ] Add error handling in the sheet.
- [ ] Replace hover-only reaction picker behavior with tap-safe behavior.
- [ ] Make reply/delete/reaction controls 44px on mobile.
- [ ] Ensure thread detail modal bottom reply form stays usable with mobile keyboard.

Acceptance:
- A visitor can create a post, add media if enabled, reply to a thread, and recover from submit errors on mobile.

#### 5.3 Store Phone UX

- [ ] Update `src/pages/Store.jsx`.
- [ ] Add safe-area padding to cart drawer footer and mobile cart FAB.
- [ ] Increase cart quantity buttons from `h-7 w-7` to 44px on mobile.
- [ ] Remove decorative perpetual motion on mobile or behind reduced-motion/data-saver checks.
- [ ] Ensure checkout button remains visible above the home indicator and keyboard.

#### 5.4 Account Phone UX

- [ ] Update `src/pages/Account.jsx`.
- [ ] Make the admin link persistent for admins.
- [ ] Use horizontal scroll tabs with snap and 44px height.
- [ ] Avoid oversized stats before key account actions on small phones.

### Phase 6 - Performance and Motion

- [ ] Add reduced-motion CSS and audit Framer Motion infinite animations.
- [ ] On mobile:
  - Disable 3D tilt effects.
  - Disable floating particles.
  - Disable marquee/tickers unless user explicitly opens live activity.
  - Lazy-load Recharts/admin charts.
- [ ] Add `loading="lazy"`, `decoding="async"`, and stable aspect ratios to public and admin images.
- [ ] Consider self-hosting key fonts or providing excellent system fallbacks for offline launch.
- [ ] Remove decorative orb/blur backgrounds that create extra paint work on mobile.

### Phase 7 - PWA Offline/Update UX

- [ ] Add `src/components/PwaUpdateToast.jsx`.
- [ ] Show "Update available" when a new service worker is waiting.
- [ ] Add `src/components/OfflineStatusToast.jsx` or route banner for public pages.
- [ ] Admin offline behavior:
  - Read cached shell.
  - Show stale data if already in TanStack Query cache.
  - Disable writes.
  - Provide retry buttons.
- [ ] Public offline behavior:
  - Store/cart local cart remains visible.
  - Checkout disabled while offline.
  - Forum post/reply submit disabled with clear message.

### Phase 8 - Testing and Verification

#### 8.1 Node Tests

- [ ] Add/update:
  - `tests/pwa-env.test.mjs`
  - `tests/manifest.test.mjs`
  - Existing forum/media tests if forum media is completed.

- [ ] Run:

```powershell
npm test
```

#### 8.2 Lint and Build

- [ ] Run:

```powershell
npm run lint
npm run build
```

#### 8.3 Manual Mobile Viewports

- [ ] Start preview:

```powershell
npm run preview
```

- [ ] Verify these routes at 320, 375, 390, 414, and 430px widths:
  - `/`
  - `/forum`
  - `/store`
  - `/account`
  - `/admin`
  - `/admin/store`
  - `/admin/community`
  - `/admin/people`
  - `/admin/settings`

- [ ] Check:
  - No horizontal scroll.
  - No overlapping text.
  - Bottom bars/FABs clear safe area.
  - Keyboard does not hide submit/save controls.
  - Touch targets are usable.
  - Dialogs/drawers can be dismissed.
  - Admin actions show pending, success, and error states.

#### 8.4 PWA Checks

- [ ] Verify manifest fetches:

```powershell
Invoke-WebRequest http://localhost:4173/manifest.webmanifest
```

- [ ] In browser devtools:
  - Manifest parsed.
  - Service worker registered only when expected.
  - Offline app shell loads after first visit.
  - API/auth routes are not cached.
  - Update flow works.

## File Checklist

Expected new files:

- `public/manifest.webmanifest`
- `public/offline.html`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/icon-maskable-512.png`
- `src/lib/pwa-env.js`
- `src/lib/register-service-worker.js`
- `src/hooks/use-online-status.js`
- `src/components/PwaUpdateToast.jsx`
- `src/components/OfflineStatusToast.jsx`
- `src/components/admin/AdminStickyActionBar.jsx`
- `src/components/admin/AdminOfflineBanner.jsx`
- `src/components/admin/MobileActionDrawer.jsx`
- `tests/pwa-env.test.mjs`
- `tests/manifest.test.mjs`

Expected edited files:

- `index.html`
- `vite.config.js` if using `vite-plugin-pwa`
- `package.json` and `package-lock.json` if adding dependencies
- `src/main.jsx`
- `src/index.css`
- `src/components/ui/button.jsx`
- `src/components/admin/AdminLayout.jsx`
- `src/components/admin/AdminOverview.jsx`
- `src/components/admin/BanDialog.jsx`
- `src/components/admin/DateTimePicker.jsx`
- `src/components/admin/SiteSettingsManager.jsx`
- `src/components/admin/ForumManager.jsx`
- `src/components/admin/OrdersManager.jsx`
- `src/components/admin/ProductsManager.jsx`
- `src/components/admin/UsersManager.jsx`
- `src/components/admin/BansManager.jsx`
- `src/components/admin/UserInviteManager.jsx`
- `src/components/admin/EventsManager.jsx`
- `src/components/admin/MatchupsManager.jsx`
- `src/components/admin/TravelPackagesManager.jsx`
- `src/components/public/SiteNav.jsx`
- `src/pages/Forum.jsx`
- `src/pages/Store.jsx`
- `src/pages/Account.jsx`

## Risk Notes

- A service worker can break deployments if it caches stale Vite chunks. Keep the preview unregister behavior and add production-only guards.
- Do not cache authenticated Base44 entity/function responses.
- Do not cache Stripe checkout redirects or payment state.
- Do not queue admin writes offline in the first release.
- iOS installed-mode behavior should be verified on real device where possible; desktop emulation is not enough for safe areas and keyboard behavior.
- Current forum media/mention work appears incomplete across mobile UI paths. Either finish it as part of forum mobile polish or remove incomplete surfaces before final shipping.

## Suggested Execution Order

1. PWA metadata and guards.
2. Mobile-safe CSS/touch/dialog primitives.
3. Admin shell and "Needs action" overview.
4. Site settings sticky save and DateTimePicker mobile drawer.
5. Forum moderation, orders, products, users/bans/invites.
6. Public nav/forum/store/account polish.
7. Motion/performance reduction.
8. Offline/update UX.
9. Full verification and deploy/merge.

## Handoff

Use `superpowers:subagent-driven-development` if multiple agents are available:

- Agent 1: PWA foundation and tests.
- Agent 2: Admin shell/primitives.
- Agent 3: Admin workflow screens.
- Agent 4: Public mobile polish and forum media completion.
- Agent 5: Verification pass.

If working solo, use `superpowers:executing-plans` and complete one phase at a time. Stop after each phase to run relevant tests and verify no unrelated user changes were overwritten.
