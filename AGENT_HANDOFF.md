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
- **RLT-IOS-003 — native iOS product** (branch `rlt-ios-003-native-product`).
  003A–H built the distinct native product: platform split with a latched
  `isNativeApp()`, five-tab native fan shell + native fan screens, native
  admin shell with three true native workflows (Orders / Moderation /
  Registrations), state/perf layer (allowlisted query persistence, windowed
  feeds, scroll+tab memory, haptics), and the server-authoritative checkout
  return (`verifyCheckoutReturn`). A mandated 5-agent adversarial review
  then confirmed every security/architecture claim but found real defects +
  overstated claims; corrective stories **003I–003M** (security/data ·
  lifecycle · admin payload parity · routing/UX · docs/honesty) fixed all
  confirmed findings. Source of truth for the findings + fixes:
  `docs/RLT-IOS-003-CORRECTION-HANDOFF.md`; architecture + honest status
  matrix: `docs/NATIVE_ARCHITECTURE.md`.
- **State:** gate green (tests · lint · typecheck · build · cap sync ios)
  at every story commit. NO PR, NO merge yet — after the delta re-review, a
  single PR `rlt-ios-003-native-product` → `main` goes to the Architect.
- **Earlier waves:** the RLT-001* hotfix/reconciliation series and the
  RLT-002 refactor wave are merged history on `main`; their narratives live
  in this file's git history and `RUN_LOG.md`, not here.

## Antigravity working rule
Antigravity must work through **`ui-ux-pro-max`** specifications and an **approved BMAD story** before any UI implementation change is committed to baseline. Unapproved UI/UX edits to the shared working tree are isolated to a WIP branch (RLT-001G precedent). Prefer committing to a dedicated Antigravity branch.

## Next action router
- → **Adversarial re-review** of the 003I–003M delta (checkout authority /
  routing / guards+mutations / web-PII-RLS / perf-codemagic-honesty), each
  agent instructed to REFUTE. Then Architect review → single PR
  `rlt-ios-003-native-product` → `main`.
- → **Manual deploy items (not code):** deploy `createCheckout` +
  `verifyCheckoutReturn` together; apply migration
  `0009_user_push_tokens.sql` (carries the 003I insert-policy fix) before
  any push work; finish Apple signing → Codemagic `ios-capacitor` (now
  auto-increments the build number) → TestFlight; device-verify universal
  links + checkout return + VoiceOver/Dynamic Type.
- → **Deferred / follow-up stories:** RLT-IOS-004 (APNs send pipeline +
  PUSH2 shared-device token reassignment via SECURITY DEFINER upsert RPC +
  disable-tokens-on-signout); moderator-native gap decision (expose
  `forumAction` mod tools in the native thread for `isModerator`, or accept
  as a documented native limitation); native presentation for the remaining
  19 wrapped admin modules; native Google OAuth per the plan in
  `docs/NATIVE_ARCHITECTURE.md`.
