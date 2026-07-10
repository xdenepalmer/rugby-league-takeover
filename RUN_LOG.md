# RUN LOG — Rugby League Takeover

Append-only chronological log of BMAD agent actions, commands, and results.

---

## Claude — Initial audit (pre-BMAD)
- Branch `main`, HEAD `a46af15`. Working tree dirty (19 modified + 5 untracked tests); local 12 commits behind `origin/main`.
- Validation: `npm test` 38 pass · `npm run lint` clean · `npm run typecheck` clean · `npm run build` ok.
- BMAD lifecycle files: all missing. README generic; `package.json` = `base44-app`; `base44/config.jsonc` = `New App`.
- Verdict: not BMAD-ready — needs clean synced baseline + lifecycle files + identity.

## RLT-001A — Preserve dirty validated pre-BMAD state
- Created safety branch `bmad/baseline-preserve-current-state`; committed all dirty/untracked changes.
- Commit: `14d17a1` — "chore: preserve validated pre-BMAD working state". Tree clean after.
- Validation: `npm test` 38 pass · lint · typecheck · build all green.
- Part B (merge `origin/main`) → **conflicts** in `submitForumPost/entry.ts`, `src/index.css`, `src/pages/Forum.jsx`. Merge aborted (non-destructive). Stopped per protocol.

## RLT-001B — Conflict analysis (read-only)
- merge-base `a46af15`; divergence preserve+1 / origin+12.
- File #1 `submitForumPost` → **conceptual**: preserved = moderation gate (`is_published:false`); origin = auto-publish + casino rewards. Defer to RLT-001C.
- File #2 `index.css` → **mechanical** overlap on `.forum-engagement-bar` (preserved flex-wrap vs origin grid-4).
- File #3 `Forum.jsx` → origin **rewrote** (canonical); preserved = small className hooks → re-apply onto origin.
- Recommendation: Option A — origin canonical + cherry-pick preserved mobile layer + tests.

## RLT-001B — Reconciliation implementation
- Created `bmad/baseline-integration` from `origin/main` (`936e83d`). Preserve branch untouched.
- Re-applied preserved mobile-fit layer onto origin: `src/index.css` (added `.forum-mobile-content`/`.forum-action-button`/`.forum-sort-tabs`, 2-col filter rail, flex-wrap engagement bar; removed grid-4 + nested selectors) and `src/pages/Forum.jsx` (className hooks, `min-h-dvh`, filter-rail grid, CategoryPill clamp). Brought expanded `tests/forum-mobile-layout.test.mjs`.
- `submitForumPost` not changed; `forum-function-policy.test.mjs` excluded (RLT-001C).
- 5 tests deferred (out of scope) → RLT-001E.
- Commit: `ec63822` — "chore: reconcile baseline mobile layer".
- Validation: `npm test` 33 pass · lint · typecheck · build all green.

## RLT-001D — BMAD files + project identity/docs
- Created `TASKS.md`, `PROGRESS.md`, `AGENT_HANDOFF.md`, `RUN_LOG.md`.
- Replaced generic README with project-specific Rugby League Takeover README.
- Identity: `package.json` name → `rugby-league-takeover` (+ description); `package-lock.json` root/package name updated; `base44/config.jsonc` name → `Rugby League Takeover`.
- Scope: control-plane/docs only; no `src/`, `tests/`, functions, entities (except `config.jsonc`), CSS, or PWA assets touched. Concurrent Codex working-tree files left uncommitted.
- Validation: see handoff report. Commit: `f6d1271` "docs: establish BMAD baseline controls". Architect-approved.
- No push / no PR.

## RLT-001F — Isolate concurrent store-shipping WIP from baseline
- Found dirty store-shipping/orders WIP on `bmad/baseline-integration` (`f6d1271`): modified `StoreOrder.jsonc`, `createCheckout`, `stripeWebhook`, `OrdersTab.jsx`, `OrdersManager.jsx`, `Store.jsx`, `tests/checkout-rules*`, `.gitignore`; untracked `src/lib/store-shipping.js` + 4 store/account tests. No BMAD/doc files dirty.
- Preserved WIP on new branch `bmad/wip-store-shipping`; commit `f0684600` — "wip: preserve store shipping checkout changes". No work discarded.
- Restored `bmad/baseline-integration` to `f6d1271` (clean). Validation on clean baseline: `npm test` 33/33 · lint · typecheck · build all green. The prior single failure ("Stripe checkout … shipping") was WIP-only and is gone.
- Updated BMAD files (TASKS/PROGRESS/AGENT_HANDOFF/RUN_LOG); commit `5086ad0` "chore: record store shipping WIP isolation". Architect-approved.
- No push / no PR. Approved commits `ec63822`/`f6d1271` not altered.

## RLT-001G — Isolate Antigravity UI/UX WIP from baseline
- Found dirty UI/UX WIP on `bmad/baseline-integration` (`5086ad0`): 18 tracked files — `public/manifest.webmanifest`, `src/components/NotificationBell.jsx`, all `src/components/public/*` (AboutSection, BackgroundVideo, CountdownTimer, EventsSection, HeroSection, LocalVegasClock, MatchupsSection, NewsSection, PartnersSection, PublicLayout, SiteNav, TestimonialsSection, TravelSection), `src/index.css`, `src/pages/Forum.jsx`, `src/pages/Store.jsx`. No BMAD/doc files dirty.
- Preserved WIP on new branch `bmad/wip-antigravity-uiux` via `git add -u` (tracked modifications only; tooling dirs left untracked); commit `65d417f` — "wip: preserve antigravity ui ux pass". No work discarded.
- Restored `bmad/baseline-integration` to `5086ad0` (clean). Validation on clean baseline: `npm test` 33/33 · lint · typecheck · build all green.
- Updated BMAD files; commit: "chore: record antigravity WIP isolation".
- No push / no PR. Approved commits not altered. Reminder recorded: Antigravity changes must route through `ui-ux-pro-max` + an approved BMAD story before landing on baseline.

