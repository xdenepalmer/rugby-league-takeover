-- Removes the two synthetic visitor keys used to verify record_site_visit()
-- against production, and rewinds the counters they moved, so the split starts
-- from the real 882 carried over from the legacy tally.
--
-- Written to subtract what is actually there rather than assert a fixed number,
-- so it is a harmless no-op on any database that never had these rows.
with removed as (
  delete from public.site_visitor_keys
   where visitor_key in ('11111111-1111-1111-1111-111111111111',
                         '22222222-2222-2222-2222-222222222222')
  returning view_count
)
update public.site_visit_stats
   set total_views = greatest(total_views - coalesce((select sum(view_count) from removed), 0), 0),
       unique_visitors = greatest(unique_visitors - (select count(*) from removed), 0)
 where id = 1;
