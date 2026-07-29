-- Community privacy and gamification integrity hardening.

create or replace view public.forum_posts_view
with (security_barrier = true)
as
select
  id, author_name, author_avatar, title, body, category, parent_id,
  is_published, is_pinned,
  case when (select public.is_admin()) then user_email else null end as user_email,
  case when (select auth.role()) = 'authenticated' then user_id else null end as user_id,
  case when (select public.is_admin()) then ip_address else null end as ip_address,
  media_url, media_type, like_count,
  case when (select auth.role()) = 'authenticated' then liked_by else '[]'::jsonb end as liked_by,
  case when (select auth.role()) = 'authenticated' then reactions else '{}'::jsonb end as reactions,
  view_count, deleted_at, deleted_by, moderation_reason, reported_count,
  case when (select public.is_admin()) then reported_by else '[]'::jsonb end as reported_by,
  created_date, updated_date
from public.forum_posts
where
  is_published
  or (select public.is_admin())
  or (user_id is not null and user_id = coalesce((select public.current_profile_id()), ''));

grant select on public.forum_posts_view to anon, authenticated;

-- Keep all reward and daily-gate state server-authoritative. Migration 0002's
-- trigger predates the slot/daily fields added in 0014, so without replacing
-- it an authenticated client could update those newer columns directly via
-- the otherwise legitimate own-profile update policy.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    new.role := old.role;
    new.disabled := old.disabled;
    new.auth_user_id := old.auth_user_id;
    new.email := old.email;
    new.is_verified := old.is_verified;
    new.created_date := old.created_date;
    new.casino_xp := old.casino_xp;
    new.casino_chips := old.casino_chips;
    new.casino_rank := old.casino_rank;
    new.casino_streak := old.casino_streak;
    new.casino_last_active_date := old.casino_last_active_date;
    new.casino_total_posts := old.casino_total_posts;
    new.casino_total_replies := old.casino_total_replies;
    new.casino_total_reactions_given := old.casino_total_reactions_given;
    new.casino_total_reactions_received := old.casino_total_reactions_received;
    new.badges := old.badges;
    new.slot_last_spin_date := old.slot_last_spin_date;
    new.slot_total_spins := old.slot_total_spins;
    new.slot_streak := old.slot_streak;
    new.slot_extra_date := old.slot_extra_date;
    new.slot_extra_count := old.slot_extra_count;
    new.daily_bonus_date := old.daily_bonus_date;
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_profile_columns() from anon, authenticated, public;

with ranked as (
  select id,
    row_number() over (
      partition by user_id, achievement_id
      order by unlocked_at nulls last, created_date, id
    ) as duplicate_number
  from public.achievement_unlocks
)
delete from public.achievement_unlocks unlock_row
using ranked
where unlock_row.id = ranked.id and ranked.duplicate_number > 1;

create unique index if not exists achievement_unlocks_user_achievement_uidx
  on public.achievement_unlocks (user_id, achievement_id);

