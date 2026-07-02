-- Rugby League Takeover — Supabase core schema
-- Migrated 1:1 from base44/entities/*.jsonc. Text primary keys preserve the
-- original Base44 record ids so every cross-reference (forum replies, likes,
-- notifications, reward events) survives the migration unchanged.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles — the app-level user record (Base44 "User" entity).
-- auth.users provides authentication; profiles carries roles + fan data.
-- Linking is by auth_user_id, auto-claimed by email on first sign-in.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id text primary key default gen_random_uuid()::text,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  email text unique,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'moderator', 'user')),
  disabled boolean not null default false,
  is_verified boolean not null default false,
  phone text,
  postcode text,
  city text,
  country text,
  bio text,
  favourite_team text,
  avatar_url text,
  badges jsonb not null default '[]'::jsonb,
  casino_xp numeric not null default 0,
  casino_chips numeric not null default 0,
  casino_rank text not null default 'Rookie Punter',
  casino_streak numeric not null default 0,
  casino_last_active_date text,
  casino_total_posts numeric not null default 0,
  casino_total_replies numeric not null default 0,
  casino_total_reactions_given numeric not null default 0,
  casino_total_reactions_received numeric not null default 0,
  marketing_opt_in boolean not null default false,
  show_location_on_forum boolean not null default false,
  show_team_on_forum boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index profiles_email_idx on public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- Role helpers (security definer so RLS policies can consult profiles).
-- ---------------------------------------------------------------------------
create or replace function public.current_profile_id()
returns text
language sql stable security definer set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.current_profile_email()
returns text
language sql stable security definer set search_path = public
as $$
  select email from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role = 'admin' and not disabled from public.profiles where auth_user_id = auth.uid() limit 1),
    false
  );
$$;

create or replace function public.is_moderator()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'moderator') and not disabled from public.profiles where auth_user_id = auth.uid() limit 1),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- updated_date maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auto-link: when an auth user is created (email/password signup or Google
-- OAuth), claim the matching pre-existing profile by email, otherwise create
-- a fresh profile row.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  existing_id text;
begin
  select id into existing_id
  from public.profiles
  where lower(email) = lower(new.email) and auth_user_id is null
  limit 1;

  if existing_id is not null then
    update public.profiles
    set auth_user_id = new.id,
        is_verified = true,
        full_name = coalesce(nullif(full_name, ''), new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
        avatar_url = coalesce(nullif(avatar_url, ''), new.raw_user_meta_data ->> 'avatar_url')
    where id = existing_id;
  else
    insert into public.profiles (auth_user_id, email, full_name, avatar_url, is_verified)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
      coalesce(new.raw_user_meta_data ->> 'avatar_url', ''),
      new.email_confirmed_at is not null
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Content tables (Base44 entity → snake_case table).
-- Shared audit columns mirror Base44 built-ins.
-- ---------------------------------------------------------------------------

create table public.teams (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  short_name text,
  logo_url text,
  sort_order numeric not null default 1,
  is_active boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create table public.faqs (
  id text primary key default gen_random_uuid()::text,
  question text not null,
  answer text,
  category text not null default 'store',
  sort_order numeric not null default 1,
  is_published boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create table public.partners (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  logo_url text,
  url text,
  description text,
  sort_order numeric not null default 1,
  is_published boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create table public.news_articles (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  body text,
  image_url text,
  published_date date,
  author text,
  is_published boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create table public.event_contents (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  start_time text,
  address text,
  tickets jsonb not null default '[]'::jsonb,
  blurb text,
  photo_urls jsonb not null default '[]'::jsonb,
  event_date timestamptz,
  location text,
  ticket_url text,
  is_published boolean not null default true,
  sort_order numeric not null default 1,
  is_coming_soon boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create table public.travel_packages (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text,
  image_url text,
  is_coming_soon boolean not null default true,
  booking_url text,
  booking_label text default 'Book Now',
  sort_order numeric not null default 1,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create table public.gallery_items (
  id text primary key default gen_random_uuid()::text,
  title text,
  media_type text not null default 'photo' check (media_type in ('photo', 'video', 'youtube', 'facebook')),
  media_url text,
  embed_url text,
  thumbnail_url text,
  event_label text,
  sort_order numeric not null default 1,
  is_published boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create table public.matchups (
  id text primary key default gen_random_uuid()::text,
  home_team text not null,
  home_logo text,
  away_team text not null,
  away_logo text,
  kickoff timestamptz,
  label text,
  venue text,
  ticket_url text,
  sort_order numeric not null default 1,
  is_published boolean not null default true,
  status text not null default 'scheduled' check (status in ('scheduled', 'final')),
  home_score numeric,
  away_score numeric,
  result_note text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create table public.products (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text,
  image_url text,
  image_url_2 text,
  details text,
  category text not null default 'Merch',
  price_aud numeric not null,
  stock_quantity numeric not null default 0,
  sizes jsonb not null default '[]'::jsonb,
  coming_soon boolean not null default false,
  release_date timestamptz,
  is_active boolean not null default true,
  sort_order numeric not null default 1,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create table public.product_release_subscriptions (
  id text primary key default gen_random_uuid()::text,
  product_id text not null,
  product_name text,
  email text not null,
  name text,
  user_id text,
  user_email text,
  is_active boolean not null default true,
  notified_at timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create table public.store_orders (
  id text primary key default gen_random_uuid()::text,
  customer_name text,
  customer_email text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'packing', 'shipped', 'completed', 'cancelled', 'refunded')),
  total_aud numeric not null,
  line_items jsonb not null default '[]'::jsonb,
  stripe_session_id text,
  stripe_payment_status text,
  payment_verified_at timestamptz,
  shipping_notes text,
  user_email text,
  user_id text,
  tracking_number text,
  tracking_url text,
  carrier text,
  shipping_method text not null default 'standard' check (shipping_method in ('standard', 'express', 'priority')),
  shipping_address text,
  estimated_delivery date,
  shipped_at timestamptz,
  delivered_at timestamptz,
  customer_status_note text,
  refund_amount numeric,
  refund_reason text,
  refunded_at timestamptz,
  timeline jsonb not null default '[]'::jsonb,
  stock_oversold boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create table public.site_ads (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  image_url text not null,
  target_url text,
  position text not null default 'banner-top' check (position in ('banner-top', 'banner-bottom', 'sidebar', 'in-feed', 'footer')),
  size text not null default 'leaderboard' check (size in ('leaderboard', 'medium-rectangle', 'wide-skyscraper', 'mobile-banner')),
  is_active boolean not null default true,
  start_date date,
  end_date date,
  sponsor_id text,
  price_per_month numeric not null default 0,
  cpm_rate numeric not null default 0,
  device_target text not null default 'all' check (device_target in ('all', 'desktop', 'mobile')),
  ab_variants jsonb not null default '[]'::jsonb,
  impression_count numeric not null default 0,
  click_count numeric not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create table public.site_settings (
  id text primary key default gen_random_uuid()::text,
  site_logo_url text,
  hero_eyebrow text,
  hero_eyebrow_visible boolean not null default true,
  hero_title text,
  hero_description text,
  hero_button_label text,
  background_video_urls jsonb not null default '[]'::jsonb,
  contact_email text,
  social_facebook_url text,
  social_instagram_url text,
  social_tiktok_url text,
  facebook_fans text,
  legal_terms text,
  legal_privacy text,
  news_eyebrow text,
  news_title text,
  news_description text,
  about_eyebrow text,
  about_title text,
  about_description text,
  about_body text,
  about_highlight text,
  about_image_url text,
  about_image_caption text,
  travel_eyebrow text,
  travel_title text,
  travel_description text,
  registration_eyebrow text,
  registration_title text,
  registration_description text,
  merch_eyebrow text,
  merch_title text,
  merch_description text,
  footer_text text,
  footer_powered_by text,
  countdown_enabled boolean not null default true,
  countdown_title text,
  countdown_subtitle text,
  countdown_date timestamptz,
  countdown_cta_label text,
  countdown_cta_url text,
  ads_enabled boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create table public.testimonials (
  id text primary key default gen_random_uuid()::text,
  author_name text not null,
  author_role text,
  quote text not null,
  avatar_url text,
  rating numeric not null default 5,
  sort_order numeric not null default 1,
  is_published boolean not null default true,
  ip_address text,
  user_email text,
  user_id text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create table public.interest_registrations (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  phone text,
  email text not null,
  postcode text,
  team_supported text not null,
  trip_details text,
  fan_events_only boolean not null default false,
  consent_to_contact boolean not null default false,
  consent_timestamp timestamptz,
  source text not null default 'website',
  user_email text,
  user_id text,
  ip_address text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create table public.forum_posts (
  id text primary key default gen_random_uuid()::text,
  author_name text not null,
  author_avatar text,
  title text,
  body text not null,
  category text not null default 'General',
  parent_id text,
  is_published boolean not null default false,
  is_pinned boolean not null default false,
  user_email text,
  user_id text,
  ip_address text,
  media_url text,
  media_type text not null default '',
  like_count numeric not null default 0,
  liked_by jsonb not null default '[]'::jsonb,
  reactions jsonb,
  view_count numeric not null default 0,
  deleted_at timestamptz,
  deleted_by text,
  moderation_reason text,
  reported_count numeric not null default 0,
  reported_by jsonb not null default '[]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create index forum_posts_parent_idx on public.forum_posts (parent_id);
create index forum_posts_created_idx on public.forum_posts (created_date desc);

create table public.forum_reward_events (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  user_email text,
  kind text not null check (kind in ('thread', 'reply', 'reaction_given', 'reaction_received', 'streak_bonus', 'slot_win')),
  xp numeric not null default 0,
  chips numeric not null default 0,
  rank_after text,
  post_id text,
  note text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create index forum_reward_events_user_idx on public.forum_reward_events (user_id, created_date desc);

create table public.achievement_unlocks (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  user_email text,
  achievement_id text not null,
  category text,
  tier text,
  reward_chips numeric not null default 0,
  unlocked_at timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create index achievement_unlocks_user_idx on public.achievement_unlocks (user_id);

create table public.notifications (
  id text primary key default gen_random_uuid()::text,
  recipient_id text not null,
  recipient_email text,
  type text not null default 'system' check (type in ('reply', 'mention', 'system')),
  title text,
  preview text,
  actor_name text,
  post_id text,
  link text,
  is_read boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_date desc);

create table public.bans (
  id text primary key default gen_random_uuid()::text,
  ban_type text not null check (ban_type in ('ip', 'email', 'user')),
  value text not null,
  reason text,
  banned_by text,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create index bans_lookup_idx on public.bans (ban_type, value) where is_active;

create table public.tipping_entries (
  id text primary key default gen_random_uuid()::text,
  game_id text not null,
  game_label text,
  home_team text not null,
  away_team text not null,
  selected_team text not null,
  predicted_home_score numeric not null default 0,
  predicted_away_score numeric not null default 0,
  margin numeric not null default 1,
  confidence numeric not null default 1,
  tipper_name text,
  user_id text,
  user_email text,
  ip_address text,
  kickoff timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create index tipping_entries_game_idx on public.tipping_entries (game_id);

-- updated_date triggers for every table
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'teams', 'faqs', 'partners', 'news_articles', 'event_contents',
    'travel_packages', 'gallery_items', 'matchups', 'products',
    'product_release_subscriptions', 'store_orders', 'site_ads', 'site_settings',
    'testimonials', 'interest_registrations', 'forum_posts', 'forum_reward_events',
    'achievement_unlocks', 'notifications', 'bans', 'tipping_entries'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_date()',
      t || '_touch_updated', t
    );
  end loop;
end;
$$;
