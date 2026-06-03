# Refactor: decompose `src/pages/Forum.jsx` into bounded modules

Behaviour-preserving extraction only. No behaviour, logic, styling, or copy
changes. `Forum.jsx` keeps its default export and all runtime behaviour; only
self-contained inner components and pure helpers were lifted into new files and
imported back.

## Line count

| File | Before | After |
|------|-------:|------:|
| `src/pages/Forum.jsx` | 2320 | 1217 |

## New namespace

All new files live under `src/components/forum/feed/`.

## Old → new file map

Each module was moved **verbatim** (only `import`/`export` statements adjusted).

| New file | What moved out of `Forum.jsx` | Behaviour note |
|----------|-------------------------------|----------------|
| `forumHelpers.js` | `CATEGORY_META`, `getCategoryMeta`, `parseForumDate`, `timeAgo`, `getRecencyScore`, `nameHash`, `threadUrl`, and a copy of `getEngagement` | Pure functions/constants; identical output. `getEngagement` is duplicated here for the feed components but ALSO kept verbatim in `Forum.jsx` (see guardrail note). |
| `forumBadges.js` | `BADGE_LEVELS`, `getAuthorBadge`, `BADGE_ICON_MAP` | Pure badge-level lookup; unchanged. |
| `ShareSaveButtons.jsx` | `shareThread`, `SAVED_KEY`/`getSavedPosts`/`isPostSaved`/`toggleSavedPost`, `ShareButton`, `SaveButton` | Same DOM, same `localStorage` keys, same `toast` calls. |
| `AnimatedNumber.jsx` | `AnimatedNumber` | Same rAF easing animation. |
| `FloatingParticles.jsx` | `FloatingParticles` | Same 30-particle memoised render. |
| `UserAvatar.jsx` | `UserAvatar` (memo) | Same hue hashing + sizes. |
| `UserProfileHoverCard.jsx` | `UserProfileHoverCard` | Same hover timers/positioning. |
| `UserAchievements.jsx` | `UserAchievements` | Same `localStorage` + `rlt_badge_event` listener logic. |
| `AuthorBadge.jsx` | `AuthorBadge` | Same badge render. |
| `AuthorMeta.jsx` | `AuthorMeta` | Same opt-in location/team/badge render (keeps `TeamCrest`). |
| `LiveActivityTicker.jsx` | `LiveActivityTicker` | Same dismissible marquee. |
| `OnlineUsersWidget.jsx` | `OnlineUsersWidget` (memo) | Same online-count heuristic. |
| `TrendingCard.jsx` | `TrendingCard` (memo) | Same card; uses `getEngagement` from `forumHelpers`. |
| `CategoryPill.jsx` | `CategoryPill` (memo) | Same pill markup/animation. |
| `TopContributors.jsx` | `TopContributors` (memo) | Same leaderboard aggregation. |
| `RecentActivityFeed.jsx` | `RecentActivityFeed` | Same recent-3 sort. |
| `CollapsibleGuidelines.jsx` | `CollapsibleGuidelines` | Same collapsible list. |
| `EmptyState.jsx` | `EmptyState` | Same empty-state CTAs. |
| `ScrollToTopButton.jsx` | `ScrollToTopButton` | Same scroll listener. |
| `ThreadDetailModal.jsx` | `ThreadDetailModal` (memo) | Same modal, same `forumAction` react mutation and body-scroll lock. |
| `ComposeSidebar.jsx` | `ComposeSidebar` (and its local `categories` array) | Same compose form, planner, predictor, slot machine, stats, contributors, online widget, recent activity, guidelines. |

## Intentionally NOT extracted (kept in `Forum.jsx`)

These stay because they carry strings/classNames that test files source-grep on
`Forum.jsx`, or because the test explicitly requires the definition to live in
`Forum.jsx`:

- `getEngagement` — `tests/forum-engagement-counters.test.mjs` greps `Forum.jsx`
  for `const likes = Math.max(0,` and `const views = Math.max(0,`. The verbatim
  function is kept in `Forum.jsx` and is the one used by the page body; the
  feed components import an identical copy from `forumHelpers.js` to avoid a
  circular import.
- `SortTabs` — carries `forum-sort-tabs` (sole occurrence in repo).
- `ForumPostCard` — carries `forum-post-card` and `forum-engagement-bar` (sole
  occurrences).
- `MobileFAB` — carries `forum-compose-fab` (sole occurrence).
- The main `Forum` component body — carries `forum-mobile-shell`,
  `forum-mobile-hero`, `forum-mobile-content`, `forum-filter-rail`,
  `pb-[calc(7rem+var(--safe-bottom))]`, and `min-h-dvh`, all asserted by
  `tests/forum-mobile-layout.test.mjs` and `tests/mobile-viewport-shells.test.mjs`.

## Validation

- `npm test` — 42/42 pass
- `npm run lint` — clean
- `npm run typecheck` — clean
- `npm run build` — succeeds (emits `Forum-*.js` chunk)

No backend / forum-policy / schema files were touched. Manual Base44 Publish is
required after merge.
</content>
