# RLT-IOS-003 — Correction Handoff (post-adversarial-review)

**Branch:** `rlt-ios-003-native-product` · **HEAD:** `6372848` · pushed to origin.
**State:** 9 commits (audit `697797a` + 003A `b34eaac` · 003B `bf33b8a` · 003C `4d1409a` · 003D `1a0afb8` · 003E `f376c52` · 003F `594ddb7` · 003G `d0e393b` · 003H `6372848`). Gate green at HEAD: **202 tests · lint · typecheck · build · cap sync ios**.
**Do:** bounded corrective commits only · gate after EACH · push the branch after each · **NO PR, NO merge** · do not rewrite the native architecture · keep web/PWA behavior intact.

## What happened
003A–H built a distinct native iOS product (platform split, 5-tab fan shell, native fan screens, native admin shell, state/perf, checkout return) + Architect corrections (003F authoritative checkout, 003G priority native admin workflows, 003H truth corrections). A mandated **5-agent adversarial review** then ran against the whole series. **All security/architecture claims held** (platform latch sound, route reachability, RequireAdmin/RequireAuth guards, RLS authority, native checkout fails-safe, webhook sole payment writer, bundle isolation / zero static @capacitor imports / no chunk leak, Codemagic accidental-publish impossible from repo, web/PWA preserved). But the review found **real defects + overstated claims** that block merge. Fix them as 003I–003M below, then re-run the adversarial review on the delta.

---

## FIX PLAN

### 003I — Security & data protection (HIGHEST PRIORITY)

**P1 (HIGH) — persisted query cache writes admin PII to disk.** `src/lib/native/query-persistence.js` uses a DENYLIST (`PERSIST_DENYLIST`) that misses `["forumPosts"]`, `["testimonials"]`, `["tippingEntries"]` (and user-scoped `["myInterest",email]`, `["notifications",userId]`, `["myPosts"]`, `["fanRewardEvents"]`, `["user"]`). `forum_posts_view`/`testimonials_view`/`tipping_entries_view` return `ip_address`, `user_email`, `reported_by`, unpublished/deleted content **when `is_admin()`** — so an admin opening the fan Forum tab (polls `["forumPosts"]` every 30s + on foreground) serializes all of it to WebView `localStorage` for 24h (device backups). Non-admins persist other users' emails too.
- **FIX: invert to an ALLOWLIST.** Replace `PERSIST_DENYLIST`/`shouldPersistQuery` with `PERSIST_ALLOWLIST` = only public, non-PII roots: `siteSettings, news, products, gallery, matchups, events, teams, partners, faqs`. `shouldPersistQuery` returns true ONLY if `queryKey[0] ∈ allowlist` AND `state.status==="success"`. Everything else (forumPosts, notifications, all user-scoped, admin) is never persisted — secure by default.
- Add `dehydrateOptions.shouldDehydrateMutation: () => false` (paused offline mutations — e.g. a ban carrying email/IP — could otherwise serialize).
- Update `tests/native-state-flows.test.mjs`: the assertion that `["notifications","u1"]` persists must FLIP to "does NOT persist"; assert `["forumPosts"]`/`["orders"]` do NOT persist and `["news"]`/`["products"]` DO.

**C2/C3 (MED/LOW) — verifyCheckoutReturn: single-bind + Stripe amplification.** `supabase/functions/verifyCheckoutReturn/index.ts` calls Stripe FIRST then checks the order; `resolveCheckoutConfirmation` confirms on `paymentStatus==="paid"` alone (the `stripe_session_id` bind only gates `orderStatus` = decorative). Also unauthenticated + unthrottled + one billable Stripe call per regex-valid id (amplification).
- **FIX: look up `store_orders` by `stripe_session_id` FIRST.** If no order recorded that session id → return 404 **before any Stripe call** (kills amplification + makes it a true double-bind). Then retrieve from Stripe for authoritative payment status. Correct the "double-bind" comment. (Enumeration is already infeasible — high-entropy `cs_` ids.)

**PUSH1 (CONFIRMED) — anon can insert `user_id=''` push tokens.** `supabase/migrations/0009_user_push_tokens.sql` `push_tokens_insert_own` with-check is `user_id = coalesce(current_profile_id(),'')` → NULL profile (anon) inserts `''`. Migration is UNAPPLIED so safe to edit.
- **FIX:** tighten to reject NULL profile, e.g. `with check (current_profile_id() is not null AND user_id = current_profile_id())`.

### 003J — Native lifecycle correctness

**PF-F1 (HIGH) — universal-link launch-URL trap.** `src/components/NativeAppBootstrap.jsx` effect deps `[navigate]`; under `BrowserRouter` `navigate` identity changes every navigation, so the effect re-runs on EVERY nav → `initDeepLinks` → `App.getLaunchUrl()` (returns lastURL non-destructively, never cleared, `@capacitor/app`) → `navigate(launchRoute)`. After the app is opened via ANY universal link, every tab press yanks the user back to it; **poisons the 003F checkout return** (every nav re-lands on the return screen). The "navigate is stable" comment is false.
- **FIX (two parts):** (a) in `src/lib/native/deep-links.js` `initDeepLinks`, latch the launch URL so it's consumed at most once per session (module-scope `launchUrlConsumed` guard around the `getLaunchUrl` navigate). (b) In `NativeAppBootstrap.jsx` (and mirror in `src/native/app/NativeRuntime.jsx`), use a `navigateRef` (useRef updated each render) and run the effect once (`[]` deps) so status bar/splash/deep-links/click-interceptor/push-listeners init once, not per navigation.

