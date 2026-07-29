-- Self-service account deletion and the real native push preference.

alter table public.profiles
  add column if not exists push_opt_in boolean not null default false;

-- Once deletion marks the profile disabled, prevent a still-valid access token
-- from racing in a new upload before auth.users is removed.
drop policy if exists "media_auth_upload" on storage.objects;
create policy "media_auth_upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (select auth.role()) = 'authenticated'
    and exists (
      select 1
      from public.profiles
      where auth_user_id = (select auth.uid())
        and disabled = false
    )
  );

-- Account deletion removes only objects owned by the caller. Public media
-- URLs are user-editable, so a service-role delete based on a stored URL could
-- otherwise be abused to remove another member's image.
drop policy if exists "media_owner_read" on storage.objects;
create policy "media_owner_read" on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and owner_id = (select auth.uid()::text)
  );

drop policy if exists "media_owner_delete" on storage.objects;
create policy "media_owner_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and owner_id = (select auth.uid()::text)
  );

create or replace function public.delete_account_data(p_auth_user_id uuid)
returns table (
  profile_id text,
  media_urls text[],
  retained_order_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_email text;
  v_media_urls text[];
  v_retained_orders integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select *
    into v_profile
    from public.profiles
    where auth_user_id = p_auth_user_id
    for update;

  if not found then
    raise exception 'Account profile not found';
  end if;
  if v_profile.role = 'admin' then
    raise exception 'Administrator accounts must be transferred or removed by another administrator';
  end if;

  v_email := lower(coalesce(v_profile.email, ''));

  select coalesce(array_agg(url), array[]::text[])
    into v_media_urls
    from (
      select nullif(v_profile.avatar_url, '') as url
      union all
      select nullif(media_url, '') from public.forum_posts
        where user_id = v_profile.id
          or (v_email <> '' and lower(coalesce(user_email, '')) = v_email)
      union all
      select nullif(avatar_url, '') from public.testimonials
        where user_id = v_profile.id
          or (v_email <> '' and lower(coalesce(user_email, '')) = v_email)
    ) media
    where url is not null;

  -- Keep reply trees intact while removing the member's text and identifiers.
  update public.forum_posts
    set author_name = 'Deleted member',
        author_avatar = null,
        title = case when parent_id is null then 'Deleted account' else null end,
        body = 'Content removed by the member.',
        user_email = null,
        user_id = null,
        ip_address = null,
        media_url = null,
        media_type = '',
        deleted_at = now(),
        deleted_by = 'account_deletion',
        moderation_reason = 'Removed at the member''s request'
    where user_id = v_profile.id
       or (v_email <> '' and lower(coalesce(user_email, '')) = v_email);

  -- Remove the member from likes, reports and reaction maps on other posts.
  update public.forum_posts fp
    set liked_by = (
          select coalesce(jsonb_agg(value), '[]'::jsonb)
          from jsonb_array_elements_text(coalesce(fp.liked_by, '[]'::jsonb)) value
          where value <> v_profile.id
        ),
        reported_by = (
          select coalesce(jsonb_agg(value), '[]'::jsonb)
          from jsonb_array_elements_text(coalesce(fp.reported_by, '[]'::jsonb)) value
          where value <> v_profile.id and lower(value) <> v_email
        ),
        reactions = (
          select coalesce(jsonb_object_agg(reaction.key, filtered.values), '{}'::jsonb)
          from jsonb_each(coalesce(fp.reactions, '{}'::jsonb)) reaction
          cross join lateral (
            select coalesce(jsonb_agg(value), '[]'::jsonb) as values
            from jsonb_array_elements_text(
              case when jsonb_typeof(reaction.value) = 'array' then reaction.value else '[]'::jsonb end
            ) value
            where value <> v_profile.id
          ) filtered
        );

  update public.forum_posts
    set like_count = (
          select coalesce(sum(jsonb_array_length(value)), 0)
          from jsonb_each(coalesce(reactions, '{}'::jsonb))
        ),
        reported_count = jsonb_array_length(coalesce(reported_by, '[]'::jsonb));

  delete from public.product_release_subscriptions
    where user_id = v_profile.id
       or (v_email <> '' and lower(coalesce(user_email, '')) = v_email)
       or (v_email <> '' and lower(coalesce(email, '')) = v_email);
  delete from public.testimonials
    where user_id = v_profile.id
       or (v_email <> '' and lower(coalesce(user_email, '')) = v_email);
  delete from public.interest_registrations
    where user_id = v_profile.id
       or (v_email <> '' and lower(coalesce(user_email, '')) = v_email)
       or (v_email <> '' and lower(coalesce(email, '')) = v_email);
  delete from public.forum_reward_events
    where user_id = v_profile.id
       or (v_email <> '' and lower(coalesce(user_email, '')) = v_email);
  delete from public.achievement_unlocks
    where user_id = v_profile.id
       or (v_email <> '' and lower(coalesce(user_email, '')) = v_email);
  delete from public.notifications
    where recipient_id = v_profile.id
       or (v_email <> '' and lower(coalesce(recipient_email, '')) = v_email);
  delete from public.tipping_entries
    where user_id = v_profile.id
       or (v_email <> '' and lower(coalesce(user_email, '')) = v_email);
  delete from public.user_push_tokens where user_id = v_profile.id;
  delete from public.bans
    where (ban_type = 'user' and lower(value) = lower(v_profile.id))
       or (v_email <> '' and ban_type = 'email' and lower(value) = v_email);

  select count(*)::integer
    into v_retained_orders
    from public.store_orders
    where user_id = v_profile.id
       or (v_email <> '' and lower(coalesce(user_email, '')) = v_email);

  update public.store_orders
    set user_id = null,
        user_email = null
    where user_id = v_profile.id
       or (v_email <> '' and lower(coalesce(user_email, '')) = v_email);

  -- Leave an anonymised tombstone until the Edge Function removes auth.users.
  update public.profiles
    set email = null,
        full_name = 'Deleted member',
        phone = null,
        postcode = null,
        city = null,
        country = null,
        bio = null,
        favourite_team = null,
        avatar_url = null,
        badges = '[]'::jsonb,
        casino_xp = 0,
        casino_chips = 0,
        casino_rank = 'Rookie Punter',
        casino_streak = 0,
        casino_last_active_date = null,
        casino_total_posts = 0,
        casino_total_replies = 0,
        casino_total_reactions_given = 0,
        casino_total_reactions_received = 0,
        slot_last_spin_date = null,
        slot_total_spins = 0,
        slot_streak = 0,
        slot_extra_date = null,
        slot_extra_count = 0,
        daily_bonus_date = null,
        marketing_opt_in = false,
        push_opt_in = false,
        show_location_on_forum = false,
        show_team_on_forum = false,
        disabled = true
    where id = v_profile.id;

  return query select v_profile.id, v_media_urls, v_retained_orders;
end;
$$;

revoke all on function public.delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;
