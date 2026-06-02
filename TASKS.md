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
| RLT-001A | Preserve dirty validated pre-BMAD state | completed | Safety branch `bmad/baseline-preserve-current-state` @ `14d17a1` |
| RLT-001B | Reconcile origin-canonical forum mobile layer | completed | In-scope (`index.css` + `Forum.jsx` + `forum-mobile-layout` test) on `bmad/baseline-integration` @ `ec63822` |
| RLT-001C | Decide forum publish policy (moderate vs auto-publish) | queued | Gates `forum-function-policy.test.mjs`; touches `submitForumPost` |
| RLT-001D | BMAD files + project identity/docs | in_progress | This story (control-plane only) |
| RLT-001E | Mobile/PWA/brand/store hardening | queued | The 5 deferred preserved tests + their source (8-shell `min-h-dvh`, local PWA icons, brand-asset delocalization, Store inline-error UX) |
| RLT-002 | Replace starter README | completed (in RLT-001D) | Project-specific README |
| RLT-003 | Normalize project identity metadata | completed (in RLT-001D) | `package.json`, `package-lock.json`, `base44/config.jsonc` |
| RLT-004 | Harden StoreOrder creation authority | queued | Server-authoritative order creation |
| RLT-005 | Forum reaction/view race-condition review | queued | Concurrent `reactions`/`view_count` writes |
| RLT-006 | Checkout oversell/reservation strategy | queued | Stock reservation / oversell prevention |
| RLT-007 | Split Forum.jsx into bounded modules | backlog | Large-file decomposition |
| RLT-008 | Clean install/build validation | queued | Fresh `npm ci` + build determinism |
| RLT-009 | Account My Orders section | queued (after baseline) | Order history in `/account` |
| RLT-010 | Checkout Trust Layer | queued (after Antigravity UX spec) | Trust/conversion UX; needs Antigravity `ui-ux-pro-max` spec |
