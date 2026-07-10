# Rugby League Takeover

Fan platform for the **Rugby League Takeover — Las Vegas**: news, multi-event info with external ticketing, travel-package interest, merch store (Stripe), a community forum, accounts, and an admin control centre. Built on **Supabase** (Postgres + Auth + Edge Functions + Storage) and installable as a PWA.

## 1. Project overview
A public, account-optional web app. Anonymous visitors can browse and (where allowed) participate; logged-in members get profiles, a forum with reactions/badges, order history, and notifications. Admins manage content, store, community moderation, people, and settings. The Supabase backend (Postgres tables + RLS, Edge Functions) is the system of record — see `MIGRATION-SUPABASE.md` for the full Base44 → Supabase migration record.

## 2. Tech stack
- **React 18 + Vite**, React Router, TanStack Query, Tailwind CSS, shadcn/ui, framer-motion, lucide-react, recharts.
- **Supabase** (`@supabase/supabase-js`) for data (Postgres + RLS), auth, Edge Functions, and Storage — wrapped by the compat client in `src/api/base44Client.js` which preserves the original `base44.*` call surface.
- **Stripe** hosted checkout (PCI SAQ A — no card data touches the app).
- **PWA**: service worker (`public/sw.js`) + web manifest.
- **Native iOS (Capacitor 8)**: a distinct native product — its own five-tab shell, native fan/admin screens and app-grade navigation over the same Supabase backend. See `docs/NATIVE_ARCHITECTURE.md`.
- **Tests**: Node's built-in test runner (`node --test`). **Typecheck**: `tsc` against `jsconfig.json`. **Lint**: ESLint.

## 3. Local setup
```bash
npm install
npm run dev      # http://localhost:5173
```
Node 22 recommended (CI pins 22; the Capacitor CLI requires 22+). The app connects to the Supabase project out of the box (the publishable key ships as a safe client-side default); override via env vars below.

## 4. Environment variables
Optional `.env.local` overrides (see `.env.example`):
- `VITE_SUPABASE_URL` — Supabase project URL.
- `VITE_SUPABASE_ANON_KEY` — Supabase publishable (anon) key.

No secrets belong in the repo. Stripe/Resend secret keys live only in Supabase Edge Function secrets (`supabase secrets set` / dashboard), never in frontend env.

## 5. Scripts
- `npm run dev` — Vite dev server.
- `npm run build` — production build (stamps the service worker per build).
- `npm run lint` — ESLint (quiet).
- `npm run lint:fix` — ESLint autofix.
- `npm run typecheck` — `tsc -p ./jsconfig.json`.
- `npm test` — run the `tests/**/*.test.mjs` suite.
- `npm run preview` — preview the production build.
- `npm run ios:build` — web build + sync into the iOS shell (`vite build && cap sync ios`).
- `npm run ios:sync` / `npm run ios:open` / `npm run ios:run` — Capacitor sync / open in Xcode / run (Mac only for open/run).

## 6. Deploy flow
1. Make code changes locally on a branch.
2. Validate (see §11) and commit.
3. Frontend: `npm run build` → deploy `dist/` to your static host.
4. Database schema changes: add a migration under `supabase/migrations/` and apply it to the project.
5. Edge Functions: edit `supabase/functions/<name>/index.ts` (shared helpers live in `supabase/functions/_shared/shared.ts`; run `node scripts/sync-shared.mjs` after editing them) and deploy to Supabase.
6. iOS: the Capacitor shell in `ios/` ships via Xcode/TestFlight — see `docs/iOS_RUNBOOK.md` and `docs/APP_STORE_CHECKLIST.md`. Web deploys do not update the installed app.

## 7. BMAD workflow rules
- **No code without a story.** One story = one bounded change.
- Each story defines: objective, context, files affected, implementation steps, test plan, rollback plan.
- Lifecycle files: `TASKS.md`, `PROGRESS.md`, `AGENT_HANDOFF.md`, `RUN_LOG.md`.
- If the work needs out-of-scope/forbidden files, **stop and request Architect clarification**.
- **No push / no PR without explicit Architect instruction.**

## 8. Agent roles
- **ChatGPT — Architect/controller** (owns stories, scope, approvals).
- **Codex — implementation agent.**
- **Claude Code — review/audit + approved implementation when assigned.**
- **Antigravity — dedicated UI/UX engineer.**

## 9. Antigravity `ui-ux-pro-max` requirement
All UI/UX work is performed by **Antigravity** using the **`ui-ux-pro-max`** skill from
https://github.com/sickn33/antigravity-awesome-skills/tree/main. Other agents should not hand-roll UI/UX that bypasses this.

## 10. Backend deploy requirement
Merging/pushing does **not** make backend changes live. Database migrations and Edge Functions must be applied/deployed to the Supabase project. Any story that changes them must call out the required deploy step in its handoff.

## 11. Validation checklist (before publish)
- [ ] `npm test` passes
- [ ] `npm run lint` clean
- [ ] `npm run typecheck` clean
- [ ] `npm run build` succeeds
- [ ] Working tree intentional (no stray/competing-agent files committed)
- [ ] Required Supabase migrations applied and Edge Functions deployed

## 12. Security notes
- **No secrets in the repo** — Stripe/secret keys live in Supabase Edge Function secrets only.
- **Backend is authoritative; the frontend is projection only.** Never rely on client state for security or data integrity.
- **Admin access must be enforced server-side** (Postgres RLS + service-role Edge Functions), not by hiding UI.
- PII (e.g. `ip_address`, linked user emails) is admin-only, enforced by sanitising SQL views (`forum_posts_view`, `testimonials_view`, `tipping_entries_view`).
- Payments use Stripe **hosted** checkout (PCI SAQ A); no card data touches the site or DB.

## 13. PWA notes
- Service worker (`public/sw.js`) is byte-stamped per build so updates are detectable; an in-app update prompt offers reload-to-latest.
- Static assets are cached stale-while-revalidate for fast/offline repeat launches; navigations are network-first with an offline fallback.
- Installable with home-screen/standalone metadata and safe-area handling.

## 14. Store / checkout notes
- Stripe **hosted** checkout; orders persist via the `createCheckout` function + `StoreOrder` entity.
- StoreOrder creation authority hardening and oversell/reservation strategy are tracked (RLT-004 / RLT-006).
- Checkout/account/auth logic is backend-authoritative; do not change it outside an approved story.

## 15. Forum / community notes
- Posting/reactions/registration run through service-role functions (`submitForumPost`, `forumAction`, `submitRegistration`) with IP capture + ban enforcement.
- Reactions are a real per-emoji map; avatars/location/team/badges resolve live via `forumAvatars`.
- **Publish/moderation policy is under decision (RLT-001C):** moderate-before-publish vs auto-publish.

## 16. Deferred baseline stories
- **RLT-001C** — forum publish/moderation policy.
- **RLT-001E** — mobile/PWA/brand/store hardening (dynamic viewport height across shells, local PWA icons, brand-asset delocalization, inline checkout-error UX).
- **RLT-004** — StoreOrder creation authority hardening.
- **RLT-006** — checkout oversell/reservation strategy.

_See `TASKS.md` for the full story board and `AGENT_HANDOFF.md` for the workflow contract._
