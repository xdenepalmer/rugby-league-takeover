-- 0009: Device push-token persistence (RLT-IOS-001 foundation).
--
-- Stores APNs (and later FCM/web) device tokens so a future service-role
-- edge function can deliver push notifications. This migration is the token
-- REGISTRATION path only — there is deliberately no send pipeline yet.
-- Conventions match 0001: text PKs, created_date/updated_date, own-row RLS
-- via current_profile_id(), and the shared touch_updated_date() trigger.

create table public.user_push_tokens (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  token text not null,
  platform text not null default 'ios' check (platform in ('ios', 'android', 'web')),
  device_model text,
  app_version text,
  enabled boolean not null default true,
  last_seen_date timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create unique index user_push_tokens_token_idx on public.user_push_tokens (token);
create index user_push_tokens_user_idx on public.user_push_tokens (user_id) where enabled;

create trigger user_push_tokens_touch_updated
  before update on public.user_push_tokens
  for each row execute function public.touch_updated_date();

alter table public.user_push_tokens enable row level security;

-- A user manages only their own device tokens; admins can read/manage all
-- (the send pipeline itself will run as service role and bypass RLS).
create policy "push_tokens_select_own" on public.user_push_tokens for select
  using ((select public.is_admin()) or user_id = coalesce((select public.current_profile_id()), ''));

-- Insert requires a resolved profile: anonymous callers (current_profile_id()
-- NULL) must not be able to insert rows with user_id = '' via a coalesce
-- fallback.
create policy "push_tokens_insert_own" on public.user_push_tokens for insert
  with check (
    (select public.current_profile_id()) is not null
    and user_id = (select public.current_profile_id())
  );

create policy "push_tokens_update_own" on public.user_push_tokens for update
  using ((select public.is_admin()) or user_id = coalesce((select public.current_profile_id()), ''))
  with check ((select public.is_admin()) or user_id = coalesce((select public.current_profile_id()), ''));

create policy "push_tokens_delete_own" on public.user_push_tokens for delete
  using ((select public.is_admin()) or user_id = coalesce((select public.current_profile_id()), ''));
