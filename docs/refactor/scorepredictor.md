# ScorePredictor decomposition

Behaviour-preserving (extraction-only) refactor of `src/components/forum/ScorePredictor.jsx`.
No logic, styling, copy, animation, sound, or timing changes — code was moved verbatim and re-imported.
The default export name/signature (`export default function ScorePredictor({ onSharePrediction })`)
is unchanged, so `src/pages/Forum.jsx` keeps importing it at the same path.

## Line count

| File | Before | After |
|------|-------:|------:|
| `src/components/forum/ScorePredictor.jsx` | 1411 | 1182 |

## Old → new file map

All new files live under the new namespace dir `src/components/forum/tipping/`.

| New file | Extracted from ScorePredictor.jsx | Behaviour-preserving note |
|----------|-----------------------------------|---------------------------|
| `tipping/constants.js` | `STORAGE_KEY`, `PROFILE_KEY`, `POINTS_KEY`, `TIP_STREAK_KEY`, `MARGIN_PRESETS`, `PTS_CORRECT`, `PTS_MARGIN_BONUS` | Verbatim constant values; exported and re-imported. |
| `tipping/storage.js` | `readJson`, `writeJson` | Verbatim localStorage helpers incl. corruption handling. |
| `tipping/tipHelpers.js` | `isValidTip`, `sanitizeTips`, `shortName`, `deriveScores`, `getStatus`, `checkTipResult` | Pure helpers moved verbatim; imports `PTS_CORRECT`/`PTS_MARGIN_BONUS` from constants. |
| `tipping/audio.js` | `audioCtxRef`, `playTone`, `playLockSound`, `playSelectSound` | Verbatim WebAudio helpers; module-scoped `audioCtxRef` preserved. |
| `tipping/hooks.js` | `useCountdown`, `useAnimatedCounter` | Verbatim hooks; same effect deps and easing. |
| `tipping/ConfettiBurst.jsx` | `ConfettiBurst` | Verbatim; `useMemo` still runs BEFORE the `if (!active) return null;` early return (rules-of-hooks order preserved). |
| `tipping/PointsPopup.jsx` | `PointsPopup` | Verbatim motion popup. |
| `tipping/HeroStats.jsx` | `HeroStats` | Verbatim; imports `checkTipResult`, `useAnimatedCounter`, `readJson`, `TIP_STREAK_KEY`, `PTS_CORRECT`. |

## Left in place (intentionally)

Deeply-entangled stateful components remain in `ScorePredictor.jsx` to avoid behaviour risk:
`RoundBadge`, `LockedTipReceipt`, `LockedStamp`, `FixtureCard`, `CommunityPulse`, `Leaderboard`,
and the main `ScorePredictor` default export with its queries/mutations/effects.

## Validation

`npm test` (42 pass) · `npm run lint` (clean) · `npm run typecheck` (clean) · `npm run build` (succeeds) — all green.
