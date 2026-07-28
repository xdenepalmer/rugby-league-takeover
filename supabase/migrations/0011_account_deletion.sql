-- Google Play account-deletion compliance.
--
-- The service-role-only RPC removes or anonymises all user-linked app data in
-- one transaction. Completed store orders retain the customer/invoice fields
-- required for refunds, tax, fraud and legal records, but are detached from
-- the app account. The Edge Function deletes uploaded media and the auth user
-- after this transaction succeeds.

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
      select nullif(media_url, '')
        from public.forum_posts
        where user_id = v_profile.id
           or (v_email <> '' and lower(coalesce(user_email, '')) = v_email)
    ) media
    where url is not null;

  -- Preserve forum thread structure, but erase the member's content and all
  -- direct identifiers. Replies by other members remain attached.
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

  -- Remove the deleted profile from likes, reports and emoji-reaction maps on
  -- every other member's post.
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
       or lower(coalesce(user_email, '')) = v_email
       or lower(coalesce(email, '')) = v_email;
  delete from public.testimonials
    where user_id = v_profile.id or lower(coalesce(user_email, '')) = v_email;
  delete from public.interest_registrations
    where user_id = v_profile.id
       or lower(coalesce(user_email, '')) = v_email
       or lower(coalesce(email, '')) = v_email;
  delete from public.forum_reward_events
    where user_id = v_profile.id or lower(coalesce(user_email, '')) = v_email;
  delete from public.achievement_unlocks
    where user_id = v_profile.id or lower(coalesce(user_email, '')) = v_email;
  delete from public.notifications
    where recipient_id = v_profile.id or lower(coalesce(recipient_email, '')) = v_email;
  delete from public.tipping_entries
    where user_id = v_profile.id or lower(coalesce(user_email, '')) = v_email;
  delete from public.user_push_tokens where user_id = v_profile.id;
  delete from public.bans
    where (ban_type = 'user' and lower(value) = lower(v_profile.id))
       or (ban_type = 'email' and lower(value) = v_email);

  select count(*)::integer
    into v_retained_orders
    from public.store_orders
    where user_id = v_profile.id or lower(coalesce(user_email, '')) = v_email;

  update public.store_orders
    set user_id = null,
        user_email = null
    where user_id = v_profile.id or lower(coalesce(user_email, '')) = v_email;

  -- Leave a fully anonymised tombstone until the Edge Function deletes the
  -- auth user. If that external call fails, no profile PII remains.
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
        marketing_opt_in = false,
        show_location_on_forum = false,
        show_team_on_forum = false,
        disabled = true
    where id = v_profile.id;

  return query select v_profile.id, v_media_urls, v_retained_orders;
end;
$$;

revoke all on function public.delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;
