# Refactor: SlotMachineBadgeUnlock decomposition

Behaviour-preserving (extraction only) decomposition of the giant
`src/components/forum/SlotMachineBadgeUnlock.jsx` component into bounded modules
under a new `src/components/forum/slot/` namespace.

- Base SHA: `e40051572f8865dd103dc278eeffb1eb639242ad` (origin/main, lint-green)
- Branch: `refactor/slotmachine-decomp`
- The default export name/signature (`SlotMachineBadgeUnlock`) and the file path
  (`src/components/forum/SlotMachineBadgeUnlock.jsx`) are unchanged, so
  `Forum.jsx`'s import keeps working.

## Line count before / after

| File | Lines |
|------|-------|
| `SlotMachineBadgeUnlock.jsx` (before) | 1679 (1680 incl. trailing) |
| `SlotMachineBadgeUnlock.jsx` (after)  | 774 |

The main file now holds only the deeply-entangled stateful spin logic
(state, refs, effects, audio callbacks, `awardBadge`, `updateStreak`,
`finishSpin`, `handleSpin`) and the top-level JSX layout. All cleanly
separable pieces were extracted verbatim.

## old → new file map

All new files live under `src/components/forum/slot/`. Each extraction moved
code verbatim; only `import`/`export` lines were adjusted. No classNames,
animations, sound timings, copy, or logic changed.

| New file | Extracted from original | Notes |
|----------|-------------------------|-------|
| `slotConstants.js` | constants block (ALL_EMOJIS, REEL_* , *_KEY, VALID_BADGE_IDS, TIER_STYLES, TIER_ORDER) | Pure constants/tables — behaviour-preserving. |
| `slotStorage.js` | safeGetItem/safeSetItem/safeGetJSON/safeReadIds/migrateStorage/safeGetNumber + badge-win-timestamp, win-history, last-win-spin helpers | localStorage/cooldown/pity helpers — behaviour-preserving. |
| `slotHelpers.js` | randomEmoji, fmtCountdown, makeReelTrack, getDateStr | Pure helpers — behaviour-preserving. |
| `LuckyMeter.jsx` | `LuckyMeter` component | Default export — behaviour-preserving. |
| `WinHistoryLog.jsx` | `WinHistoryLog` component | Default export; uses getWinHistory + TIER_STYLES — behaviour-preserving. |
| `StatsPanel.jsx` | `StatsPanel` component | Default export; uses getWinHistory + MAX_HISTORY — behaviour-preserving. |
| `LoadingSkeleton.jsx` | `LoadingSkeleton` component | Default export — behaviour-preserving. |
| `effects.jsx` | `AmbientParticles`, `NeonGlow`, `WinCelebration` | Named exports (visual effects) — behaviour-preserving. |
| `ReelWindow.jsx` | `ReelWindow` component | Default export (reel/cell rendering) — behaviour-preserving. |
| `Lever.jsx` | `Lever` component | Default export — behaviour-preserving. |
| `rings.jsx` | `ProgressRing`, `CooldownRing` | Named exports; CooldownRing uses SPIN_COOLDOWN_MS + fmtCountdown — behaviour-preserving. |
| `TypewriterMessage.jsx` | `TypewriterMessage` component | Default export — behaviour-preserving. |
| `BadgeCard.jsx` | `BadgeCard` component | Default export; uses TIER_STYLES — behaviour-preserving. |
| `EmptyStateGuide.jsx` | `EmptyStateGuide` component | Default export — behaviour-preserving. |
| `TierGroupHeader.jsx` | `TierGroupHeader` component | Default export; uses TIER_STYLES — behaviour-preserving. |

The main file imports each of these back. The original unused local
`blurAmount` (in ReelWindow) and `todayDate` (in init effect) were preserved
verbatim to avoid any behaviour change.

## Validation

All green at time of refactor:

- `npm test` — 42 pass, 0 fail
- `npm run lint` — clean
- `npm run typecheck` — clean
- `npm run build` — exit 0

No tests reference `SlotMachine`/this file's source anchors, so no source
strings needed pinning in place.

## Scope / safety

No DO-NOT-MODIFY files were touched (Forum.jsx, ScorePredictor.jsx, base44/,
submitForumPost, forumAction, ForumPost schema, store/checkout, BMAD docs,
tests/). Manual Base44 Publish required after merge.
