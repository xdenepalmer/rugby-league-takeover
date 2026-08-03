-- ---------------------------------------------------------------------------
-- 0031 — Pre-launch hardening. Four issues, each verified against the LIVE
-- database rather than inferred from the migration history.
-- ---------------------------------------------------------------------------

-- 1. user_push_tokens: anonymous callers could write to the table.
--
-- Every owner-keyed policy in this schema was hardened to
-- `col <> '' and col = nullif(current_profile_id(), '')`, because
-- current_profile_id() is NULL for a signed-out caller and coalesce(NULL,'')
-- then matches every blank-owner row. That fix (documented at
-- 0027_forum_abuse_hardening.sql:160) reached the other five tables but not
-- this one — its four policies still used the coalesce form.
--
-- Verified live before the fix: an anonymous POST to /rest/v1/user_push_tokens
-- with {"user_id":""} returned HTTP 201. The probe row was deleted.
drop policy if exists "push_tokens_select_own" on public.user_push_tokens;
drop policy if exists "push_tokens_insert_own" on public.user_push_tokens;
drop policy if exists "push_tokens_update_own" on public.user_push_tokens;
drop policy if exists "push_tokens_delete_own" on public.user_push_tokens;

create policy "push_tokens_select_own" on public.user_push_tokens for select
  using (
    (select public.is_admin())
    or (user_id is not null and user_id <> ''
        and user_id = nullif((select public.current_profile_id()), ''))
  );

create policy "push_tokens_insert_own" on public.user_push_tokens for insert
  with check (
    user_id is not null and user_id <> ''
    and user_id = nullif((select public.current_profile_id()), '')
  );

create policy "push_tokens_update_own" on public.user_push_tokens for update
  using (
    (select public.is_admin())
    or (user_id is not null and user_id <> ''
        and user_id = nullif((select public.current_profile_id()), ''))
  )
  with check (
    (select public.is_admin())
    or (user_id is not null and user_id <> ''
        and user_id = nullif((select public.current_profile_id()), ''))
  );

create policy "push_tokens_delete_own" on public.user_push_tokens for delete
  using (
    (select public.is_admin())
    or (user_id is not null and user_id <> ''
        and user_id = nullif((select public.current_profile_id()), ''))
  );

-- ---------------------------------------------------------------------------
-- 2. profiles.id is the ownership key for the whole schema — every
--    tipping_entries.user_id, forum_posts.user_id, store_orders.user_id and
--    membership row is keyed to it — yet protect_profile_columns reverted 26
--    columns and not this one. profiles_update_self's WITH CHECK constrains
--    only auth_user_id, so a signed-in member could rewrite their own id,
--    detaching their entire history and adopting any orphaned rows that
--    happen to carry the value they choose.
-- ---------------------------------------------------------------------------
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
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_profile_columns() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 3. One tip per person per game was enforced only by a read-then-insert in
--    submitTip — a check-then-act with nothing behind it. Two concurrent
--    requests both read "no existing tip" and both insert, and settleTips
--    pays out per ROW, so a tipster could back both teams on the same game and
--    be guaranteed a winning payout. The database has to hold this invariant,
--    not the function.
--
--    Partial indexes because the identity differs: signed-in tippers are keyed
--    by account, guests by IP (the pre-existing anonymous design).
-- ---------------------------------------------------------------------------
create unique index if not exists tipping_entries_user_game_uidx
  on public.tipping_entries (game_id, user_id)
  where coalesce(user_id, '') <> '';

create unique index if not exists tipping_entries_ip_game_uidx
  on public.tipping_entries (game_id, ip_address)
  where coalesce(user_id, '') = '' and coalesce(ip_address, '') <> '';

-- ---------------------------------------------------------------------------
-- 4. Codify the owner-keyed RLS that production already runs.
--
--    The live policies on interest_registrations, store_orders, notifications,
--    forum_reward_events and achievement_unlocks carry the hardened
--    `<> '' and nullif(...)` form, but NO migration in this repo contains it —
--    the last repo definition (0005_performance_policies.sql) still has the
--    vulnerable coalesce form. Rebuilding this database from the migrations
--    (disaster recovery, a staging project, a fresh environment) would restore
--    the insecure version. These statements are written to match production
--    exactly, so applying them is a no-op against the live database and a
--    correctness fix against any rebuilt one.
-- ---------------------------------------------------------------------------
drop policy if exists "registrations_read" on public.interest_registrations;
create policy "registrations_read" on public.interest_registrations for select
  using (
    (select public.is_admin())
    or (user_email is not null and user_email <> ''
        and lower(user_email) = lower(nullif((select public.current_profile_email()), '')))
  );

drop policy if exists "orders_read" on public.store_orders;
create policy "orders_read" on public.store_orders for select
  using (
    (select public.is_admin())
    or (user_email is not null and user_email <> ''
        and lower(user_email) = lower(nullif((select public.current_profile_email()), '')))
  );

drop policy if exists "reward_events_read" on public.forum_reward_events;
create policy "reward_events_read" on public.forum_reward_events for select
  using (
    (select public.is_admin())
    or (user_id is not null and user_id <> ''
        and user_id = nullif((select public.current_profile_id()), ''))
  );

drop policy if exists "achievements_read" on public.achievement_unlocks;
create policy "achievements_read" on public.achievement_unlocks for select
  using (
    (select public.is_admin())
    or (user_id is not null and user_id <> ''
        and user_id = nullif((select public.current_profile_id()), ''))
  );

drop policy if exists "notifications_read" on public.notifications;
create policy "notifications_read" on public.notifications for select
  using (
    (select public.is_admin())
    or (recipient_id is not null and recipient_id <> ''
        and recipient_id = nullif((select public.current_profile_id()), ''))
    or (recipient_email is not null and recipient_email <> ''
        and lower(recipient_email) = lower(nullif((select public.current_profile_email()), '')))
  );