## RLT-001H-AMENDED — Preserve active Codex store-shipping WIP and repair branch discipline
- Re-inspected shared tree on `main` @ `65d417f`; dirty files were store-shipping WIP plus `.gitignore` safety change only. No BMAD markdown docs, README, package files, lockfile, or `base44/config.jsonc` dirty.
- Preserved current dirty WIP on `bmad/story-rlt-011-codex-store-shipping`; commit `46d069b` — "wip: preserve rlt-011 store shipping work". `.gitignore` was committed to this WIP branch for preservation only and remains unapproved for baseline.
- Restored `bmad/baseline-integration` to approved baseline `e059872` and kept local BMAD/agent tooling out of status via local-only `.git/info/exclude`; baseline tracked files remained clean.
- Validation on clean baseline before branch repair: `npm test` 33/33 · lint · typecheck · build all green.
- Confirmed `bmad/wip-antigravity-uiux` points to `65d417f`; fetched origin; repaired local `main` via approved `git reset --hard origin/main`, now `8c3dd79` and clean. No push / no PR.
- Returned to `bmad/baseline-integration`; updated BMAD files only. No feature implementation completed. Next implementation story remains RLT-001E from clean baseline after review approval.

## RLT-001E — Mobile/PWA/brand/store hardening (Claude)
- Branch `bmad/story-rlt-001e-claude` created from approved baseline `dacd266`. Antigravity WIP (`65d417f`) referenced only, not copied wholesale.
- Brought 5 deferred contract tests (app-shell-metadata, local-brand-assets, mobile-viewport-shells, store-checkout-ux, expanded manifest); excluded forum-function-policy (RLT-001C).
- Viewport: `min-h-screen`→`min-h-dvh` in AuthLayout, AdminShell, PublicLayout, Account, Home, Store, HeroSection (Forum already done); fixed HeroSection double-viewport (inner container no longer forces a second full height).
- PWA/brand: index.html now uses local `/icons/icon-192.png` + apple-touch-icon, adds description + OG + Twitter metadata; manifest uses local icons (192/512 + maskable-512) and per-shortcut local icons; removed remote Base44 logo from HeroSection/SiteNav/SiteSettingsManager/index.html/manifest (DB `site_logo_url` override preserved).
- Store checkout UX: removed `alert()`; preview-iframe case now shows an info-style notice (`checkoutNotice`, not error styling); real errors styled as alert (role="alert"); added `inputMode="email"`/`autoComplete="email"`; added "Secure checkout by Stripe" trust signal. Checkout behaviour/cart state unchanged.
- A11y: skip-to-content link in PublicLayout targeting `#main-content`.
- No backend/entity/function/checkout-logic changes. Validation: `npm test` 37/37 · lint · typecheck · build all green.
- Commit: `67b0c92` "chore: harden mobile pwa brand and store ux". No push / no PR.

## RLT-001E-FIXUP — Antigravity-reviewed viewport/a11y polish (Claude)
- On `bmad/story-rlt-001e-claude` (clean @ `67b0c92`). Applied only the 4 conditional-pass items:
  1. `Account.jsx`: `pb-28` → `pb-[calc(7rem+var(--safe-bottom))]`.
  2. `Store.jsx`: `pb-16` → `pb-[calc(5rem+var(--safe-bottom))]`.
  3. `src/index.css`: added `#root { min-height: 100vh; min-height: 100dvh; }` (dvh with vh fallback) alongside the existing `min-height: 100%`.
  4. `AuthLayout.jsx`: form panel now `overflow-y-auto max-h-dvh` so tall auth forms don't clip.
- No test changes required (mobile-viewport-shells still green). No backend/entity/function/checkout/forum changes.
- Validation: `npm test` 37/37 · lint · typecheck · build all green.
- Commit: `a79df80` "fix: polish mobile viewport hardening". No push / no PR.

## RLT-001E-MERGE — Merge approved RLT-001E into baseline
- Target `bmad/baseline-integration` @ `dacd266` (clean) ← merged `bmad/story-rlt-001e-claude` @ `a79df80` via `git merge --no-ff`.
- Result: **no conflicts** (story branched off `dacd266`, baseline unmoved). 21 files in merge: index.html, manifest, 8 shells, index.css, Store/Account/Home/HeroSection/PublicLayout/SiteNav/AdminShell/SiteSettingsManager/AuthLayout, 5 tests, BMAD docs.
- Merge commit: `e02f524`; a follow-up docs commit records RLT-001E/FIXUP/MERGE completion.
- Validation on merged baseline: `npm test` 37/37 · lint · typecheck · build all green.
- No backend/entity/function/checkout/forum changes. **Manual Base44 Publish required** for changes to go live. No push / no PR. `main` untouched.

