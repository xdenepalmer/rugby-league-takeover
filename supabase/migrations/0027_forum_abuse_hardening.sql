-- 0027: forum abuse hardening (RLT-FORUM-001).
--
-- Three defects, all in forumAction, all reachable before the forum opens to the
-- public. forum_posts itself is RLS-locked to admins so clients cannot write
-- directly — every one of these goes through the service-role function, which is
-- exactly why the function's own checks have to hold.
--
-- 1. REPORT POISONED THE MODERATOR'S NOTE. The 'report' action wrote caller-supplied
--    text straight into forum_posts.moderation_reason, which ForumManager.jsx renders
--    to moderators as "Mod reason: …". An unauthenticated caller could therefore put
--    words in a moderator's own field — and overwrite a note a moderator had already
--    written. Reporter text now lands in its own column and moderation_reason stays
--    admin-authored.
--
-- 2. VIEW COUNTS WERE FREE TO INFLATE. 'view' is unauthenticated, fired automatically
--    on render, and did a read-modify-write. Anyone could loop it to inflate a count
--    and to drive unbounded writes. forum_register_view() makes the increment atomic
--    AND idempotent per viewer per post per hour, so the loop stops mattering.
--
-- 3. LIKES RACED AND LOST. 'like' read the liked_by array, mutated it in the function,
--    and wrote it back. Two concurrent likes = one lost, and like_count drifts away
--    from liked_by permanently. forum_toggle_like() does it under a row lock and
--    derives the count from the array, so they cannot disagree.

-- ---------------------------------------------------------------------------
-- 1. Reporter reasons, kept separate from the moderator's own note.
-- ---------------------------------------------------------------------------
alter table public.forum_posts
  add column if not exists report_reasons jsonb not null default '[]'::jsonb;

comment on column public.forum_posts.report_reasons is
  'User-submitted report reasons: [{reporter, reason, at}]. Untrusted input — render as '
  'quoted user text, never as the moderator''s own note. moderation_reason stays admin-authored.';

-- ---------------------------------------------------------------------------
-- 2. View de-duplication + atomic increment.
-- ---------------------------------------------------------------------------
create table if not exists public.forum_view_marks (
  post_id text not null,
  viewer_key text not null,
  window_start timestamptz not null,
  primary key (post_id, viewer_key, window_start)
);

-- Only ever touched by the SECURITY DEFINER function below and the service role.
-- RLS on with no policies = deny all for anon/authenticated.
alter table public.forum_view_marks enable row level security;

create index if not exists forum_view_marks_window_idx
  on public.forum_view_marks (window_start);

create or replace function public.forum_register_view(p_post_id text, p_viewer_key text)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_count numeric;
begin
  if p_post_id is null or p_post_id = '' or p_viewer_key is null or p_viewer_key = '' then
    return 0;
  end if;

  insert into public.forum_view_marks (post_id, viewer_key, window_start)
  values (p_post_id, p_viewer_key, v_window)
  on conflict do nothing;

  -- FOUND is true only when the insert actually created a row, i.e. this viewer
  -- has not been counted for this post in this hour. Repeat calls fall through
  -- to a plain read, so hammering the endpoint cannot move the number.
  if found then
    update public.forum_posts
      set view_count = coalesce(view_count, 0) + 1
      where id = p_post_id
      returning view_count into v_count;
  else
    select view_count into v_count from public.forum_posts where id = p_post_id;
  end if;

  return coalesce(v_count, 0);
end;
$$;

-- Housekeeping for the dedup table. Safe to run any time; schedule it if the
-- forum gets busy (the table grows with posts x viewers x hours).
create or replace function public.forum_prune_view_marks(p_keep_days integer default 7)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.forum_view_marks
    where window_start < now() - make_interval(days => greatest(p_keep_days, 1));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Atomic like toggle — count is derived, never stored independently.
-- ---------------------------------------------------------------------------
create or replace function public.forum_toggle_like(p_post_id text, p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_liked_by jsonb;
  v_liked boolean;
begin
  if p_post_id is null or p_post_id = '' or p_user_id is null or p_user_id = '' then
    return jsonb_build_object('liked', false, 'like_count', 0);
  end if;

  -- Row lock: concurrent likes serialise here instead of overwriting each other.
  select coalesce(liked_by, '[]'::jsonb) into v_liked_by
    from public.forum_posts where id = p_post_id for update;

  if v_liked_by is null then
    return jsonb_build_object('liked', false, 'like_count', 0);
  end if;

  if v_liked_by ? p_user_id then
    v_liked_by := v_liked_by - p_user_id;
    v_liked := false;
  else
    v_liked_by := v_liked_by || to_jsonb(p_user_id);
    v_liked := true;
  end if;

  update public.forum_posts
    set liked_by = v_liked_by,
        like_count = jsonb_array_length(v_liked_by)
    where id = p_post_id;

  return jsonb_build_object('liked', v_liked, 'like_count', jsonb_array_length(v_liked_by));
end;
$$;

-- These are called by the service role from forumAction only. Revoke the default
-- EXECUTE grant so a stolen anon/authenticated key cannot drive them directly.
revoke all on function public.forum_register_view(text, text) from public, anon, authenticated;
revoke all on function public.forum_toggle_like(text, text) from public, anon, authenticated;
revoke all on function public.forum_prune_view_marks(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Expose report_reasons to MODERATORS ONLY through the view.
--
-- Admin reads go through forum_posts_view (see src/api/base44Client.js
-- READ_TABLES), whose column list is explicit — without this the moderation UI
-- would simply render nothing for the new column. It is masked like reported_by:
-- it names who reported and carries untrusted user text, so it is admin-only.
--
-- This reproduces the live view definition: 0019_community_hardening's column
-- masking VERBATIM, plus the fixed author predicate from the empty-identity fix
-- (nullif, not coalesce — a blank identity must never match). Do not revert that
-- predicate: `coalesce(current_profile_id(), '')` makes every blank-owner row
-- world-readable.
-- ---------------------------------------------------------------------------
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
  case when (select public.is_admin()) then report_reasons else '[]'::jsonb end as report_reasons,
  created_date, updated_date
from public.forum_posts
where
  is_published
  or (select public.is_admin())
  or (user_id is not null and user_id <> '' and user_id = nullif((select public.current_profile_id()), ''));

grant select on public.forum_posts_view to anon, authenticated;
