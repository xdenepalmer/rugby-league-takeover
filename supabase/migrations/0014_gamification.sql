-- Gamification upgrade: server-side slot machine state, real tipping
-- settlement, and daily-missions bonus tracking.

-- ---------------------------------------------------------------------------
-- 1. Profiles: slot + daily-bonus state (server-authoritative, so streaks and
--    spin history follow the account across devices).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists slot_last_spin_date text,
  add column if not exists slot_total_spins numeric not null default 0,
  add column if not exists slot_streak numeric not null default 0,
  add column if not exists slot_extra_date text,
  add column if not exists slot_extra_count numeric not null default 0,
  add column if not exists daily_bonus_date text;

-- ---------------------------------------------------------------------------
-- 2. Tipping entries: server-side settlement (real points instead of the
--    client-side fabricated ladder).
--    result: 'perfect' (winner + exact margin), 'win' (winner), 'loss'.
-- ---------------------------------------------------------------------------
alter table public.tipping_entries
  add column if not exists points numeric,
  add column if not exists settled_at timestamptz,
  add column if not exists result text;

-- Expose settlement in the sanitised public view (recreated with the same
-- privacy rules as migration 0005, plus the new columns).
create or replace view public.tipping_entries_view
with (security_barrier = true)
as
select
  id, game_id, game_label, home_team, away_team, selected_team,
  predicted_home_score, predicted_away_score, margin, confidence, tipper_name,
  case when (select public.is_admin()) or user_id = coalesce((select public.current_profile_id()), '') then user_id else null end as user_id,
  case when (select public.is_admin()) then user_email else null end as user_email,
  kickoff, created_date, updated_date,
  points, settled_at, result
from public.tipping_entries;

grant select on public.tipping_entries_view to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Reward events: new kinds for tipping wins and the daily-missions bonus.
-- ---------------------------------------------------------------------------
alter table public.forum_reward_events
  drop constraint if exists forum_reward_events_kind_check;
alter table public.forum_reward_events
  add constraint forum_reward_events_kind_check
  check (kind in ('thread', 'reply', 'reaction_given', 'reaction_received', 'streak_bonus', 'slot_win', 'tip_win', 'daily_bonus'));

-- Settlement scans tips per game; index keeps it cheap.
create index if not exists tipping_entries_game_settled_idx
  on public.tipping_entries (game_id, settled_at);
