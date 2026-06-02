# PROGRESS — Rugby League Takeover

_Last updated: 2026-06-02 (RLT-001D)_

## Current source of truth
- **Integration branch (current):** `bmad/baseline-integration`
- **Backup preserve branch:** `bmad/baseline-preserve-current-state` (validated pre-BMAD state @ `14d17a1`) — do not delete.
- **Current commit (pre-RLT-001D):** `ec638222da47bcb3beedd4ab63c1ebd1d3ea082d`
- Canonical base for logic/backend remains `origin/main`.

## Core rules
- **Backend authority:** Base44 functions/entities are authoritative. The frontend is **projection only** — never trust client state for security or data integrity.
- **Manual Base44 Publish required:** merged code is not live until the app is published in Base44. GitHub sync alone does not publish to users.
- **Antigravity** is the dedicated UI/UX engineer and must use the **`ui-ux-pro-max`** skill (https://github.com/sickn33/antigravity-awesome-skills/tree/main) for UI/UX work.

## Validation status (from RLT-001B @ `ec63822`)
- `npm test` — ✅ pass (33/33)
- `npm run lint` — ✅ pass
- `npm run typecheck` — ✅ pass
- `npm run build` — ✅ pass

## Current priorities
1. RLT-001D — establish BMAD control-plane files + project identity (this story).
2. RLT-001C — decide forum publish/moderation policy.
3. RLT-001E — mobile/PWA/brand/store hardening (deferred preserved tests + source).

## Known deferred items
- **RLT-001C** — forum publish policy (moderate-before-publish vs auto-publish; `submitForumPost.is_published`).
- **RLT-001E** — mobile/PWA/brand/store hardening: `min-h-dvh` across 8 shells, local PWA icons in `index.html`/`manifest` + icon assets, remote-logo delocalization, `Store.jsx` inline checkout-error UX. (Tests authored on the preserve branch, deferred from RLT-001B for scope.)
- **RLT-004** — StoreOrder creation authority hardening (server-authoritative).
- **RLT-006** — checkout oversell/reservation strategy.

## Notes
- Concurrent implementation work (Codex) may appear in the working tree (e.g. store-shipping). Each agent commits only its own bounded story's files.
- No push / no PR without explicit Architect instruction.
