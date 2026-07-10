# TASKS — Rugby League Takeover

BMAD story board. One story = one bounded change. No code without a story.

## Status legend
- `backlog` — captured, not yet scheduled
- `queued` — approved/next-up, not started
- `in_progress` — actively being implemented
- `blocked` — needs a decision or another story first
- `completed` — implemented, validated, accepted in-scope

## Stories

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| RLT-UX-001 | Platform optimal-state pass (iOS + desktop + mobile) | completed (await merge) | Branch `rlt-optimal-pass` off `claude/new-session-p5p9zs`. 3-agent audit + live CDP sweep (both viewports, 10 routes). Fixed: remote-image onError fallback (6 files + helper), Supabase request timeout (no infinite skeleton), /news h1, 1024-1279 nav dead-zone, dead-code removal (ui/form+skeleton+FanBadgeUnlocks + react-hook-form dep), Store localStorage guards, ReactionPicker dialog+Escape, native splash-hang safety floor. 120/120 tests, lint/typecheck/build/cap-sync green; browser-verified (h1, 0 broken imgs, tab bar at 1100px, no overflow). Backlog documented (contrast, type scale, tap targets, color tokens, query-key dedup, skeleton unify, vendor split, Stripe native return) |
| RLT-IOS-002 | Mac/Xcode first run + native shell polish | completed (await merge) | Branch `claude/new-session-p5p9zs` off merged main `4f1dd8e`. Capacitor exempted from vendor-misc catch-all (web preload back to pre-iOS baseline; core+plugins lazy); AppDelegate APNs token-forwarding hooks (plumbing only); Google OAuth hidden in native (`canUseGoogleOAuth`, email/password works); mailto/tel/sms → AppLauncher; tab haptic → light impact; Inter/Oswald self-hosted via @fontsource (CDN removed); starter `codemagic.yaml` + runbook Codemagic section (Windows deploys, first build not yet run); docs updated; tests 113/113, lint/typecheck/build/cap-sync green; headless web smoke (home+login screenshots) pass. Xcode/simulator still not validated (Linux container) |
| RLT-IOS-001 | Capacitor iOS native foundation + native app shell guards | completed (await merge) | Branch `claude/new-session-p5p9zs`. Capacitor 8 (SPM, no CocoaPods) + 9 plugins; `src/lib/native/*` env/haptics/share/deep-link/network/push/open-external; PWA guards (SW + install/update prompts off in shell); Stripe/system-browser handoff; canonical-origin auth redirects + share links; offline banner + `rlt_recent_news`; migration `0009_user_push_tokens.sql` (NOT applied); AASA placeholder + vercel header; docs/iOS_RUNBOOK + APP_STORE_CHECKLIST; tests 106/106, lint/typecheck/build green. Push delivery + in-app auth/checkout return deferred |
| RLT-HOTFIX-001 | Restore main build gate + background video autoplay | completed (await merge) | Branch `bmad/story-rlt-hotfix-001` off `origin/main` (`a95e767`). Account.jsx **already fixed** on main (no change). `BackgroundVideo.jsx`: restored `FORMAT_RANK` mp4-first source sort (auto-sync stripped it → `.mov`/quicktime first = no autoplay), dropped mobile-viewport disable (kept save-data + reduced-motion), `preload` none→metadata. New `tests/background-video-policy.test.mjs` (5 guards). 50/50 tests, lint/typecheck/build green. Frontend-only; Publish-only |
| RLT-001A | Preserve dirty validated pre-BMAD state | completed | Safety branch `bmad/baseline-preserve-current-state` @ `14d17a1` |
| RLT-001B | Reconcile origin-canonical forum mobile layer | completed | In-scope (`index.css` + `Forum.jsx` + `forum-mobile-layout` test) on `bmad/baseline-integration` @ `ec63822` |
| RLT-001C | Decide forum publish policy (moderate vs auto-publish) | decided → Option D | Audit complete; **Option D chosen** (keep auto-publish + add safety + truthful copy). Reactive admin moderation already exists; gaps = report/flag, auto-hide, rate-limit |
| RLT-001C-1 | Make forum compose copy truthful (auto-publish) | merged | PR #8 squash-merged → `main` `876de8c`; ComposeSidebar copy only |
| RLT-001C-1b | Restore local PWA install assets in index.html | completed (await merge) | Fixes test regression from Base44 auto-sync re-adding remote logo to index.html; `href`→`/icons/icon-192.png`; tests back to 42/42 |
| RLT-001C-2 | Forum report/flag + auto-hide + rate-limit | queued | Backend (`submitForumPost`/`forumAction` + `ForumReport` or fields); needs Base44 deploy+Publish. Option D safety layer |
| RLT-002A | Interest form free-text "trip details" box | merged (PR #10) | `Textarea` + `trip_details` through normalize/function/entity. **Backend needs Base44 deploy+Publish** |
| RLT-002B | "Team you support" dropdown from Team management | completed (await merge) | Re-cut **frontend-only** as `feat/interest-teams-v2` off `65fae61` (backend converged on main via `65fae61`); dropdown from `Team.list` + "Other", normalize relaxed; 45/45 green. PR #12 closed/superseded |
| AD-OPT | Ad system audit + optimization | merged (#15) | Real DB analytics (`recordAdEvent` fn + SiteAd counters + AdRevenueTracker), `ads_enabled` default→true, `device_target` wired. 🔴 Base44 deploy required; A/B deferred |
| AD-MOUNTS | Banner-top + sidebar mounts + sample/test ad | completed (await merge) | `feat/ad-mounts-top-sidebar` off `ade80a0`; banner-top (PublicLayout, `empty:hidden` collapse) + sidebar (Forum rail, medium-rectangle) now render; "Sample Ad" button in AdsManager creates a self-contained SVG test ad. Frontend-only; 45/45 green. ⚠️ hot files — trial-merge before landing |
| GAMIFY | Gamification upgrade (epic, incremental) | in_progress | **Inc.1 done** (`feat/account-fan-hub`): Account **Fan Hub** tab (default landing) surfacing server-durable `User.casino_*` + `ForumRewardEvent` — rank/XP bar, chips/streak/totals, reward history. Frontend-only, 45/45. Next (mostly backend/deploy): canonical FanProgress + localStorage→server, unified badge cabinet, mobile forum drawer, weekly missions + daily check-in, richer leaderboards, team crews, social seat planner, notification prefs, admin gamification controls, anti-abuse caps |
| RLT-001D | BMAD files + project identity/docs | completed | Architect-approved (`f6d1271`) |
| RLT-001E | Mobile/PWA/brand/store hardening | completed | Antigravity final UX pass (P0 12/12); **merged into `bmad/baseline-integration`** (RLT-001E-MERGE). 8-shell `min-h-dvh`, HeroSection double-vh fix, local PWA icons/manifest/OG metadata, brand-asset delocalization, Store inline checkout notice + trust signal, skip-link; 5 deferred tests green |
| RLT-001E-FIXUP | Antigravity-reviewed viewport/a11y polish | completed | Account/Store safe-area bottom padding, `#root` dvh+fallback, AuthLayout panel overflow-y-auto — merged into baseline |
| RLT-001E-MERGE | Merge approved RLT-001E into baseline | completed | `--no-ff` merge of `bmad/story-rlt-001e-claude` (`a79df80`) into `bmad/baseline-integration`; no conflicts; 37/37 validation green |
| RLT-001F | Isolate concurrent store-shipping WIP from baseline | completed | Architect-approved; WIP preserved on `bmad/wip-store-shipping` (`f0684600`); baseline restored clean |
| RLT-001G | Isolate Antigravity UI/UX WIP from baseline | completed | WIP preserved on `bmad/wip-antigravity-uiux` (`65d417f`); baseline restored clean |
| RLT-001H | Preserve active Codex store-shipping WIP and repair branch discipline | completed | WIP preserved on `bmad/story-rlt-011-codex-store-shipping` (`46d069b`); `.gitignore` preserved only, not approved for baseline; local `main` repaired to `origin/main` (`8c3dd79`) |
| RLT-001I | Publish BMAD baseline to GitHub via PR | completed | Pushed `bmad/baseline-integration` (`4aa991f`); opened **PR #1** (base `main`). GitHub reports CONFLICTING (baseline ↔ `origin/main` divergence). Not merged |
| RLT-001J | PR conflict reconciliation analysis | completed | Read-only. Found `origin/main` already carries the live Antigravity UI/UX pass; recommended Option B (branch from main, replay baseline). PR #1 superseded |
| RLT-001K | Reconcile RLT-001E baseline onto canonical origin/main | completed | Branch `bmad/reconcile-rlt-001k` from `origin/main` (`8c3dd79`); 15 files clean-applied + 6 overlap hand-merged (kept Antigravity + RLT-001E). 37/37 validation green. No backend/store-shipping. Manual Base44 Publish required after merge |
| RLT-001T | Restore current main lint gate (forum tipping) | superseded by RLT-001V | Forum lint fix accepted in substance; folded into RLT-001V |
| RLT-001U | Restore ads lint gate | superseded by RLT-001V | Ads lint fix accepted in substance; folded into RLT-001V |
| RLT-001V | Re-apply combined lint gate fixes on local main | blocked (env instability) | Local shared tree churned mid-story; commit `74cb431` was contaminated by concurrent WIP and reset. Superseded by RLT-001W (fixed-remote approach) |
| RLT-001W | Apply lint-gate fix via fixed remote main branch | merged | Worktree branch from `origin/main` (`983fd82`); removed 3 unused ScorePredictor imports. **Squash-merged → `main` `258c642`** (RLT-001W-MERGE; trial-merge verified conflict-free + green). Lint gate restored |
| RLT-001S | Re-apply forum engagement clamp on current main | superseded by RLT-001X | `84e69c6` predated lint-green main; replaced cleanly by RLT-001X |
| RLT-001X | Re-apply forum engagement clamp from lint-green main | completed (await merge) | Worktree branch `bmad/story-rlt-001x-engagement-clamp` from current `origin/main` (`8fafdaf`, lint-green); `getEngagement` clamp + 5 tests; tests 42/42, lint/typecheck/build green. No tipping/slot/ads/backend changes |
| RLT-002 | Replace starter README | completed (in RLT-001D) | Project-specific README |
| RLT-002 | Replace starter README | completed (in RLT-001D) | Project-specific README |
| RLT-003 | Normalize project identity metadata | completed (in RLT-001D) | `package.json`, `package-lock.json`, `base44/config.jsonc` |
| RLT-004 | Harden StoreOrder creation authority | queued | Server-authoritative order creation |
| RLT-005 | Forum reaction/view race-condition review | queued | Concurrent `reactions`/`view_count` writes |
| RLT-006 | Checkout oversell/reservation strategy | queued | Stock reservation / oversell prevention |
| RLT-007 | Split Forum.jsx into bounded modules | backlog | Large-file decomposition |
| RLT-008 | Clean install/build validation | queued | Fresh `npm ci` + build determinism |
| RLT-009 | Account My Orders section | queued (after baseline) | Order history in `/account` |
| RLT-010 | Checkout Trust Layer | queued (after Antigravity UX spec) | Trust/conversion UX; needs Antigravity `ui-ux-pro-max` spec |
| RLT-011 | Store shipping checkout completion | backlog | Preserved WIP on `bmad/wip-store-shipping` (`f0684600`) and `bmad/story-rlt-011-codex-store-shipping` (`46d069b`); resume only if Architect chooses to continue it |
| RLT-IOS-003 | Native product transformation (platform split, native fan+admin shells, state/perf, QA) | corrections 003F-003H landed (awaiting adversarial review) | Branch `rlt-ios-003-native-product` off `main` `98f917d`; staged sub-stories 003A-003E, one commit each; audit at docs/audits/RLT-IOS-003-AUDIT.md |
