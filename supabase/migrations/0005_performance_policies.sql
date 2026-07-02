-- Performance pass (advisor-driven, applied to the project as
-- "performance_policies"):
--  * Wrap auth.uid()/helper calls in scalar subqueries so they evaluate once
--    per statement instead of once per row (auth_rls_initplan).
--  * Split every admin FOR ALL policy into insert/update/delete so tables no
--    longer have two permissive SELECT policies per role
--    (multiple_permissive_policies). Sensitive tables whose FOR ALL policy was
--    their only policy get an explicit admin SELECT policy instead.

-- 1. profiles
drop policy "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select using (auth_user_id = (select auth.uid()) or (select public.is_admin()));
drop policy "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth_user_id = (select auth.uid()) or (select public.is_admin()))
  with check (auth_user_id = (select auth.uid()) or (select public.is_admin()));

-- 2. Split all FOR ALL admin policies
do $$
declare p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and cmd = 'ALL'
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    execute format('create policy %I on public.%I for insert with check ((select public.is_admin()))', p.tablename || '_admin_insert', p.tablename);
    execute format('create policy %I on public.%I for update using ((select public.is_admin())) with check ((select public.is_admin()))', p.tablename || '_admin_update', p.tablename);
    execute format('create policy %I on public.%I for delete using ((select public.is_admin()))', p.tablename || '_admin_delete', p.tablename);
    if p.tablename in ('forum_posts', 'testimonials', 'tipping_entries', 'bans', 'product_release_subscriptions') then
      execute format('create policy %I on public.%I for select using ((select public.is_admin()))', p.tablename || '_admin_select', p.tablename);
    end if;
  end loop;
end $$;

-- 3. Rewrite function-based read policies with initplan wrappers
drop policy "events_read" on public.event_contents;
create policy "events_read" on public.event_contents for select
  using (is_published or (select public.is_admin()));

drop policy "matchups_read" on public.matchups;
create policy "matchups_read" on public.matchups for select
  using (is_published or (select public.is_admin()));

drop policy "orders_read" on public.store_orders;
create policy "orders_read" on public.store_orders for select
  using ((select public.is_admin()) or (user_email is not null and lower(user_email) = lower(coalesce((select public.current_profile_email()), ''))));

drop policy "registrations_read" on public.interest_registrations;
create policy "registrations_read" on public.interest_registrations for select
  using ((select public.is_admin()) or (user_email is not null and lower(user_email) = lower(coalesce((select public.current_profile_email()), ''))));

drop policy "reward_events_read" on public.forum_reward_events;
create policy "reward_events_read" on public.forum_reward_events for select
  using ((select public.is_admin()) or user_id = coalesce((select public.current_profile_id()), ''));

drop policy "achievements_read" on public.achievement_unlocks;
create policy "achievements_read" on public.achievement_unlocks for select
  using ((select public.is_admin()) or user_id = coalesce((select public.current_profile_id()), ''));

drop policy "notifications_read" on public.notifications;
create policy "notifications_read" on public.notifications for select
  using (
    (select public.is_admin())
    or recipient_id = coalesce((select public.current_profile_id()), '')
    or (recipient_email is not null and lower(recipient_email) = lower(coalesce((select public.current_profile_email()), '')))
  );
drop policy "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications for update
  using ((select public.is_admin()) or recipient_id = coalesce((select public.current_profile_id()), ''))
  with check ((select public.is_admin()) or recipient_id = coalesce((select public.current_profile_id()), ''));
drop policy "notifications_delete" on public.notifications;
create policy "notifications_delete" on public.notifications for delete
  using ((select public.is_admin()) or recipient_id = coalesce((select public.current_profile_id()), ''));
drop policy "notifications_admin_insert" on public.notifications;
create policy "notifications_admin_insert" on public.notifications for insert
  with check ((select public.is_admin()));

-- 4. Views: evaluate is_admin()/profile lookups once per statement
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
  or (user_email is not null and lower(user_email) = lower(coalesce((select public.current_profile_email()), '')));

create or replace view public.testimonials_view
with (security_barrier = true)
as
select
  id, author_name, author_role, quote, avatar_url, rating, sort_order, is_published,
  case when (select public.is_admin()) then ip_address else null end as ip_address,
  case when (select public.is_admin()) then user_email else null end as user_email,
  case when (select public.is_admin()) then user_id else null end as user_id,
  created_date, updated_date
from public.testimonials
where is_published or (select public.is_admin());

create or replace view public.tipping_entries_view
with (security_barrier = true)
as
select
  id, game_id, game_label, home_team, away_team, selected_team,
  predicted_home_score, predicted_away_score, margin, confidence, tipper_name,
  case when (select public.is_admin()) or user_id = coalesce((select public.current_profile_id()), '') then user_id else null end as user_id,
  case when (select public.is_admin()) then user_email else null end as user_email,
  kickoff, created_date, updated_date
from public.tipping_entries;

-- 5. Storage policies
drop policy "media_admin_read" on storage.objects;
create policy "media_admin_read" on storage.objects for select
  using (bucket_id = 'media' and (select public.is_admin()));
drop policy "media_auth_upload" on storage.objects;
create policy "media_auth_upload" on storage.objects for insert
  with check (bucket_id = 'media' and (select auth.role()) = 'authenticated');
drop policy "media_admin_manage" on storage.objects;
create policy "media_admin_manage" on storage.objects for update
  using (bucket_id = 'media' and (select public.is_admin()));
drop policy "media_admin_delete" on storage.objects;
create policy "media_admin_delete" on storage.objects for delete
  using (bucket_id = 'media' and (select public.is_admin()));
