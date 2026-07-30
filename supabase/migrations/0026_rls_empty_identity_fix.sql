-- 0026: close the empty-identity RLS hole (RLT-SEC-001), authored against MAIN.
--
-- SUPERSEDES the branch-local 0012_rls_empty_identity_fix.sql, which must NOT be
-- applied: its number collides with main's 0012_vegas_pickup.sql, and its
-- forum_posts_view block was written against the pre-0019 view — applying it
-- would strip 0019's masking and expose every forum member's email address.
--
-- THE BUG
-- Owner-scoped policies compare the row's owner against
-- `coalesce(current_profile_email(), '')` (or the id equivalent). For an
-- ANONYMOUS caller those helpers return NULL, so the comparison collapses to
-- `owner = ''` — TRUE for any row whose owner column is blank. Edge functions
-- write exactly that (`user?.email || ''`), so guest-created rows are owned by
-- "" and therefore readable by everyone.
--
-- Confirmed against the live project with the publishable anon key (the key that
-- ships in the website bundle, i.e. the public boundary): unauthenticated reads
-- returned a real customer order and a real interest registration including
-- name, email, phone and IP address.
--
-- THE FIX
-- `nullif(identity, '')` makes an absent identity NULL, and `column = NULL` is
-- NULL — never TRUE — so the row is excluded. A real profile email or id is
-- never blank, so no legitimate match changes: signed-in customers still see
-- their own orders and admins are unaffected. Each arm additionally asserts the
-- row's own owner column is non-blank, so an unowned row matches nobody.
--
-- Idempotent: every policy is dropped-if-exists first, and the view is CREATE OR
-- REPLACE, so this is safe to re-run.

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

-- 2. interest_registrations — name, email, phone, IP of every travel enquiry.
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

-- 5. forum_posts_view — the author-visibility arm of the WHERE clause leaked
-- UNPUBLISHED posts (content held for moderation) authored with a blank user_id.
--
-- CRITICAL: this is 0019_community_hardening.sql's view reproduced VERBATIM —
-- every masking expression (user_email/ip_address/reported_by admin-only,
-- user_id/liked_by/reactions authenticated-only) is preserved exactly. ONLY the
-- final WHERE predicate changes. Do not "simplify" the select list: those cases
-- are what keep member emails off the public forum.
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
  or (user_id is not null and user_id <> '' and user_id = nullif((select public.current_profile_id()), ''));

grant select on public.forum_posts_view to anon, authenticated;
