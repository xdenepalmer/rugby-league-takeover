-- Jersey Swap board.
--
-- Fans already swap jerseys through forum posts (the organic "JERSEY SWAP"
-- thread that prompted this). The board adds structure on top of the forum
-- rather than replacing it: a listing is searchable have/want metadata plus a
-- linked forum thread where the negotiation actually happens — reusing
-- moderation, media and replies instead of growing a DM system.
--
-- Money is deliberately absent. Swap-only keeps the platform a matchmaker,
-- not a marketplace with dispute obligations. Addresses are never stored or
-- relayed; fans exchange them in the thread like they already do.

-- ---------------------------------------------------------------------------
-- 1. Listings. Writes go through the swapBoard edge function only (RLS is
--    enabled with no write policies); everyone reads via the sanitised view.
--    display_name is captured at creation, tipper_name-style, so the public
--    card never needs to join into profiles for identity.
-- ---------------------------------------------------------------------------
create table if not exists public.swap_listings (
  id                text primary key default gen_random_uuid()::text,
  user_id           text not null,
  user_email        text,
  display_name      text not null default 'RLT Fan',
  have_team         text not null,
  have_size         text not null default '',
  have_condition    text not null default '',
  have_description  text not null default '',
  image_url         text not null default '',
  want_teams        jsonb not null default '[]'::jsonb,
  want_sizes        jsonb not null default '[]'::jsonb,
  thread_id         text,
  status            text not null default 'active',
  completed_with    text,
  completed_at      timestamptz,
  created_date      timestamptz not null default now(),
  updated_date      timestamptz not null default now(),
  constraint swap_listings_status_check check (status in ('active', 'completed', 'withdrawn'))
);

create index if not exists swap_listings_status_created_idx
  on public.swap_listings (status, created_date desc);
create index if not exists swap_listings_user_idx
  on public.swap_listings (user_id);

alter table public.swap_listings enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Completion is TWO-sided. A swap only counts when both owners have named
--    each other's listing; one side alone proves nothing (and a solo "confirm"
--    would let anyone farm the reward). The unique key makes re-confirming
--    idempotent rather than double-counting.
-- ---------------------------------------------------------------------------
create table if not exists public.swap_confirmations (
  id                       text primary key default gen_random_uuid()::text,
  listing_id               text not null,
  counterpart_listing_id   text not null,
  user_id                  text not null,
  created_date             timestamptz not null default now(),
  constraint swap_confirmations_pair_uidx unique (listing_id, counterpart_listing_id)
);

alter table public.swap_confirmations enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Reputation: a public tally of completed swaps. Server-owned — it IS the
--    trust signal, so a member must not be able to write their own.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists swap_count numeric not null default 0;

-- Re-declare the column guard with swap_count included (current body is the
-- 0031 revision; this supersedes it).
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    -- The identity itself. Nothing below matters if this is writable.
    new.id := old.id;
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
    new.membership_started_at := old.membership_started_at;
    new.membership_expires_at := old.membership_expires_at;
    new.membership_number := old.membership_number;
    new.membership_source := old.membership_source;
    new.swap_count := old.swap_count;
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_profile_columns() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 4. Completed swaps pay chips/XP like every other community action.
--    Constraint re-declared with the new kind (0014 pattern).
-- ---------------------------------------------------------------------------
alter table public.forum_reward_events drop constraint if exists forum_reward_events_kind_check;
alter table public.forum_reward_events add constraint forum_reward_events_kind_check
  check (kind in ('thread', 'reply', 'reaction_given', 'reaction_received', 'streak_bonus', 'slot_win', 'tip_win', 'daily_bonus', 'swap_complete'));

-- ---------------------------------------------------------------------------
-- 5. The public read surface. Same sanitisation as tipping_entries_view:
--    user_id only for the owner or an admin, email admin-only, plus an is_me
--    flag so the client can mark its own cards without ever seeing other ids.
--    swap_count rides along from profiles as the trust signal on each card.
-- ---------------------------------------------------------------------------
create or replace view public.swap_listings_view
with (security_barrier = true)
as
select
  l.id,
  l.display_name,
  l.have_team, l.have_size, l.have_condition, l.have_description,
  l.image_url,
  l.want_teams, l.want_sizes,
  l.thread_id,
  l.status,
  l.completed_at,
  l.created_date,
  case when (select public.is_admin()) or l.user_id = coalesce((select public.current_profile_id()), '') then l.user_id else null end as user_id,
  case when (select public.is_admin()) then l.user_email else null end as user_email,
  l.user_id = coalesce((select public.current_profile_id()), '') as is_me,
  md5(l.user_id) as swapper_key,
  coalesce(p.swap_count, 0) as swap_count
from public.swap_listings l
left join public.profiles p on p.id = l.user_id;

grant select on public.swap_listings_view to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Atomic finalisation (apply_slot_spin precedent). Both listings flip to
--    completed, both owners are paid, counted and badged in ONE transaction
--    under row locks — so two racing finalisations (or a finalise racing a
--    withdraw) cannot half-complete a swap or pay anyone twice. Rows are
--    locked in id order to make deadlock impossible.
--
--    SECURITY: definer, and NOT granted to anon/authenticated — only the
--    swapBoard edge function's service-role client may call it, after it has
--    verified both sides really confirmed. Direct /rest/v1/rpc access would
--    otherwise let anyone complete strangers' swaps and mint chips.
-- ---------------------------------------------------------------------------
create or replace function public.finalize_swap(p_a text, p_b text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.swap_listings;
  b public.swap_listings;
  first_id text; second_id text;
  owner_row public.profiles;
begin
  if p_a = p_b then
    return jsonb_build_object('ok', false, 'reason', 'same_listing');
  end if;
  first_id := least(p_a, p_b);
  second_id := greatest(p_a, p_b);

  select * into a from public.swap_listings where id = first_id for update;
  select * into b from public.swap_listings where id = second_id for update;
  if a.id is null or b.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if a.status <> 'active' or b.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'not_active');
  end if;
  if a.user_id = b.user_id then
    return jsonb_build_object('ok', false, 'reason', 'self_swap');
  end if;

  update public.swap_listings set
    status = 'completed',
    completed_with = case when id = a.id then b.id else a.id end,
    completed_at = now(),
    updated_date = now()
  where id in (a.id, b.id);

  -- Pay, count and badge both owners. 150 chips / 50 XP sits between a forum
  -- thread (60) and a tip win — a swap is the highest-effort community act.
  for owner_row in
    select * from public.profiles where id in (a.user_id, b.user_id) for update
  loop
    update public.profiles set
      casino_chips = coalesce(casino_chips, 0) + 150,
      casino_xp = coalesce(casino_xp, 0) + 50,
      swap_count = coalesce(swap_count, 0) + 1,
      badges = case
        when coalesce(badges, '[]'::jsonb) ? 'jersey_swapper' then badges
        else coalesce(badges, '[]'::jsonb) || to_jsonb('jersey_swapper'::text)
      end,
      updated_date = now()
    where id = owner_row.id;

    insert into public.forum_reward_events (user_id, user_email, kind, xp, chips, rank_after, post_id, note)
    values (
      owner_row.id,
      owner_row.email,
      'swap_complete',
      50,
      150,
      coalesce(owner_row.casino_rank, 'Rookie Punter'),
      '',
      'Jersey swap completed'
    );
  end loop;

  return jsonb_build_object('ok', true, 'a', a.id, 'b', b.id);
end;
$$;

revoke all on function public.finalize_swap(text, text) from public;
revoke all on function public.finalize_swap(text, text) from anon;
revoke all on function public.finalize_swap(text, text) from authenticated;
