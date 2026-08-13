-- Split the single site counter into two honest metrics: total views and
-- unique visitors.
--
-- The original counter (0010) was one number incremented once per device per
-- UTC day, deduped in localStorage. That is neither a page-view count nor a
-- unique-visitor count — it sits awkwardly between the two, and it is client-
-- trusted (clearing localStorage lets a device count again the same day).
--
-- Now:
--   total_views     — every page view, counted server-side on each navigation.
--   unique_visitors — distinct devices, deduped SERVER-side against a table of
--                     opaque keys, so it is a real count rather than a promise
--                     the browser makes to itself.
--
-- The visitor key is a random UUID minted in the browser. It is not derived
-- from an IP address, a fingerprint, or anything about the person, so the keys
-- table holds no personal data — only "some browser, seen this often".

-- ── Aggregate counters ───────────────────────────────────────────────────
alter table public.site_visit_stats
  add column if not exists total_views bigint not null default 0,
  add column if not exists unique_visitors bigint not null default 0,
  add column if not exists unique_tracking_started_at timestamptz;

-- Carry the legacy tally forward as the starting view count, so the admin
-- number does not appear to reset to zero on deploy. Unique visitors genuinely
-- cannot be reconstructed from a single scalar, so it starts now — and the
-- admin UI says so rather than implying the figure is all-time.
update public.site_visit_stats
   set total_views = greatest(total_views, total_visits),
       unique_tracking_started_at = coalesce(unique_tracking_started_at, now())
 where id = 1;

-- ── Server-side unique dedup ─────────────────────────────────────────────
create table if not exists public.site_visitor_keys (
  visitor_key text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  view_count integer not null default 1
);

alter table public.site_visitor_keys enable row level security;

-- Deliberately NO policies: this table is written only by the SECURITY DEFINER
-- function below and read only by the service role. Even though the keys are
-- meaningless UUIDs, an enumerable list of every device that has visited is not
-- something anonymous callers should be able to page through.
revoke all on table public.site_visitor_keys from anon, authenticated;

create index if not exists site_visitor_keys_last_seen_idx
  on public.site_visitor_keys (last_seen_at desc);

-- ── Recording ────────────────────────────────────────────────────────────
-- Write-only on purpose: it returns nothing. The counts are a private business
-- metric, so the path that anonymous visitors can call must not hand them back.
create or replace function public.record_site_visit(p_visitor_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_new_visitor boolean := false;
begin
  -- The client sends a UUID. Anything outside that shape is junk or an attempt
  -- to inflate uniques with generated keys, and is dropped without a view.
  if p_visitor_key is null
     or p_visitor_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return;
  end if;

  -- xmax = 0 is true only for a genuine INSERT, so this distinguishes a
  -- first-ever visit from a returning one in a single statement.
  insert into public.site_visitor_keys as k (visitor_key, first_seen_at, last_seen_at, view_count)
  values (p_visitor_key, now(), now(), 1)
  on conflict (visitor_key) do update
     set last_seen_at = now(),
         view_count = k.view_count + 1
  returning (xmax = 0) into is_new_visitor;

  update public.site_visit_stats
     set total_views = total_views + 1,
         unique_visitors = unique_visitors + (case when is_new_visitor then 1 else 0 end),
         updated_at = now()
   where id = 1;
end;
$$;

revoke all on function public.record_site_visit(text) from public;
grant execute on function public.record_site_visit(text) to anon, authenticated;

-- The 0010 function stays callable so browser tabs still running the previous
-- bundle keep counting instead of erroring, but it now feeds total_views too.
-- It cannot contribute to unique_visitors — the old client sends no key.
create or replace function public.increment_site_visits()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total bigint;
begin
  update public.site_visit_stats
     set total_visits = total_visits + 1,
         total_views = total_views + 1,
         updated_at = now()
   where id = 1
   returning total_views into new_total;
  return new_total;
end;
$$;

revoke all on function public.increment_site_visits() from public;
grant execute on function public.increment_site_visits() to anon, authenticated;

-- ── Reading ──────────────────────────────────────────────────────────────
-- The count was pulled off the public footer deliberately: it is for the team,
-- not the crowd. A world-readable SELECT policy left it public anyway, so the
-- read is now admin-only and matches the intent.
drop policy if exists "site_visit_stats_public_read" on public.site_visit_stats;
drop policy if exists "site_visit_stats_admin_read" on public.site_visit_stats;
create policy "site_visit_stats_admin_read"
  on public.site_visit_stats
  for select
  using (public.is_admin());
