-- Applied to the project as "storage_listing_hardening".
-- Public buckets serve object URLs without needing a SELECT policy on
-- storage.objects; the broad read policy only enabled bucket LISTING, which
-- exposes every filename. Restrict listing to admins.
drop policy "media_public_read" on storage.objects;
create policy "media_admin_read" on storage.objects for select
  using (bucket_id = 'media' and public.is_admin());
