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
- **RLT-001F** — Isolate concurrent store-shipping WIP from the approved baseline (source-control hygiene). Completed.
- RLT-001D (BMAD files + identity) — Architect-approved.

## Next action router
- → **Architect:** schedule **RLT-001E** (mobile/PWA/brand/store hardening); decide **RLT-001C** (forum publish policy); decide whether to resume **RLT-011** (store-shipping WIP on `bmad/wip-store-shipping`).
- → **Push / PR:** awaiting explicit Architect instruction (none performed).
- → **Branches:** integration = `bmad/baseline-integration` (clean, validated); backup preserve = `bmad/baseline-preserve-current-state` (`14d17a1`); store-shipping WIP = `bmad/wip-store-shipping` (`f0684600`).
