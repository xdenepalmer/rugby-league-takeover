-- 0012: close the empty-identity RLS hole (RLT-SEC-001).
--
-- THE BUG
-- Every owner-scoped read policy compared the row's owner against
-- `coalesce(public.current_profile_email(), '')` (or the id equivalent).
-- For an ANONYMOUS caller those helpers return NULL, so the coalesce collapsed
-- the comparison to `owner_column = ''` — which is TRUE for any row whose owner
-- column is an empty string. Empty strings are not hypothetical: createCheckout
-- writes `user_email: user?.email || ''`, so EVERY GUEST CHECKOUT produced a
-- world-readable order row.
--
-- Confirmed against the live project with the publishable anon key (the key that
-- ships in the website bundle, i.e. the public boundary): a guest order was
-- readable by an unauthenticated caller, exposing the customer's name, shipping
-- address, phone and order contents.
--
-- THE FIX
-- `nullif(identity, '')` makes an absent/blank identity NULL, and `column = NULL`
-- evaluates to NULL — never TRUE — so the row is excluded. A real profile email or
-- id is never blank, so no legitimate match is affected: a signed-in customer still
-- sees their own orders, and admins are unaffected. Each policy also asserts the
-- row's own owner column is non-blank, so an unowned row can never match anyone.
--
-- Idempotent: every statement drops-if-exists before create, so this is safe to
-- re-run and safe to apply ahead of the 0005 policies it supersedes.

-- 1. store_orders — customer PII: name, address, phone, items, amounts.
drop policy if exists "orders_read" on public.store_orders;
create policy "orders_read" on public.store_orders for select
  using (
    (select public.is_admin())
    or (
      user_email is not null
      and user_email <> ''
      and lower(user_email) = lower(nullif((select public.current_profile_email()), ''))
    )
  );

-- 2. interest_registrations — same shape, same leak.
drop policy if exists "registrations_read" on public.interest_registrations;
create policy "registrations_read" on public.interest_registrations for select
  using (
    (select public.is_admin())
    or (
      user_email is not null
      and user_email <> ''
      and lower(user_email) = lower(nullif((select public.current_profile_email()), ''))
    )
  );

-- 3. notifications — recipient-scoped by id OR email; both arms were vulnerable.
drop policy if exists "notifications_read" on public.notifications;
create policy "notifications_read" on public.notifications for select
  using (
    (select public.is_admin())
    or (
      recipient_id is not null
      and recipient_id <> ''
      and recipient_id = nullif((select public.current_profile_id()), '')
    )
    or (
      recipient_email is not null
      and recipient_email <> ''
      and lower(recipient_email) = lower(nullif((select public.current_profile_email()), ''))
    )
  );

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications for update
  using (
    (select public.is_admin())
    or (recipient_id is not null and recipient_id <> '' and recipient_id = nullif((select public.current_profile_id()), ''))
  )
  with check (
    (select public.is_admin())
    or (recipient_id is not null and recipient_id <> '' and recipient_id = nullif((select public.current_profile_id()), ''))
  );

drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_delete" on public.notifications for delete
  using (
    (select public.is_admin())
    or (recipient_id is not null and recipient_id <> '' and recipient_id = nullif((select public.current_profile_id()), ''))
  );

-- 4. Owner-scoped reward/achievement rows — id arm of the same bug.
drop policy if exists "reward_events_read" on public.forum_reward_events;
create policy "reward_events_read" on public.forum_reward_events for select
  using (
    (select public.is_admin())
    or (user_id is not null and user_id <> '' and user_id = nullif((select public.current_profile_id()), ''))
  );

drop policy if exists "achievements_read" on public.achievement_unlocks;
create policy "achievements_read" on public.achievement_unlocks for select
  using (
    (select public.is_admin())
    or (user_id is not null and user_id <> '' and user_id = nullif((select public.current_profile_id()), ''))
  );

-- 5. forum_posts_view — the author-visibility arm leaked UNPUBLISHED posts (held
-- for moderation, or soft-deleted) whose user_email was blank. Recreated with the
-- same column list and security_barrier; only the final predicate changes.
create or replace view public.forum_posts_view
with (security_barrier = true)
as
select
  id, author_name, author_avatar, title, body, category, parent_id,
  is_published, is_pinned,
  user_email,
  user_id,
  case when (select public.is_admin()) then ip_address else null end as ip_address,
  media_url, media_type, like_count, liked_by, reactions, view_count,
  deleted_at, deleted_by, moderation_reason, reported_count,
  case when (select public.is_admin()) then reported_by else '[]'::jsonb end as reported_by,
  created_date, updated_date
from public.forum_posts
where
  is_published
  or (select public.is_admin())
  or (
    user_email is not null
    and user_email <> ''
    and lower(user_email) = lower(nullif((select public.current_profile_email()), ''))
  );