create or replace function public.claim_achievement_unlocks(
  p_user_id text,
  p_user_email text,
  p_achievements jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_ids text[] := '{}'::text[];
  v_awarded_chips numeric := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null or btrim(p_user_id) = '' then
    raise exception 'user id is required' using errcode = '22023';
  end if;

  with requested as (
    select distinct on (achievement_id)
      btrim(achievement_id) as achievement_id,
      nullif(btrim(category), '') as category,
      nullif(btrim(tier), '') as tier,
      greatest(coalesce(reward_chips, 0), 0) as reward_chips
    from jsonb_to_recordset(coalesce(p_achievements, '[]'::jsonb))
      as item(achievement_id text, category text, tier text, reward_chips numeric)
    where nullif(btrim(achievement_id), '') is not null
    order by achievement_id
  ),
  inserted as (
    insert into public.achievement_unlocks (
      user_id, user_email, achievement_id, category, tier, reward_chips, unlocked_at
    )
    select
      p_user_id,
      nullif(btrim(coalesce(p_user_email, '')), ''),
      requested.achievement_id,
      requested.category,
      requested.tier,
      requested.reward_chips,
      now()
    from requested
    on conflict (user_id, achievement_id) do nothing
    returning achievement_id, reward_chips
  )
  select
    coalesce(array_agg(achievement_id order by achievement_id), '{}'::text[]),
    coalesce(sum(reward_chips), 0)
  into v_new_ids, v_awarded_chips
  from inserted;

  if v_awarded_chips > 0 then
    update public.profiles
    set casino_chips = coalesce(casino_chips, 0) + v_awarded_chips
    where id = p_user_id;
  end if;

  return jsonb_build_object(
    'newlyUnlocked', to_jsonb(v_new_ids),
    'awardedChips', v_awarded_chips
  );
end;
$$;

revoke all on function public.claim_achievement_unlocks(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_achievement_unlocks(text, text, jsonb) to service_role;

with ranked as (
  select id,
    row_number() over (
      partition by user_id, kind, post_id
      order by created_date, id
    ) as duplicate_number
  from public.forum_reward_events
  where kind in ('reaction_given', 'reaction_received')
    and nullif(post_id, '') is not null
)
delete from public.forum_reward_events reward_row
using ranked
where reward_row.id = ranked.id and ranked.duplicate_number > 1;

create unique index if not exists forum_reward_events_reaction_once_uidx
  on public.forum_reward_events (user_id, kind, post_id)
  where kind in ('reaction_given', 'reaction_received')
    and nullif(post_id, '') is not null;

create or replace function public.claim_forum_reaction_reward(
  p_user_id text,
  p_user_email text,
  p_kind text,
  p_xp numeric,
  p_chips numeric,
  p_post_id text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id text;
  v_today text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
  v_yesterday text := to_char((now() at time zone 'UTC') - interval '1 day', 'YYYY-MM-DD');
  v_last_active text;
  v_streak numeric;
  v_streak_bonus numeric;
  v_next_xp numeric;
  v_next_chips numeric;
  v_rank text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_kind not in ('reaction_given', 'reaction_received')
    or nullif(btrim(coalesce(p_user_id, '')), '') is null
    or nullif(btrim(coalesce(p_post_id, '')), '') is null then
    raise exception 'invalid reaction reward claim' using errcode = '22023';
  end if;

  select
    casino_last_active_date,
    case
      when casino_last_active_date = v_today then coalesce(casino_streak, 0)
      when casino_last_active_date = v_yesterday then coalesce(casino_streak, 0) + 1
      else 1
    end,
    coalesce(casino_xp, 0),
    coalesce(casino_chips, 0)
  into v_last_active, v_streak, v_next_xp, v_next_chips
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('claimed', false);
  end if;

  insert into public.forum_reward_events (
    user_id, user_email, kind, xp, chips, post_id, note
  )
  values (
    p_user_id,
    nullif(btrim(coalesce(p_user_email, '')), ''),
    p_kind,
    0,
    0,
    p_post_id,
    left(coalesce(p_note, ''), 240)
  )
  on conflict do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('claimed', false);
  end if;

  v_streak_bonus := case when v_last_active = v_today then 0 else least(50, v_streak * 5) end;
  v_next_xp := v_next_xp + greatest(coalesce(p_xp, 0), 0) + v_streak_bonus;
  v_next_chips := v_next_chips + greatest(coalesce(p_chips, 0), 0) + v_streak_bonus;
  v_rank := case
    when v_next_xp >= 2500 then 'Vegas Royalty'
    when v_next_xp >= 1500 then 'Whale'
    when v_next_xp >= 900 then 'High Roller'
    when v_next_xp >= 450 then 'Pit Boss'
    when v_next_xp >= 180 then 'Table Regular'
    when v_next_xp >= 60 then 'Lucky Local'
    else 'Rookie Punter'
  end;

  update public.profiles
  set
    casino_xp = v_next_xp,
    casino_chips = v_next_chips,
    casino_rank = v_rank,
    casino_streak = v_streak,
    casino_last_active_date = v_today,
    casino_total_reactions_given = coalesce(casino_total_reactions_given, 0)
      + case when p_kind = 'reaction_given' then 1 else 0 end,
    casino_total_reactions_received = coalesce(casino_total_reactions_received, 0)
      + case when p_kind = 'reaction_received' then 1 else 0 end
  where id = p_user_id;

  update public.forum_reward_events
  set
    xp = greatest(coalesce(p_xp, 0), 0) + v_streak_bonus,
    chips = greatest(coalesce(p_chips, 0), 0) + v_streak_bonus,
    rank_after = v_rank,
    note = left(
      coalesce(p_note, '')
        || case when v_streak_bonus > 0 then ' · ' || v_streak || ' day streak bonus' else '' end,
      240
    )
  where id = v_event_id;

  return jsonb_build_object(
    'claimed', true,
    'xp', greatest(coalesce(p_xp, 0), 0) + v_streak_bonus,
    'chips', greatest(coalesce(p_chips, 0), 0) + v_streak_bonus,
    'rank', v_rank,
    'streak', v_streak
  );
end;
$$;

revoke all on function public.claim_forum_reaction_reward(text, text, text, numeric, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_forum_reaction_reward(text, text, text, numeric, numeric, text, text)
  to service_role;
