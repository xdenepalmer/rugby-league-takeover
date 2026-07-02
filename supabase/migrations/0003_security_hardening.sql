-- Advisor hardening (applied to the project as "security_hardening").
-- 1. Pin search_path on the updated_date trigger function.
create or replace function public.touch_updated_date()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_date := now();
  return new;
end;
$$;

-- 2. Trigger functions must not be callable through the REST RPC surface.
--    (EXECUTE on trigger functions is only checked at CREATE TRIGGER time.)
revoke execute on function public.handle_new_auth_user() from anon, authenticated, public;
revoke execute on function public.protect_profile_columns() from anon, authenticated, public;
revoke execute on function public.touch_updated_date() from anon, authenticated, public;

-- Note: is_admin()/is_moderator()/current_profile_id()/current_profile_email()
-- intentionally stay executable — they are referenced inside RLS policies that
-- run with the querying role's privileges, and they only ever reveal data
-- about the caller's own profile.
