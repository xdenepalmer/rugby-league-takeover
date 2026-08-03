-- ---------------------------------------------------------------------------
-- 0029 — Server-side tipping ladder.
--
-- The client used to build the ladder by aggregating the newest 500 rows of
-- tipping_entries_view. Two problems, both fatal to a season-long comp:
--
--   1. The 500-row cap is global across all tippers, so by mid-season the
--      "Season" ladder only covered the last couple of rounds — ranks and
--      point totals were simply wrong.
--   2. tipping_entries_view masks user_id to NULL for everyone except the
--      row's owner (privacy, migration 0014), so the client could only ever
--      key rivals by display name. Two accounts sharing a name merged into
--      one row, and every anonymous entry collapsed into a single phantom
--      "Vegas Fan" that accumulated points from every guest on the site.
--
-- Aggregating in the database fixes both: it sees every row, groups by the
-- real user_id, and exposes a stable OPAQUE key instead of the uuid.
-- Grouping by (user, round) keeps the row count tiny (tippers x rounds) and
-- lets the client offer both Season and Round scopes from one fetch.
--
-- Guests (no user_id) are excluded: the server cannot tell one anonymous
-- tipper from another without exposing IPs, and inventing a shared row is
-- worse than honestly saying "sign in to appear on the ladder".
-- ---------------------------------------------------------------------------
create or replace view public.tipping_ladder_view
with (security_barrier = true)
as
select
  md5(user_id)                                                   as tipster_key,
  coalesce(nullif(game_label, ''), 'NRL Fixture')                as game_label,
  max(tipper_name)                                               as tipper_name,
  count(*)::int                                                  as tips,
  coalesce(sum(points), 0)::int                                  as points,
  count(*) filter (where result in ('win', 'perfect'))::int       as wins,
  count(*) filter (where result = 'perfect')::int                 as perfects,
  count(*) filter (where settled_at is not null)::int             as settled,
  -- The WHERE clause guarantees user_id <> '', so a signed-out viewer
  -- (current_profile_id() is null -> '') can never match a row.
  bool_or(user_id = coalesce((select public.current_profile_id()), '')) as is_me
from public.tipping_entries
where coalesce(user_id, '') <> ''
group by user_id, coalesce(nullif(game_label, ''), 'NRL Fixture');

grant select on public.tipping_ladder_view to anon, authenticated;

-- The ladder groups by user across the whole season; the settlement index
-- (0014) covers game lookups but not this scan.
create index if not exists tipping_entries_user_label_idx
  on public.tipping_entries (user_id, game_label);
