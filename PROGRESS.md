# PROGRESS — Rugby League Takeover

_Last updated: 2026-06-02 (RLT-001H-AMENDED)_

## Current source of truth
- **Integration branch (current):** `bmad/baseline-integration` @ RLT-001H doc commit — clean baseline restored from approved `e059872`.
- **Backup preserve branch:** `bmad/baseline-preserve-current-state` (validated pre-BMAD state @ `14d17a1`) — do not delete.
- **Store-shipping WIP branch:** `bmad/wip-store-shipping` (`f0684600`) — concurrent checkout/shipping work, isolated by RLT-001F; resume via RLT-011 only if the Architect chooses.
- **Codex store-shipping story WIP branch:** `bmad/story-rlt-011-codex-store-shipping` (`46d069b`) — current dirty WIP preserved by RLT-001H; `.gitignore` included for preservation only and is not approved for baseline.
- **Antigravity UI/UX WIP branch:** `bmad/wip-antigravity-uiux` (`65d417f`) — unapproved UI/UX pass (18 files), isolated by RLT-001G; must come back through `ui-ux-pro-max` + an approved BMAD story.
- **Local main repaired:** local `main` reset to `origin/main` (`8c3dd79`) during RLT-001H. No push performed.
- Canonical base for logic/backend remains `origin/main`; baseline branch remains the approved integration line.

## Core rules
- **Backend authority:** Base44 functions/entities are authoritative. The frontend is **projection only** — never trust client state for security or data integrity.
- **Manual Base44 Publish required:** merged code is not live until the app is published in Base44. GitHub sync alone does not publish to users.
- **Antigravity** is the dedicated UI/UX engineer and must use the **`ui-ux-pro-max`** skill (https://github.com/sickn33/antigravity-awesome-skills/tree/main) for UI/UX work.
- **No direct shared-branch work:** no agent may work directly on `main` or `bmad/baseline-integration` without an Architect-approved BMAD story.

## Validation status (clean baseline, RLT-001F @ `f6d1271`)
- `npm test` — ✅ pass (33/33)
- `npm run lint` — ✅ pass
- `npm run typecheck` — ✅ pass
- `npm run build` — ✅ pass
- Note: the prior `npm test` 43/44 (1 fail, "Stripe checkout … shipping") was caused by the concurrent store-shipping WIP polluting the working tree. RLT-001F isolated that WIP onto `bmad/wip-store-shipping`; the clean baseline passes 33/33.

## Status milestones
- RLT-001D — BMAD control-plane files + project identity — **Architect-approved**.
- RLT-001F — concurrent store-shipping WIP isolated; baseline restored clean — **Architect-approved**.
- RLT-001G — Antigravity UI/UX WIP isolated; baseline restored clean — **completed**.
- RLT-001H — active Codex store-shipping WIP preserved; branch discipline restored — **completed**. No feature implementation completed.
- RLT-001E — mobile/PWA/brand/store hardening — **implemented on `bmad/story-rlt-001e-claude`**; awaiting Architect/Antigravity review + merge.

## RLT-001E summary (story branch `bmad/story-rlt-001e-claude`, off `dacd266`)
- `min-h-dvh` across 8 shells + HeroSection double-viewport fix; local PWA icons (`/icons/*`) in manifest (maskable + shortcut icons) and index.html; OG/Twitter/description metadata; remote Base44 logo delocalized (HeroSection, SiteNav, SiteSettingsManager, index.html, manifest); Store checkout info-style preview notice (no `alert`), `inputMode=email`, Stripe secure-checkout trust signal; skip-to-content link. 5 deferred tests now green. Validation 37/37. No backend/entity/function changes.

## Current priorities (recommended next)
1. Review + merge `bmad/story-rlt-001e-claude` into `bmad/baseline-integration`.
2. RLT-001C — decide forum publish/moderation policy.
3. RLT-011 — store shipping checkout completion (only if Architect resumes `bmad/wip-store-shipping`).

## Process reminder
- **Antigravity** must work through **`ui-ux-pro-max`** specifications and an **approved BMAD story** before any UI implementation change is committed to baseline. Unapproved UI/UX passes will be isolated to a WIP branch (see RLT-001G).
- Concurrent agents should commit to their own branches, not the shared baseline working tree.
- `.gitignore` local tooling ignores were preserved only on the WIP branch; landing them on baseline requires a future control-plane story.

## Known deferred items
- **RLT-001C** — forum publish policy (moderate-before-publish vs auto-publish; `submitForumPost.is_published`).
- **RLT-001E** — mobile/PWA/brand/store hardening: `min-h-dvh` across 8 shells, local PWA icons in `index.html`/`manifest` + icon assets, remote-logo delocalization, `Store.jsx` inline checkout-error UX. (Tests authored on the preserve branch, deferred from RLT-001B for scope.)
- **RLT-004** — StoreOrder creation authority hardening (server-authoritative).
- **RLT-006** — checkout oversell/reservation strategy.

## Notes
- Concurrent implementation work (Codex) may appear in the working tree (e.g. store-shipping). Each agent commits only its own bounded story's files.
- No push / no PR without explicit Architect instruction.
