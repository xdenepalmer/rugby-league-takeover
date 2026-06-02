# Rugby League Takeover

Fan platform for the **Rugby League Takeover — Las Vegas**: news, multi-event info with external ticketing, travel-package interest, merch store (Stripe), a community forum, accounts, and an admin control centre. Built on **Base44** and installable as a PWA.

## 1. Project overview
A public, account-optional web app. Anonymous visitors can browse and (where allowed) participate; logged-in members get profiles, a forum with reactions/badges, order history, and notifications. Admins manage content, store, community moderation, people, and settings. The repo is GitHub-synced to Base44; the Base44 backend (functions + entities) is the system of record.

## 2. Tech stack
- **React 18 + Vite**, React Router, TanStack Query, Tailwind CSS, shadcn/ui, framer-motion, lucide-react, recharts.
- **Base44 SDK** (`@base44/sdk`) + `@base44/vite-plugin` for entities, auth, and serverless functions.
- **Stripe** hosted checkout (PCI SAQ A — no card data touches the app).
- **PWA**: service worker (`public/sw.js`) + web manifest.
- **Tests**: Node's built-in test runner (`node --test`). **Typecheck**: `tsc` against `jsconfig.json`. **Lint**: ESLint.

## 3. Local setup
```bash
npm install
npm run dev      # http://localhost:5173
```
Node 18+ recommended. The app runs locally; live data/auth require Base44 configuration (below).

## 4. Environment variables
Create `.env.local` (never commit it):
- `VITE_BASE44_APP_ID` — Base44 application id.
- `VITE_BASE44_APP_BASE_URL` — Base44 app base URL (enables the SDK proxy).
- `VITE_BASE44_FUNCTIONS_VERSION` — (if applicable) pin the deployed functions version.

Example:
```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
```
No secrets belong in the repo. Stripe secret keys live only in Base44 function settings, never in frontend env.

## 5. Scripts
- `npm run dev` — Vite dev server.
- `npm run build` — production build (stamps the service worker per build).
- `npm run lint` — ESLint (quiet).
- `npm run lint:fix` — ESLint autofix.
- `npm run typecheck` — `tsc -p ./jsconfig.json`.
- `npm test` — run the `tests/**/*.test.mjs` suite.
- `npm run preview` — preview the production build.

## 6. Base44 publish flow
1. Make code changes locally on a branch.
2. Validate (see §11) and commit.
3. Push to GitHub — Base44 picks up the synced repo.
4. **Publish** in Base44 to apply changes and go live.
5. New entities/entity-fields and functions must be **deployed in Base44** (GitHub sync alone does not deploy them to the running app).

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

## 10. Manual Base44 Publish requirement
Merging/pushing does **not** make changes live. A human must **Publish** in Base44. Any story that adds/changes Base44 functions or entities must call out the required deploy + publish step in its handoff.

## 11. Validation checklist (before publish)
- [ ] `npm test` passes
- [ ] `npm run lint` clean
- [ ] `npm run typecheck` clean
- [ ] `npm run build` succeeds
- [ ] Working tree intentional (no stray/competing-agent files committed)
- [ ] Required Base44 entities/functions deployed, then **Published**

## 12. Security notes
- **No secrets in the repo** — Stripe/secret keys live in Base44 function settings only.
- **Backend is authoritative; the frontend is projection only.** Never rely on client state for security or data integrity.
- **Admin access must be enforced server-side / by Base44** (RLS + service-role functions), not by hiding UI.
- PII (e.g. `ip_address`) is admin-only via entity RLS.
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
