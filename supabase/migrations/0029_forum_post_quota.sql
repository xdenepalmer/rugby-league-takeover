-- 0029: make the forum posting quota atomic (RLT-FORUM-002).
--
-- THE BUG
-- submitForumPost enforced its 5-per-10-minutes / 20-per-day limits by running
-- three COUNT queries and then, several awaits later, inserting the post. That
-- is a check-then-act race: a burst of simultaneous requests ALL run their
-- COUNTs before any of them inserts, so they all read "under the limit" and all
-- proceed. The window between the check and the insert is several network
-- round-trips wide (ban lookup, insert, reward claim, mention fan-out), which is
-- an eternity — this is the forum's ONLY anti-spam control, so the failure mode
-- is one script filling the forum in a second.
--
-- THE FIX
-- Claiming a posting slot is now a single database call that both checks and
-- consumes the quota under a row lock. Concurrent claims for the same user
-- serialise on that lock instead of all reading the same stale count.
--
-- The quota lives in its own table rather than being derived from forum_posts,
-- so deleting posts cannot reset the gate — preserving the property the old
-- reward-event counting was there to provide, and strengthening it (soft-deleted
-- posts no longer matter either way).

create table if not exists public.forum_post_quota (
  user_id      text primary key,
  window_start timestamptz not null default now(),
  window_count integer     not null default 0,
  day_start    date        not null default current_date,
  day_count    integer     not null default 0
);

-- Service-role only: reached exclusively through the SECURITY DEFINER function.
alter table public.forum_post_quota enable row level security;

create or replace function public.forum_claim_post_slot(
  p_user_id        text,
  p_window_limit   integer default 5,
  p_day_limit      integer default 20,
  p_window_seconds integer default 600
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now     timestamptz := now();
  v_window  integer;
  v_day     integer;
  v_rows    integer := 0;
begin
  if p_user_id is null or p_user_id = '' then
    return jsonb_build_object('allowed', false, 'reason', 'no_identity');
  end if;

  -- Step 1: create or roll over the counters. INSERT ... ON CONFLICT DO UPDATE
  -- takes a row lock that is held for the rest of this transaction, so a
  -- concurrent burst for the same user queues here rather than racing.
  insert into public.forum_post_quota as q (user_id, window_start, window_count, day_start, day_count)
  values (p_user_id, v_now, 0, current_date, 0)
  on conflict (user_id) do update
    set window_start = case when q.window_start < v_now - make_interval(secs => p_window_seconds)
                            then v_now else q.window_start end,
        window_count = case when q.window_start < v_now - make_interval(secs => p_window_seconds)
                            then 0 else q.window_count end,
        day_start    = case when q.day_start <> current_date
                            then current_date else q.day_start end,
        day_count    = case when q.day_start <> current_date
                            then 0 else q.day_count end
  returning q.window_count, q.day_count into v_window, v_day;

  -- Step 2: consume a slot only if one is actually available. The limits live in
  -- the WHERE clause, so the check and the increment are the same statement and
  -- cannot be interleaved.
  update public.forum_post_quota
     set window_count = window_count + 1,
         day_count    = day_count + 1
   where user_id = p_user_id
     and window_count < p_window_limit
     and day_count    < p_day_limit;

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    return jsonb_build_object('allowed', true);
  end if;

  -- Report which ceiling was hit so the caller can keep its existing messages.
  if v_day >= p_day_limit then
    return jsonb_build_object('allowed', false, 'reason', 'daily_rate_limited');
  end if;
  return jsonb_build_object('allowed', false, 'reason', 'rate_limited');
end;
$$;

-- Returning a slot after a failed insert, so a database error downstream does
-- not silently cost the member one of their five.
create or replace function public.forum_release_post_slot(p_user_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id = '' then return; end if;
  update public.forum_post_quota
     set window_count = greatest(window_count - 1, 0),
         day_count    = greatest(day_count - 1, 0)
   where user_id = p_user_id;
end;
$$;

revoke all on function public.forum_claim_post_slot(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.forum_release_post_slot(text) from public, anon, authenticated;
