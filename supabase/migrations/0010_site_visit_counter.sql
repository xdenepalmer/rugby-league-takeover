-- Site-wide visitor counter.
--
-- A single-row counter incremented atomically by a SECURITY DEFINER function, so
-- anonymous visitors can bump it without any direct write access to the table.
-- The count itself is world-readable (a vanity metric, not sensitive). The
-- client dedups per device per calendar day in localStorage, so the number
-- approximates unique daily visitors rather than raw page hits.

create table if not exists public.site_visit_stats (
  id integer primary key default 1,
  total_visits bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint site_visit_stats_singleton check (id = 1)
);

insert into public.site_visit_stats (id, total_visits)
  values (1, 0)
  on conflict (id) do nothing;

alter table public.site_visit_stats enable row level security;

-- World-readable count (SELECT only). There are deliberately NO insert/update/
-- delete policies, so direct writes from anon/authenticated are denied by RLS —
-- the only way to change the number is the increment function below.
drop policy if exists "site_visit_stats_public_read" on public.site_visit_stats;
create policy "site_visit_stats_public_read"
  on public.site_visit_stats
  for select
  using (true);

-- Atomic increment. SECURITY DEFINER runs as the function owner, bypassing RLS
-- for the single-row UPDATE, and returns the new running total. search_path is
-- pinned to avoid search-path hijacking.
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
         updated_at = now()
   where id = 1
   returning total_visits into new_total;
  return new_total;
end;
$$;

-- Execute is granted only to the client roles; the function body is the sole
-- write path to the counter.
revoke all on function public.increment_site_visits() from public;
grant execute on function public.increment_site_visits() to anon, authenticated;