**PF-F2 (MED) — push listeners churn + cancellation race.** `NativeRuntime.jsx` deps `[navigate]` re-registers 4 Capacitor listeners per navigation. `src/lib/native/push.js addPushListeners` checks `cancelled` once (top of `.then`); cleanup between the sequential `await addListener` calls leaves later handles unremoved (leak → duplicate tap navigations).
- **FIX:** navigate-ref deps `[]` (from PF-F1); in `push.js`, check `cancelled` before each `add()` and push handles as created.

**PF-F3 (MED) — persister unsubscribe discarded.** `query-persistence.js:~57` `const [, restorePromise] = persistQueryClient(...)` throws away element 0 (the persister unsubscribe); `cleanup` only unsubs the auth listener.
- **FIX:** capture `const [unsubscribe, restorePromise] = persistQueryClient(...)` and call it in `cleanup`.

**PF-F5 (LOW)** — single-listener attach race in `app-lifecycle.js`/`deep-links.js` (cleanup before `await addListener` resolves orphans the handle). Fold into the listener-hygiene fix.

### 003K — Admin payload parity (native workflows must match the web managers)

Reference the web originals: `src/components/admin/OrdersManager.jsx`, `ForumManager.jsx`, `RegistrationsTable.jsx`, `BanDialog.jsx`. Native code: `src/native/admin/workflows/{NativeOrdersWorkflow,NativeModerationWorkflow,NativeRegistrationsWorkflow,workflow-helpers}.jsx/js`.

- **R1 (HIGH) — ban author drops the 2nd record.** Web `ForumManager.jsx:711-714` `onBanEmail` writes `{ban_type:"email",value:user_email}` AND, when `post.user_id`, `{ban_type:"user",value:post.user_id}`. Native writes only the email ban → banned user changes email and evades. **FIX:** native ban-author creates both records when `user_id` exists.
- **#2 (MED) — ban falls back to `author_name`.** Native shows Ban when `user_email||author_name` and submits `value: user_email||author_name` → useless email-bans on guests. **FIX:** only offer/allow the author ban when `post.user_email` exists (match web); hide ban buttons on already-removed posts.
- **#3 (MED) — ship drops `estimated_delivery`.** `workflow-helpers.buildOrderStatusPayload` (shipped branch) omits `estimated_delivery = calcEstimatedDelivery(shipped_at, shipping_method)` that both web paths write (`OrdersManager.jsx:291-295,316-321`); customer-facing (`OrdersTab.jsx` renders it). No native `shipping_method` UI either. **FIX:** compute + write `estimated_delivery` on ship (port `calcEstimatedDelivery` + `SHIPPING_METHODS`); optionally add a shipping-method selector.
- **#4 (MED) — refund degraded + no completed-order refund.** Native refund writes only `{status,timeline}`; web writes `refund_amount, refund_reason, refunded_at` + note (`OrdersManager.jsx:345-360`). `canCancelOrRefund` excludes `completed` so delivered orders have no native refund path. **FIX:** add a refund sheet capturing amount/reason, write the full payload; allow refund on `completed`.
- **#7 (LOW) — moderation reason lost.** Native Hide writes bare `{is_published:false}`; Remove hardcodes reason. Web prompts for `moderation_reason`. **FIX:** prompt for an optional reason on hide/remove and include `moderation_reason`.
- **#9 (LOW) — BanDialog fire-and-forget.** Native passes `banMutation.mutate` (not `mutateAsync`) → dialog closes before settle, `pending` guard dead. **FIX:** pass `mutateAsync` handlers so the dialog awaits + disables.
- **#8 (LOW) — admin audit log dropped.** Web dispatches `rlt_admin_log` CustomEvents on update/ban/delete/restore; native dispatches none. **FIX:** dispatch matching `rlt_admin_log` events (or document as intentionally dropped if nothing consumes them natively — verify the consumer).
- Add tests asserting the dual-ban, `estimated_delivery`, and refund fields (current `tests/native-admin-workflows.test.mjs` misses them).

### 003L — Routing / UX / reachability

