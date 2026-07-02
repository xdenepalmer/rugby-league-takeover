-- Private bucket for AusPost shipping labels — these carry the customer's
-- full name + address, so unlike 'media' they must NOT be publicly
-- readable by URL. Admins access them via short-lived signed URLs only
-- (see supabase/functions/auspostCreateLabel).
insert into storage.buckets (id, name, public)
values ('labels', 'labels', false)
on conflict (id) do nothing;

create policy "labels_admin_read" on storage.objects for select
  using (bucket_id = 'labels' and (select public.is_admin()));
create policy "labels_service_write" on storage.objects for insert
  with check (bucket_id = 'labels' and (select public.is_admin()));
create policy "labels_admin_delete" on storage.objects for delete
  using (bucket_id = 'labels' and (select public.is_admin()));