## RLT-001I — Publish baseline to GitHub via PR (release-prep)
- Pushed `bmad/baseline-integration` (`4aa991f`) to origin; opened **PR #1** (base `main` ← head `bmad/baseline-integration`). Validation 37/37 green pre-push. No source edits.
- GitHub reported PR #1 **CONFLICTING/DIRTY** — baseline and `origin/main` (`8c3dd79`) diverged from ancestor `5086ad0`. No merge performed.

## RLT-001J — PR conflict reconciliation analysis (read-only)
- Determined `origin/main` (`8c3dd79`) = `8c3dd79 "File changes"` on top of `65d417f "wip: preserve antigravity ui ux pass"`; for all sampled UI files `origin/main` is byte-identical to the isolated Antigravity WIP. **The Antigravity UI/UX pass is already published/live on `origin/main`.**
- Both sides do overlapping mobile/PWA/UI hardening. Changed-only-on-main: 12 files (Antigravity polish incl. Forum.jsx). Changed-only-on-baseline: 15 files (4 BMAD docs, index.html, AuthLayout, AdminShell, SiteSettingsManager, Account, Home, 5 tests). Overlap: 6 files (manifest, index.css, HeroSection, PublicLayout, SiteNav, Store.jsx).
- No backend/Base44/schema/store-shipping/forum-policy on either side. Recommended **Option B**: branch from canonical `origin/main`, replay approved baseline deltas. PR #1 superseded but kept open until a replacement PR is created.

