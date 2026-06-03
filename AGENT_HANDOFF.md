# AGENT HANDOFF — Rugby League Takeover

Multi-agent BMAD workflow. This file defines who does what and how work is handed off.

## Agent hierarchy
1. **ChatGPT — Architect / controller.** Owns stories, scope, approvals, and conflict-resolution decisions. No story → no code.
2. **Codex — implementation agent.** Implements approved stories.
3. **Claude Code — review/audit agent, and approved implementation agent when explicitly assigned.** Audits state, analyzes conflicts, and implements bounded stories on approval.
4. **Antigravity — dedicated UI/UX engineer.** Performs all UI/UX work and **must use the `ui-ux-pro-max` skill** (https://github.com/sickn33/antigravity-awesome-skills/tree/main).

## Core rules
- **No code without a story.** One story = one bounded change with objective, context, files affected, steps, test plan, rollback plan.
- **Backend authority:** Base44 functions/entities are authoritative; frontend is projection only.
- **Manual Base44 Publish:** nothing is live until published in Base44.
- **Ambiguity rule:** _If ambiguity exists, stop and request Architect clarification._ Do not guess scope.
- **No push / no PR** without explicit Architect instruction.
- **No direct shared-branch work:** no agent may work directly on `main` or `bmad/baseline-integration` without an Architect-approved BMAD story.

## Handoff protocol
1. Architect issues a story (ID, title, approval, strict scope, allowed/forbidden files, steps, validation, expected result, required report).
2. Implementation agent works **only** within the allowed scope. If the work requires touching forbidden/out-of-scope files, **STOP and report** rather than expand scope.
3. Agent runs validation (`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`).
4. Agent commits with the story's specified message; does **not** push.
5. Agent returns the required handoff report.
6. Review agent (Claude) audits; Architect accepts or routes the next story.

## Required handoff report format
1. Branch/latest commit before and after
2. Exact files changed
3. Data/model changes
4. UI/UX changes
5. Backwards compatibility / historical data preservation
6. Tests/contracts added or updated
7. Validation results
8. Base44 schema/function deploy requirements
9. Manual Base44 Publish requirement
10. Memory updates
11. Commit hash(es) created
12. Final status: code_complete / built / deployed / published / live_verified
13. NEXT ACTION ROUTER

## Current story
- **RLT-HOTFIX-001** — Restore main build gate + background-video autoplay. Worktree `bmad/story-rlt-hotfix-001` off `origin/main` (`a95e767`). Account.jsx build break already fixed on main (verified green, untouched). `BackgroundVideo.jsx`: restored `FORMAT_RANK` mp4-first sort (auto-sync had stripped it → `.mov` first = no autoplay), dropped mobile-viewport disable (kept save-data + reduced-motion), `preload` none→metadata. New `tests/background-video-policy.test.mjs` (5 guards). **tests 50/50, lint/typecheck/build green.** Frontend-only; explicit-path staging; **not pushed.** Manual Publish only (no backend). Awaiting Architect review/merge. ⚠️ Recurring root cause: Base44 auto-sync keeps stripping hand-coded fixes — the new guard test is the durable defence.
- **RLT-001C-1b** — Restore local PWA install assets in `index.html` (worktree off `main` `876de8c`, branch `bmad/story-rlt-001c-1b-index-assets`). A Base44 auto-sync commit (`29080c8`) re-added the remote logo to `index.html`, breaking `app-shell-metadata`+`local-brand-assets` (main 40/42). Reverted the 2 icon `href`s to `/icons/icon-192.png` → **tests 42/42**, lint/typecheck/build green. `index.html` only; no src/backend changes; explicit-path staging. Commit `fix: restore local PWA install assets`. No push. **Manual Base44 Publish blocked until merged + green.**
- **RLT-001C / C-1** — Policy = Option D; truthful compose copy merged (PR #8 → `main` `876de8c`).
- **RLT-001X** — forum `getEngagement` clamp; merged into main earlier. **Refactor wave (#5/#6/#7)** merged (Forum/Slot/ScorePredictor decomposed). **RLT-001W** lint gate merged.
- **RLT-001W** — MERGED via PR #3 squash → `main` `258c642` (RLT-001W-MERGE; trial-merge verified conflict-free + green). Lint gate restored.
- **RLT-001V** — BLOCKED (env instability); superseded by RLT-001W. **RLT-001P/Q/R/S/T/U** superseded.
- Manual Base44 Publish still required to take merged work live.
- **RLT-001V** — BLOCKED by environment instability (local shared tree churned; contaminated commit `74cb431` reset, concurrent work preserved). Superseded by RLT-001W.
- **RLT-001S** — engagement clamp (`84e69c6`); merge after RLT-001W lands lint-green (re-apply on then-current `main` if moved).
- **RLT-001P/Q/R/T/U** — superseded. **RLT-001M/L** — PR #2 merged into `main` (`56ddbfc`); Manual Base44 Publish still required.
- ⚠️ **Process:** Base44 auto-sync continuously overwrites the shared local tree — do source fixes via fixed-SHA worktrees or GitHub PRs, not the live local checkout.
- **RLT-001T/U** — accepted in substance, **superseded by RLT-001V**. **RLT-001R/P/Q** abandoned/superseded.
- **RLT-001M / L** — PR #2 squash-merged into `main` (`56ddbfc`); PR #1 closed superseded. Manual Base44 Publish still required.
- ⚠️ **Process:** relentless concurrent-agent churn keeps moving `main` and shifting lint targets — merge RLT-001V promptly; consider a CI lint gate on the Base44 auto-sync commits.
- **RLT-001J** — Read-only conflict analysis; established `origin/main` = Antigravity WIP (`65d417f`) + sync commit; recommended Option B. Completed.
- **RLT-001I** — Pushed `bmad/baseline-integration` and opened PR #1; GitHub flagged CONFLICTING. Completed (not merged).
- **RLT-001E-MERGE** — Merged approved RLT-001E (+ FIXUP) from `bmad/story-rlt-001e-claude` (`a79df80`) into `bmad/baseline-integration` via `--no-ff` (no conflicts). Antigravity final UX pass P0 12/12. 37/37 validation green. Manual Base44 Publish required to go live. No backend/entity/function changes.
- **RLT-001H-AMENDED** — Preserve active Codex store-shipping WIP including `.gitignore` safety change and restore branch discipline. Completed.
- Active Codex store-shipping WIP is preserved on `bmad/story-rlt-011-codex-store-shipping` (`46d069b`). No feature implementation completed.
- `.gitignore` was preserved with the WIP branch only; it is not an approved baseline change and needs a future control-plane story if it should land.
- Local `main` was repaired to `origin/main` (`8c3dd79`). No push performed.
- **RLT-001G** — Isolate Antigravity UI/UX WIP from the approved baseline (source-control hygiene). Completed.
- RLT-001F (store-shipping WIP isolation) — Architect-approved.
- RLT-001D (BMAD files + identity) — Architect-approved.

## Antigravity working rule
Antigravity must work through **`ui-ux-pro-max`** specifications and an **approved BMAD story** before any UI implementation change is committed to baseline. Unapproved UI/UX edits to the shared working tree are isolated to a WIP branch (RLT-001G precedent). Prefer committing to a dedicated Antigravity branch.

## Next action router
- → **Architect + Claude review:** review `bmad/reconcile-rlt-001k` (RLT-001K). On approval, authorize pushing it and opening a **replacement PR** (`bmad/reconcile-rlt-001k` → `main`, conflict-free), then **close PR #1** referencing the new one. Still pending: **RLT-001C** (forum publish policy); whether to resume **RLT-011** (store-shipping).
- → **Push / PR:** RLT-001K committed locally only — **no push** performed; awaiting explicit Architect instruction for the replacement PR. PR #1 remains open (superseded), not merged, not closed.
- → **Manual Base44 Publish** required after the reconciled branch is merged — GitHub sync alone does not publish.
- → **Branches:** reconciliation (current) = `bmad/reconcile-rlt-001k` (from `origin/main`, validated 37/37); integration (superseded) = `bmad/baseline-integration` (`4aa991f`, = PR #1 head); backup preserve = `bmad/baseline-preserve-current-state` (`14d17a1`); store-shipping WIP = `bmad/wip-store-shipping` (`f0684600`); Codex store-shipping story WIP = `bmad/story-rlt-011-codex-store-shipping` (`46d069b`); Antigravity UI/UX WIP = `bmad/wip-antigravity-uiux` (`65d417f`); local `main` = `origin/main` (`8c3dd79`).
