-- Stop leaking forum author emails.
--
-- forum_posts_view is granted to anon/authenticated and masked ip_address and
-- reported_by, but returned user_email verbatim — so anyone with the
-- publishable key could read the email address of every member who has ever
-- posted (select user_email from forum_posts_view). Mask it the same way
-- testimonials_view already does: admins see everything, a member sees their
-- own, everyone else gets null.
--
-- The account "my posts" query (ForumPost.filter({ user_email: <my email> }))
-- still works: the caller's own rows keep their real value, so the filter
-- matches exactly those.
create or replace view public.forum_posts_view
with (security_barrier = true)
as
select
  id, author_name, author_avatar, title, body, category, parent_id,
  is_published, is_pinned,
  case
    when public.is_admin()
      or (user_email is not null
          and lower(user_email) = lower(coalesce(public.current_profile_email(), '')))
    then user_email
    else null
  end as user_email,
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

grant select on public.forum_posts_view to anon, authenticated;