## RLT-001K — Reconcile RLT-001E baseline onto canonical origin/main
- Created `bmad/reconcile-rlt-001k` from `origin/main` (`8c3dd79`).
- Clean-applied 15 baseline-only files via `git checkout origin/bmad/baseline-integration -- …` (README/package/package-lock/base44/config.jsonc were identical via ancestor → no-ops).
- Hand-merged the 6 overlap files keeping BOTH origin/main (Antigravity) and approved baseline (RLT-001E) work:
  - `manifest.webmanifest`: adopted baseline local-icon set (`/icons/` absolute + maskable-512 + per-shortcut icons) to satisfy contract tests; kept canonical `theme_color` `#030712` (matches index.html / origin/main; baseline's `#f97316` was internally inconsistent).
  - `index.css`: kept Antigravity restyle; appended baseline `#root { min-height:100vh; min-height:100dvh }` after the existing `html,body,#root` block.
  - `HeroSection.jsx`: kept Antigravity `#news` button polish; applied baseline logo delocalization (`/icons/icon-192.png`), `min-h-dvh`, double-viewport fix. `site_logo_url` override preserved.
  - `SiteNav.jsx`: kept Antigravity nav/touch-target restyle; applied baseline local-logo fallback. Override preserved.
  - `PublicLayout.jsx`: kept Antigravity bottom-tab-bar restyle; added baseline skip-to-content link + `#main-content` + `min-h-dvh`.
  - `Store.jsx`: kept Antigravity touch-targets/`sr-only` labels/lazy-loading/scroll-lock/icon polish; merged imports (`Flame/Star/Rocket` + `Info/Lock`); kept baseline `checkoutNotice` info-state (removed `alert()`), error→`destructive` styling with `role="alert"`, info `role="status"`, `inputMode/autoComplete="email"`, "Secure checkout by Stripe" trust signal, `min-h-dvh` + safe-area padding. No checkout/payment logic changed.
- Scope check: 21 files changed vs `origin/main`; **no `base44/functions|entities`, no `config.jsonc`, no StoreOrder/checkout-backend, no store-shipping, no forum-policy/rewards/coupons/reviews/notifications**.
- Validation: `npm test` 37/37 · `npm run lint` · `npm run typecheck` · `npm run build` all green.
- **Manual Base44 Publish required after final merge.** No push / no PR / PR #1 not closed. Commit message: `chore: reconcile BMAD baseline onto canonical main`.

## RLT-001V — Combined lint gate on local main (BLOCKED — environment instability)
- Attempted to re-apply the combined forum+ads lint fixes on a branch from local `main`. The shared working tree was **continuously overwritten mid-story** by Base44 auto-sync / a concurrent agent (`ScorePredictor.jsx` rewritten ≥3×; `AdSlot.jsx`/`SlotMachineBadgeUnlock.jsx` carried 400–660 lines of uncommitted concurrent WIP). Staging swept that WIP into a commit (`74cb431`, contaminated) — **reset via `git reset --mixed`** (concurrent work preserved, not discarded). No clean deliverable possible from the churning local tree. Escalated for a stable-base approach.

## RLT-001W — Apply lint-gate fix via fixed remote main branch (Claude)
- Source of truth: **`origin/main` @ `983fd82`** (which now contains the concurrent slot-machine/tipping/ads feature work **committed** — AdSlot 558, SlotMachine 1445, ScorePredictor 1188 lines). Worked in an **isolated git worktree** from that fixed SHA (`C:\Users\deneo\rlt-001w-wt`), so the churning shared tree was never touched and no concurrent work was at risk.
- Lint at `983fd82` had narrowed to **3 errors**, all in `ScorePredictor.jsx`: unused `ChevronLeft`, `ChevronRight`, `Eye` (the newer committed code already resolved the earlier unused imports and the `ConfettiBurst` rules-of-hooks issue). Removed exactly those 3 unused imports; kept `Flame`/`Award`/`AlertTriangle`/`RefreshCw`/`Trash2` (in use). No suppressions, no behaviour change.
- Branch `bmad/story-rlt-001w-lint-gate` from `origin/main` (`983fd82`). Explicit-path staging (no `git add -A`; the worktree's symlinked `node_modules` not staged).
- Validation (in worktree): `npm run lint` **exit 0 — fully green (repo-wide)** · `npm test` 37/37 · `npm run typecheck` · `npm run build` green.
- **RLT-001S** (forum engagement clamp, `84e69c6`) remains next, to be re-applied/merged on the then-current main once this lint gate lands. Commit `fix: restore lint gate from fixed main`. No push.

## RLT-001W-MERGE — Merge fixed-SHA lint fix into main (Claude)
- Pushed `bmad/story-rlt-001w-lint-gate`; opened **PR #3**. `origin/main` had advanced `983fd82 → 68c6d4e` ("UX polish pass 2", re-touched ScorePredictor) so the branch was stale-risk; ran a **local trial-merge** first → auto-merged with **no conflicts** and lint **green**, so safe to merge. Squash-merged PR #3 → `main` **`258c642`** "RLT-001W: Restore lint gate from fixed main". Validation on merged main: `npm run lint` **exit 0** · `npm test` 37/37 · typecheck · build green. (A transient network error hit the merge response but the merge landed: PR #3 `state=MERGED`.) Manual Base44 Publish still required.

## RLT-001X — Re-apply forum engagement clamp from lint-green main (Claude)
- Base: current `origin/main` had moved again to **`8fafdaf`** ("UX polish pass 3"), past the story's cited `258c642`; used current main (still lint-green, `getEngagement` still unclamped) to avoid immediate staleness. Worked in an **isolated worktree** (`C:\Users\deneo\rlt-001x-wt`).
- Branch `bmad/story-rlt-001x-engagement-clamp` from `8fafdaf`. Clamped `getEngagement` `likes`/`views` with `Math.max(0, …)` (also neutralizes `NaN`); fallback (`liked_by` length, missing → 0) preserved. Re-created clean `tests/forum-engagement-counters.test.mjs` (source guard + negative→0 / passthrough / fallback / non-numeric). No thread/reply/publish/reward/tipping/slot/ads changes.
- Explicit-path staging (no `git add -A`; symlinked `node_modules` excluded).
- Validation (in worktree): `npm test` **42/42** · `npm run lint` **exit 0** · `npm run typecheck` · `npm run build` green.
- **RLT-001X replaces RLT-001S cleanly**; old **RLT-001P/Q/R/S** branches remain superseded. **Manual Base44 Publish required after merge.** Commit `fix: clamp forum engagement counters`. No push.

## RLT-001C — Forum publish policy decision (audit) + Option D chosen
- Audit: forum is **auto-publish** (`submitForumPost` sets `is_published:true`; anonymous allowed) gated by ban/profanity/honeypot; reactive admin moderation exists (`ForumManager`/`BanDialog`); no user report/flag/auto-hide; compose copy falsely said "Submit for Review". Architect chose **Option D** (keep auto-publish + add safety + truthful copy). See memory [[rlt-forum-publish-policy-state]].

## RLT-001C-1 — Truthful forum compose copy (MERGED)
- Worktree branch off main; `src/components/forum/feed/ComposeSidebar.jsx` copy only: "Submit for Review"→"Post to Community", "Posts are reviewed before publishing"→"Posts appear instantly & are public — please keep it civil", success→"now visible to the community". Validation 42/42. PR #8 squash-merged → main `876de8c`.

## RLT-001C-1b — Restore local PWA install assets in index.html (Claude)
- Regression cause: concurrent Base44 auto-sync commit `29080c8 "File changes"` re-introduced the remote Base44 logo (`media.base44.com/…24c67d277_LASVEGAS.png`) into `index.html` lines 5-6, reverting RLT-001E delocalization → `app-shell-metadata` + `local-brand-assets` tests went RED (main 40/42). Confirms the "Base44 regen demotes hand-coded improvements" pattern ([[Base44 builder-bot regen demotes hand-coded improvements]]).
- Fix: fixed-SHA worktree from main (`876de8c`), branch `bmad/story-rlt-001c-1b-index-assets`. Changed `index.html` icon + apple-touch-icon `href` back to `/icons/icon-192.png` (2 lines). Verified index.html was the ONLY brand file still holding the remote logo (HeroSection/SiteNav/SiteSettingsManager/manifest already clean). OG/Twitter/description metadata untouched (intact).
- Validation: `npm test` **42/42** (gate restored) · `npm run lint` · `npm run typecheck` · `npm run build` all green. No backend/src/logic changes. Explicit-path staging (no `git add -A`). Commit `fix: restore local PWA install assets`. No push.
- **Manual Base44 Publish remains BLOCKED until this merges and main tests are green.** Recommend a CI lint+test gate on Base44 auto-sync commits to stop recurring regressions.

## RLT-002A — Interest form free-text "trip details" box (Claude)
- Owner request: add a free-form box under "Team you support" on the Register Interest (travel) form for trip requirements. Built on green `main` (`6c28707`) via fixed-SHA worktree, branch `feat/interest-trip-details`.
- Wired end-to-end (4 layers): `base44/entities/InterestRegistration.jsonc` (+`trip_details` string field), `base44/functions/submitRegistration/entry.ts` (sanitize `trimToLength(input?.trip_details, 1000)` into create), `src/lib/public-forms.js` (`normalizeInterestRegistration` carries `trip_details`), `src/components/public/TravelSection.jsx` (added `Textarea` under the team `Select`, md:col-span-2, placeholder "Explain what trip you are after — how many days? what type of hotel? and do you need any customisation?", maxLength 1000, optional). emptyForm + reset updated.
- Tests: updated `tests/public-forms.test.mjs` (normalize now returns `trip_details`; +1 default-empty test) and `tests/base44-schema.test.mjs` (entity must have `trip_details`). **43/43** · lint · typecheck · build green.
- ⚠️ **Backend (entity + function) requires Base44 deploy + Publish** to persist the field; until deployed the frontend submits `trip_details` and the old function silently ignores it (graceful). Single-agent deploy prompt provided to the owner. Explicit-path staging (no `git add -A`).

## RLT-002B — "Team you support" from Team management (re-cut frontend-only, v2)
- First attempt (PR #12, branch `feat/interest-teams-from-management`) **conflicted**: a concurrent commit `65fae61 "migrate ad system…"` independently made the **same backend changes** on `main` — removed `submitRegistration`'s `SUPPORTED_TEAMS` gate (→ `if (!team)`) and the `InterestRegistration.team_supported` enum (+ bumped SDK 0.8.30→0.8.31), while preserving RLT-002A `trip_details`. So the backend half already converged on `main`.
- Re-cut as **frontend-only v2** (branch `feat/interest-teams-v2` off `65fae61`): kept just `src/components/public/TravelSection.jsx` (dropdown now from `base44.entities.Team.list("sort_order",200)` active teams + "Other", fallback to built-in), `src/lib/public-forms.js` (normalize relaxed: non-empty team instead of hardcoded gate), and `tests/public-forms.test.mjs` (+2). Left `submitRegistration`/entity at main's already-relaxed versions (no SDK downgrade). **PR #12 closed as superseded.**
- Validation: **45/45** · lint · typecheck · build green. Explicit-path staging.
- Deploy: backend relaxation (already in main's repo) + RLT-002A `trip_details` still need a **Base44 deploy of `submitRegistration` + `InterestRegistration`** for dynamic teams / trip notes to work live — coordinate deploy with the frontend Publish.

## AD-OPT — Ad system audit + optimization (Claude)
- Audited the ad system (AdSlot/AdsManager/AdRevenueTracker/SiteAd/SiteSettings). Render path already strong (RLS public-read/admin-write, rel=noopener+sponsored, lazy img+retry, viewability impressions, freq/click caps, weighted rotation, CLS-safe). Built fixes on `feat/ad-system-optimization` off `ac27704` (ad files under heavy concurrent churn — trial-merge before landing).
- **P1 real analytics:** added `impression_count`/`click_count` to `SiteAd`; new service-role function **`recordAdEvent`** (increments the counter on the SiteAd record, mirrors `forumAction`); `AdSlot.trackStat` now fire-and-forget invokes it (durable, cross-visitor) alongside the existing localStorage cache; `AdRevenueTracker.getAdStats` now prefers the real DB counts (localStorage fallback). Fixes the "analytics only reflect the admin's own browser" flaw.
- **P1 toggle trap:** `SiteSettings.ads_enabled` default flipped `false`→`true` so ads aren't silently off.
- **P2 device targeting:** `AdSlot` now filters candidates by `device_target` (all/desktop/mobile) via `matchMedia` — previously a no-op.
- **P2 dead positions:** removed `sidebar`/`in-feed` from `AdsManager` POSITIONS (no render mount yet) so admins can't pick slots that never show. `ab_variants` UI left in place (real A/B deferred — needs analytics first; removing the section was too risky in the churning file).
- Validation: **45/45** · lint · typecheck · build green. Explicit-path staging (no `git add -A`).
- 🔴 **Deploy required:** `recordAdEvent` (new function), `SiteAd` (new count fields), `SiteSettings` (default change) must be **deployed + Published** in Base44 for real analytics + the toggle default to take effect. Until then `AdRevenueTracker` falls back to localStorage and counts won't persist. ⚠️ Ad files are under active concurrent development — expect a possible rebase before merge.

## AD-MOUNTS — Banner-top + sidebar mounts + sample/test ad (Claude)
- Owner picked (a): make all 5 ad positions actually render, + add a "sample/test ad". Branch `feat/ad-mounts-top-sidebar` off `ade80a0` (frontend-only; SiteAd already deployed). NOTE: a concurrent process had re-added sidebar/in-feed to the manager (reverting AD-OPT's trim) and removed banner-top's mount — so the gap was: `banner-top` + `sidebar` offered but unmounted.
- **banner-top:** mounted in `PublicLayout` after the fixed `SiteNav`. Wrapper uses `empty:hidden` so it collapses to zero height when there's no ad (no empty top gap); nav-clearance padding lives on the ad's own className so it sits below the fixed header. Full-width, centered `max-w-5xl`, `border-b`.
- **sidebar:** mounted in `Forum.jsx` right column (`hidden lg:block`, the 320px rail) above `ComposeSidebar`, `size="medium-rectangle"` (300×250 fits the column).
- **sample/test ad:** `AdsManager` now has a **"Sample Ad"** button that creates a real SiteAd with a self-contained **SVG data-URI** creative (728×90, "SAMPLE AD") at the footer slot, active — one click verifies the whole render pipeline; delete when done. Uses the existing create path (no new backend).
- Validation: **45/45** · lint · typecheck · build green. Explicit-path staging.
- Frontend-only → no Base44 function/entity deploy needed (just Publish). ⚠️ 3 hot files (PublicLayout/Forum/AdsManager) under active concurrent churn — trial-merge before landing; banner-top placement on hero pages is worth an eyeball (review note).

## GAMIFY — Gamification upgrade (epic, incremental). Increment 1: Account Fan Hub
- Owner provided a large gamification audit/plan. Executing **incrementally** (multi-PR; full system needs a canonical Fan-Progress entity + admin controls + anti-abuse = backend → **manual Base44 deploy**, single agent out of credits). Branch `feat/account-fan-hub` off `c38f3af`.
- **Increment 1 = First-Sprint item 1 (Account Fan Hub / rewards cabinet).** Durable progress already exists server-side on the **User** entity (`casino_xp/chips/rank/streak/total_posts/replies/reactions_given/received`) + **ForumRewardEvent** log → a Fan Hub surfacing them is cross-device with **no new entity / no deploy**.
- New `src/components/account/FanHubTab.jsx`: rank header + XP progress bar to next rank (RANKS mirrors backend `CASINO_RANKS`), chips/streak/totals tiles, recent `ForumRewardEvent` history, empty-state nudge. Wired into `Account.jsx` as the **first tab + default landing**.
- Validation: **45/45** · lint · typecheck · build green. Frontend-only (Publish only). 2 files.
- **Remaining plan (queued, mostly backend/deploy):** canonical `FanProgress` model + localStorage→server migration; unified badge taxonomy/cabinet; mobile forum Fan-Hub drawer; weekly missions + daily check-in; richer leaderboards (weekly/season/helpful/team) with anti-abuse caps; team crews; social seat planner; notification retention prefs; admin gamification controls + reward-reversal + audit log. ⚠️ anti-abuse guardrails before scaling.

## RLT-HOTFIX-001 — Restore main build gate + background video autoplay
- Fixed-SHA worktree `bmad/story-rlt-hotfix-001` off `origin/main` (`a95e767`); explicit-path staging.
- **STEP 1 (main build gate):** verified current main — `npm test` 45/45, lint 0, typecheck 0, build 0. The earlier `Account.jsx` duplicate-declaration break (5be0c14) was **already fixed on main** by commit `a95e767` ("restore lazy/Suspense imports in Account.jsx (merge resolution error)"). Account.jsx left UNCHANGED per story (only edit if still broken).
- **STEP 2 (background video):** root-caused the "not autoplaying anymore" report. Two regressions in `BackgroundVideo.jsx`, both from Base44 auto-sync/overhaul churn:
  1. The `FORMAT_RANK` source-priority sort (added by fix `1b07e15`) was stripped → sources render in raw order; `Home.jsx` `stadiumVideoUrls` lists the `.mov` first → first `<source>` is `video/quicktime`, unplayable in Chrome/Edge/Firefox → autoplay fails, only poster shows.
  2. A blanket `max-width:767px` mobile disable was re-introduced → video never plays on any mobile viewport.
  - **Fix:** restored mp4-first `FORMAT_RANK` sort; gating now respects ONLY `saveData` + `prefers-reduced-motion` (muted+playsInline autoplay allowed on mobile by design); `preload` none→metadata. Preserved muted/loop/playsInline/autoPlay/poster fallback. `BackgroundVideo.jsx` only (Home.jsx not in scope; the sort fixes ordering regardless of the URL list).
- **Test:** new `tests/background-video-policy.test.mjs` (5 source guards): no mobile-only gating; saveData + reduced-motion preserved; autoPlay/muted/loop/playsInline kept; poster kept; FORMAT_RANK present + behavioural mp4-before-mov replica. Guards so a future regen can't silently re-strip the fix.
- Validation: **npm test 50/50 · lint 0 · typecheck 0 · build 0.** Frontend-only; no entity/function changes. NOT pushed/merged/published.

## RLT-IOS-001 — Capacitor iOS native foundation + native app shell guards (Claude)
- 6-lens Phase-0 audit first (codebase / iOS-native / UX-brand / perf-offline / Supabase-push-security / QA-runbook); no blockers. Branch `claude/new-session-p5p9zs` off `main` (`407e51b`).
- **Scaffold:** Capacitor 8 (SPM — no CocoaPods; `cap add ios` + `cap sync ios` both run clean on Linux). `capacitor.config.json`: `com.rugbyleaguetakeover.app` / webDir `dist` / splash `#030712` `launchAutoHide:false` / StatusBar DARK overlay / Keyboard native / push presentationOptions. `ios/` committed; generated `App/public` + config gitignored. npm scripts `ios:build|sync|open|run`. Stale `@base44/sdk` + `@base44/vite-plugin` removed (verified unused; `base44/` reference dir kept — `base44-schema` test reads it).
- **Native layer (`src/lib/native/`):** pure-function env detection (test-injectable, mirrors `pwa-env` convention); haptics (no-op web); share (native sheet, canonical-https share links — capacitor:// origins rewritten); deep-links (`mapUrlToRoute` pure + `appUrlOpen`/launch-URL → router); network (Capacitor Network feeds `useOnlineStatus`); push (permission/token/listeners foundation — NO auto-prompt, NO delivery); open-external (system-browser handoff).
- **Guards:** `shouldEnablePwaForEnvironment({isNative})` short-circuit (SW + PwaUpdatePrompt off in shell), `getInstallPromptMode({isNativeShell})` hidden — existing web semantics byte-preserved, tests untouched and green. `NativeAppBootstrap` (inside Router): `is-native-app` class, status-bar/splash, deep-link init, capture-phase interceptor sending foreign-host links to the system browser and own-domain absolute links to the router.
- **Flows:** Store checkout `window.location.href` → `openExternalUrl` (system browser in shell; web behaviour identical); auth `emailRedirectTo`/reset/OAuth origins → `redirectBase()` (canonical https in native); `threadUrl`/PublicDetailSheet share canonicalized; haptics on tabs/Plan/add-to-cart/checkout/forum submit/share. Offline: `PublicOfflineBanner` in PublicLayout + `rlt_recent_news` (forum-read-tracker pattern) backing News offline. MobileCommandSheet: additive Latest News + Gallery quick links (tab bar composition unchanged by design — Plan sheet is conversion-load-bearing).
- **Backend foundation:** `supabase/migrations/0009_user_push_tokens.sql` (text PK, created/updated_date, touch trigger, own-row RLS in house style) — committed, **NOT applied** to remote; `UserPushToken` entity mapping added. AASA placeholder (`TEAMID` to fill) + `vercel.json` `.well-known` rewrite-exclusion + JSON content-type header.
- **Docs:** `docs/iOS_RUNBOOK.md` (Linux vs Mac split, Xcode signing/capabilities, Info.plist strings, assets, common failures), `docs/APP_STORE_CHECKLIST.md` (privacy manifest, 4.2-wrapper mitigation citing real features, TestFlight smoke list); DEPLOY.md rewritten off the dead Base44 flow; README node/scripts/deploy updated.
- **New tests:** `native-env` (bridge-injection detection), `native-guards` (PWA/install gates, deep-link mapping incl. foreign-host rejection, share canonicalization), `capacitor-config` (appId/webDir/splash/statusbar/no-server-override contract).
- Validation: **npm test 106/106 · lint 0 · typecheck 0 · build 0 · `npx cap sync ios` clean.** Xcode build/simulator NOT possible in this Linux container — Mac steps documented in the runbook.
- Deferred (explicit): APNs delivery pipeline + permission UI; in-app auth/OAuth + Stripe return deep links (needs Associated Domains + Supabase allow-list + `CHECKOUT_ALLOWED_ORIGINS`); 1024px icon + splash masters; self-hosted Oswald/Inter; mailto handling in shell.

## RLT-IOS-002 — Mac/Xcode first run + native shell polish (Claude)
- Branch `claude/new-session-p5p9zs` reset onto merged main `4f1dd8e` (prior PR #41 squash-merged). Linux container → Xcode/simulator impossible here; Codemagic path added instead (owner deploys from Windows).
- **Chunking:** `@capacitor/*` exempted from the vendor-misc catch-all in `vite.config.js` → Rollup splits it naturally lazy. Verified: preload list in `dist/index.html` identical to pre-iOS baseline; vendor-misc byte-identical (229,007); core = 8.2KB lazy chunk; entry +4.5KB (our own guard code only). NOTE: forcing a named `vendor-capacitor` chunk was tried first and REVERTED — Rollup colocated Vite's preload helper into it, making every chunk import it statically (worse than the bug).
- **AppDelegate:** added `didRegisterForRemoteNotificationsWithDeviceToken`/`didFailToRegister…` → `NotificationCenter` posts required by @capacitor/push-notifications. Plumbing only; no permission prompt, no send pipeline (unchanged posture).
- **Auth:** Google OAuth hidden in the shell via new pure guard `src/lib/native/auth-guards.js` (`canUseGoogleOAuth`) wired into Login/Register (button + divider block); rationale: Google `disallowed_useragent` WebView block + session would land on web origin. Email/password native path unchanged; web OAuth untouched (verified in headless smoke — button renders on web).
- **Links:** new `classifyHref` + `openSystemUrl` (`@capacitor/app-launcher@^8` added, 10 plugins total) — interceptor now routes `mailto:`/`tel:`/`sms:` to the OS handler; http logic unchanged.
- **Haptics:** `selectionChanged()` now emits a Light impact (bare selectionStart/End produces no tick; Light impact = UIKit tab-bar feel).
- **Fonts:** Inter 400–800 + Oswald 500–700 self-hosted via `@fontsource/*` imports in `main.jsx`; Google Fonts `<link>` + preconnects removed from `index.html`. 50 woff2 subset files emit as hashed assets (unicode-range → browsers fetch only needed subsets); SW static-asset caching covers them. Brand type now survives offline/native launches.
- **Codemagic:** starter `codemagic.yaml` (mac_mini_m2, node 22, same validation gate, `cap sync`, `xcode-project build-ipa` on the SPM `App.xcodeproj`, TestFlight publish via `app_store_connect` integration) + runbook section with the one-time UI setup. First cloud build NOT yet run — expect a signing round-trip.
- **Tests:** new `tests/native-shell-polish.test.mjs` (OAuth guard pure+wiring, classifyHref, @capacitor chunk exemption + no-static-import walk of src/**, self-hosted-font contract, AppDelegate hook presence).
- **Docs:** runbook (Codemagic section, AppDelegate status, OAuth status, mailto/tel, fonts) + checklist (hooks ✅, OAuth interim ✅, fonts deferred item removed, smoke items updated).
- Validation: **npm test 113/113 · lint 0 · typecheck 0 · build 0 · `npx cap sync ios` clean (10 plugins).** Headless Chromium smoke of the built web app: home + login render correctly at 390×844, Oswald/Inter self-hosted rendering confirmed, tab bar + brand intact.
- Still deferred: Xcode/simulator/device validation (Codemagic first build), 1024px icon + 2732px splash masters, in-app auth/OAuth + Stripe return deep links, APNs delivery + permission UI (RLT-IOS-004).

## RLT-UX-001 — Platform optimal-state pass (Claude)
- Method: 3 parallel read-only audit agents (native-correctness, UX/a11y/consistency, functionality/perf/data) + a live headless-Chromium CDP sweep across mobile(390) & desktop(1280) for all 10 public routes (overflow, console errors, broken images, tap targets, h1). Branch `rlt-optimal-pass` off `claude/new-session-p5p9zs` (has all merged+pending native work).
- Verified-healthy baseline: 0 horizontal overflow on every route/viewport; 0 real JS runtime errors (all console noise was the sandbox proxy blocking Supabase); responsive layout sound; brand consistent.
- **Fixes implemented (safe, high-value):**
  1. Remote-image resilience — shared `src/lib/img-fallback.js` `hideBrokenImage` wired into hero poster, Store (card+quickview+thumb), Gallery grid, Travel packages, Home DENEO logo, HeroSection logo. Failed remote imgs now hide → branded container shows instead of a broken glyph (confirmed by all 3 audits + sweep).
  2. Network timeout — `supabaseClient.js` global fetch wrapped with `AbortSignal.timeout(20s)` (guarded for iOS<16 / older engines). Removes the only "infinite skeleton" path (stuck socket); rejected fetches fall into existing error/fallback UI.
  3. `/news` `<h1>` (was h1=0) — sr-only, no visual change.
  4. Nav dead-zone — bottom tab bar `lg:hidden`→`xl:hidden` (+ content `lg:pb-0`→`xl:pb-0`) so 1024–1279px gets the tab bar instead of no primary nav.
  5. Dead code — removed unused `ui/form.jsx`, `ui/skeleton.jsx`, `forum/FanBadgeUnlocks.jsx` (0 importers each) + dropped the now-unused `react-hook-form` dep (build byte-identical → already tree-shaken; pure hygiene).
  6. Store `localStorage` — wrapped the two bare `setItem`/`removeItem` writes in try/catch (Safari private mode / quota safety) to match the rest of the app.
  7. `ReactionPicker` reactors modal — added `role="dialog"`, `aria-modal="true"`, `aria-label`, and an Escape keydown handler (was the only sheet missing dialog semantics/keyboard dismiss).
  8. Native splash-hang safety — `main.jsx` native-only 2.5s `SplashScreen.hide()` floor (launchAutoHide:false would otherwise hang forever if JS throws before NativeAppBootstrap mounts). Guarded no-op on web.
- New tests: `tests/ux-optimal-pass.test.mjs` (hideBrokenImage behavior, img wiring across 6 files, news h1, nav breakpoint guard, supabase timeout, dead-file removal, reactors dialog semantics).
- Validation: **npm test 120/120 · lint 0 · typecheck 0 · build 0 · npx cap sync ios clean.** Browser re-sweep confirmed: news h1=1, 0 visible broken images (home/store/gallery), tab bar visible at 1100px, no overflow.
- Notable: the native-audit agent (run against the IOS-002-only slice) flagged missing camera strings / entitlements / privacy manifest as blockers — all already fixed by RLT-IOS-003, independently validating that story.
- **Backlog (deliberately deferred — too broad, brand-risk, or needs device):** low-opacity text contrast (`text-muted-foreground/30-40` on real text — global change risks the intended dim aesthetic; Forum.jsx:1156/1199/1229/1504, LazySection.jsx:42); sub-8px type scale (slot/* 6-7px + /40 opacity); color-literal→semantic-token migration (52 files, densest ScorePredictor/SlotMachine/OrdersTab); mobile <40px tap-target sweep (home 14, login/register 6, gallery 5); skeleton unification onto one primitive (26 ad-hoc variants); split cmdk/day-picker/embla out of preloaded vendor-ui; duplicate query-key param dedup (`["news"]` Home vs News, `["teams"]` ×5 — caching-behavior risk); Stripe native in-app return (needs deep-link story); AuthLayout top safe-area (device check); BackgroundVideo recovery-attempt cap (has prior-hotfix test guard — verify on device before touching).

## 2026-07-10 — RLT-IOS-003A (branch rlt-ios-003-native-product)
Platform split + native navigation architecture: App.jsx now renders a lazy native route tree (NativeAppRoutes) when isNativeApp(), web tree byte-preserved. New src/native/ layer: NativePublicShell (5 fan tabs Home/News/Forum/Store/Account, Takeover More sheet w/ Plan+Gallery+FAQ+legal+accent picker+gated Admin entry, cart+notification badges, idle tab prefetch), per-tab route memory + per-path scroll memory, semantic haptic dispatcher (emitHaptic) with throttling, NativeTopBar/NativeSubScreen chrome. Theme accents extracted to src/lib/theme-accents.js (single source; picker dispatches rlt_theme_change). Validation: tests 147/147, lint 0, typecheck 0, build 0, cap sync clean. Native chunk not modulepreloaded on web (entry ~68KB unchanged).
