-- Rugby League Takeover — RLS policies mirroring base44/entities/*.jsonc rls blocks.
--
-- Posture:
--  * Every table has RLS enabled. The service role (edge functions) bypasses RLS.
--  * Public content (read: true / is_published) is readable by anon + authenticated.
--  * Admin-only writes use public.is_admin().
--  * Tables with field-level secrets in Base44 (ip_address, linked user emails on
--    public rows) are NOT directly readable; sanitised security-definer views
--    mask those columns for non-admins (forum_posts_view, testimonials_view,
--    tipping_entries_view) — the frontend reads exclusively via those views.

-- ---------------------------------------------------------------------------
-- profiles: self read/update, admin read/update. Role/disabled changes are
-- blocked for non-admins (column enforcement via trigger below).
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_self" on public.profiles
  for select using (auth_user_id = auth.uid() or public.is_admin());

create policy "profiles_update_self" on public.profiles
  for update using (auth_user_id = auth.uid() or public.is_admin())
  with check (auth_user_id = auth.uid() or public.is_admin());

-- Guard: non-admins cannot escalate role / flip disabled / reassign linkage.
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
    new.casino_xp := old.casino_xp;
    new.casino_chips := old.casino_chips;
    new.casino_rank := old.casino_rank;
    new.casino_streak := old.casino_streak;
    new.casino_total_posts := old.casino_total_posts;
    new.casino_total_replies := old.casino_total_replies;
    new.casino_total_reactions_given := old.casino_total_reactions_given;
    new.casino_total_reactions_received := old.casino_total_reactions_received;
    new.badges := old.badges;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_columns
  before update on public.profiles
  for each row
  when (pg_trigger_depth() = 0)
  execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- Fully public reads, admin writes.
-- ---------------------------------------------------------------------------
alter table public.teams enable row level security;
create policy "teams_read" on public.teams for select using (true);
create policy "teams_admin_write" on public.teams for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.faqs enable row level security;
create policy "faqs_read" on public.faqs for select using (true);
create policy "faqs_admin_write" on public.faqs for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.partners enable row level security;
create policy "partners_read" on public.partners for select using (true);
create policy "partners_admin_write" on public.partners for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.news_articles enable row level security;
create policy "news_read" on public.news_articles for select using (true);
create policy "news_admin_write" on public.news_articles for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.gallery_items enable row level security;
create policy "gallery_read" on public.gallery_items for select using (true);
create policy "gallery_admin_write" on public.gallery_items for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.travel_packages enable row level security;
create policy "travel_read" on public.travel_packages for select using (true);
create policy "travel_admin_write" on public.travel_packages for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.products enable row level security;
create policy "products_read" on public.products for select using (true);
create policy "products_admin_write" on public.products for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.site_ads enable row level security;
create policy "site_ads_read" on public.site_ads for select using (true);
create policy "site_ads_admin_write" on public.site_ads for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.site_settings enable row level security;
create policy "site_settings_read" on public.site_settings for select using (true);
create policy "site_settings_admin_write" on public.site_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Published-or-admin reads.
-- ---------------------------------------------------------------------------
alter table public.event_contents enable row level security;
create policy "events_read" on public.event_contents for select
  using (is_published or public.is_admin());
create policy "events_admin_write" on public.event_contents for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.matchups enable row level security;
create policy "matchups_read" on public.matchups for select
  using (is_published or public.is_admin());
create policy "matchups_admin_write" on public.matchups for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Own-or-admin reads, admin writes.
-- ---------------------------------------------------------------------------
alter table public.store_orders enable row level security;
create policy "orders_read" on public.store_orders for select
  using (public.is_admin() or (user_email is not null and lower(user_email) = lower(coalesce(public.current_profile_email(), ''))));
create policy "orders_admin_write" on public.store_orders for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.interest_registrations enable row level security;
create policy "registrations_read" on public.interest_registrations for select
  using (public.is_admin() or (user_email is not null and lower(user_email) = lower(coalesce(public.current_profile_email(), ''))));
create policy "registrations_admin_write" on public.interest_registrations for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.forum_reward_events enable row level security;
create policy "reward_events_read" on public.forum_reward_events for select
  using (public.is_admin() or user_id = coalesce(public.current_profile_id(), ''));
create policy "reward_events_admin_write" on public.forum_reward_events for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.achievement_unlocks enable row level security;
create policy "achievements_read" on public.achievement_unlocks for select
  using (public.is_admin() or user_id = coalesce(public.current_profile_id(), ''));
create policy "achievements_admin_write" on public.achievement_unlocks for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Notifications: recipient reads / marks read / deletes own; admin everything.
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;
create policy "notifications_read" on public.notifications for select
  using (
    public.is_admin()
    or recipient_id = coalesce(public.current_profile_id(), '')
    or (recipient_email is not null and lower(recipient_email) = lower(coalesce(public.current_profile_email(), '')))
  );
create policy "notifications_update" on public.notifications for update
  using (public.is_admin() or recipient_id = coalesce(public.current_profile_id(), ''))
  with check (public.is_admin() or recipient_id = coalesce(public.current_profile_id(), ''));
create policy "notifications_delete" on public.notifications for delete
  using (public.is_admin() or recipient_id = coalesce(public.current_profile_id(), ''));
create policy "notifications_admin_insert" on public.notifications for insert
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Bans: admin only.
-- ---------------------------------------------------------------------------
alter table public.bans enable row level security;
create policy "bans_admin_all" on public.bans for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Product release subscriptions: admin only (created via edge function).
-- ---------------------------------------------------------------------------
alter table public.product_release_subscriptions enable row level security;
create policy "prs_admin_all" on public.product_release_subscriptions for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Sensitive tables: no direct anon/user SELECT. Reads flow through sanitised
-- definer views; writes are admin (moderation) or service-role via functions.
-- ---------------------------------------------------------------------------
alter table public.forum_posts enable row level security;
create policy "forum_admin_all" on public.forum_posts for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.testimonials enable row level security;
create policy "testimonials_admin_all" on public.testimonials for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.tipping_entries enable row level security;
create policy "tipping_admin_all" on public.tipping_entries for all
  using (public.is_admin()) with check (public.is_admin());

-- Sanitised views (SECURITY DEFINER by design: they enforce Base44's
-- field-level RLS — ip_address / linked emails are admin-only).
create or replace view public.forum_posts_view
with (security_barrier = true)
as
select
  id, author_name, author_avatar, title, body, category, parent_id,
  is_published, is_pinned,
  user_email,
  user_id,
  case when public.is_admin() then ip_address else null end as ip_address,
  media_url, media_type, like_count, liked_by, reactions, view_count,
  deleted_at, deleted_by, moderation_reason, reported_count,
  case when public.is_admin() then reported_by else '[]'::jsonb end as reported_by,
  created_date, updated_date
from public.forum_posts
where
  is_published
  or public.is_admin()
  or (user_email is not null and lower(user_email) = lower(coalesce(public.current_profile_email(), '')));

create or replace view public.testimonials_view
with (security_barrier = true)
as
select
  id, author_name, author_role, quote, avatar_url, rating, sort_order, is_published,
  case when public.is_admin() then ip_address else null end as ip_address,
  case when public.is_admin() then user_email else null end as user_email,
  case when public.is_admin() then user_id else null end as user_id,
  created_date, updated_date
from public.testimonials
where is_published or public.is_admin();

create or replace view public.tipping_entries_view
with (security_barrier = true)
as
select
  id, game_id, game_label, home_team, away_team, selected_team,
  predicted_home_score, predicted_away_score, margin, confidence, tipper_name,
  case when public.is_admin() or user_id = coalesce(public.current_profile_id(), '') then user_id else null end as user_id,
  case when public.is_admin() then user_email else null end as user_email,
  kickoff, created_date, updated_date
from public.tipping_entries;

grant select on public.forum_posts_view to anon, authenticated;
grant select on public.testimonials_view to anon, authenticated;
grant select on public.tipping_entries_view to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: public media bucket (site images, forum uploads, avatars).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media_public_read" on storage.objects for select
  using (bucket_id = 'media');
create policy "media_auth_upload" on storage.objects for insert
  with check (bucket_id = 'media' and auth.role() = 'authenticated');
create policy "media_admin_manage" on storage.objects for update
  using (bucket_id = 'media' and public.is_admin());
create policy "media_admin_delete" on storage.objects for delete
  using (bucket_id = 'media' and public.is_admin());