- **R-F1 (HIGH) — native auth dead-end.** `/login,/register,/forgot-password,/reset-password` mount OUTSIDE `NativePublicShell` (no tab bar, no home link) → signed-out guest who taps Account is stuck (authenticate or force-kill). **FIX:** wrap those 4 native routes in a small `NativeAuthFrame` with a Close/back → `/` affordance (native-only; don't touch shared `AuthLayout`/web).
- **R-F2 (MED) — `?product=` + dead alias code.** `/store?product=<id>` isn't handled on native (only success/cancelled). `src/native/navigation/native-aliases.js nativeAliasFor()` is imported by NOTHING at runtime (real aliases are inline in `NativeForumScreen`/`NativeAccountScreen`; the test validates dead code). **FIX:** centralize alias resolution in `NativePublicShell` via `nativeAliasFor` (extend it to map `?product=`→`/store/product/:id`), remove the inline `?thread=`/`?tab=` effects → one live, tested implementation.
- **R-F3 (MED) — news deep-link parity.** `NativeArticleScreen` resolves `/news/:id` only from newest-50 + caches (no by-id fetch) → deep link/push to older article shows "not found" (web `NewsArticle.get(id)` succeeds). **FIX:** add a by-id `NewsArticle.get(id)` fallback (mirror `src/pages/NewsArticle.jsx`).
- **#6 (LOW) — reply title.** Native reply writes `title:"Reply"`; web writes `title:"Re: <thread title>"` (`Forum.jsx:954`). Native moderation hides `title==="Reply"` (misses web "Re:" replies). **FIX:** write `Re: <thread.title>`; loosen the title-hide heuristic.
- **R-F4 (LOW) — deploy-skew red screen.** Until new `createCheckout` ships, native return has no `session_id` → RED "couldn't verify" for successful payers. **FIX:** treat a MISSING `session_id` (vs invalid) as a soft "order confirming — check your orders" state, not a red failure (webhook governs).
- **R-F6 (LOW) — tab memory pins checkout/auth.** `tab-history.rememberTabPath` remembers `/store/checkout/*` → pressing Store reopens the confirmation. **FIX:** skip transient checkout/auth paths in `rememberTabPath`.
- **R-F7 (INFO) — notification nav skips host check.** `NativeNotificationsScreen` navigates any link's path (external URL → PageNotFound). **FIX:** validate relative/same-origin before navigate (reuse `resolvePushRoute`/`mapUrlToRoute` style).
- **PF-F4 (MED) — scroll restore clamped.** Screens remount → `useWindowedList` resets to `initial` (~12 rows) → `NativeScrollMemory` `scrollTo(item80)` clamps to a 12-row-tall doc → restore lost. **FIX:** give `useWindowedList` an optional `restoreKey`; remember the max limit reached per key (module map) and seed `initial` from it on mount, so remounts restore enough rows. Wire into forum + news feeds.

### 003M — Docs / honesty / test hardening (no code-behavior risk)

- Correct claims everywhere (commit bodies were also overstated): "byte-identical payloads" → "payload parity for publish/hide/pin/restore/soft-delete/cancel/packing/delivered; **known gaps** now fixed in 003K"; "double-bind" → describe the DB-first bind accurately; "return URL never treated as payment proof" → note WEB `?success=true` still clears cart without verification (pre-existing; native is verified); `universal_links: code-complete` → "fixed in 003J (was defective under launch-URL re-entry), device-unverified"; "id-only projections" (`docs/NATIVE_ARCHITECTURE.md:~134`) → the attention query fetches full rows — **also FIX** it to a `head:true` count query in `NativeAdminShell.jsx` (`supabase.from('forum_posts_view').select('*',{count:'exact',head:true}).eq('is_published',false)` etc.); "~71KB entry" → add that total preloaded web JS is ~1.07MB raw / ~320KB gz; "own-row RLS" (push) → note admin override + the insert fix.
- Harden `tests/native-shell-polish.test.mjs` @capacitor guard regex to also catch side-effect imports and `export … from` re-exports.
- Update stale `AGENT_HANDOFF.md` (still narrates RLT-001*; never mentions RLT-IOS-003).
- Document deferred: **moderator-native gap** (non-admin moderators can moderate nothing natively — web grants pin/delete via `forumAction`; native only exposes moderation under RequireAdmin) → decide: expose mod actions in the native thread for `isModerator`, or document as an accepted native limitation. **push shared-device reassignment (PUSH2)** → RLT-IOS-004: needs a `SECURITY DEFINER` upsert-by-token RPC that reassigns ownership + disable-tokens-on-signout (own-row SELECT hides another user's token → B's `create` hits the unique(token) index → swallowed `.catch` → A's row stays pointed at B's device).

---

## Manual / deploy items (unchanged, none are code)
- Deploy Supabase Edge Functions together: `createCheckout` (changed) + `verifyCheckoutReturn` (new). No new secrets.
- Apply migration `0009_user_push_tokens.sql` (with the PUSH1 fix) before any push work.
- Finish Apple signing → run Codemagic `ios-capacitor` → signed IPA → TestFlight upload/install.
- Device-verify: universal-link checkout return, VoiceOver/Dynamic Type, `applinks` (apex only today; `www.` not in AASA).

## After 003I–003M
Re-run the 5-agent adversarial review on the delta (checkout authority / routing / guards+mutations / web-PII-RLS / perf-codemagic-honesty), each agent instructed to REFUTE. Then a single PR `rlt-ios-003-native-product` → `main` for Architect approval. Verdict source of truth for findings: this file.
