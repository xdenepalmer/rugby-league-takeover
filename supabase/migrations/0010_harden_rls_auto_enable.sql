-- Harden execute grants on public.rls_auto_enable().
--
-- The Supabase security advisor flagged `public.rls_auto_enable()` as a
-- SECURITY DEFINER function that the public/anon/authenticated roles can
-- execute. That function is NOT defined by these migrations — it was created
-- out-of-band (Base44 builder / dashboard) and the app never calls it, so
-- there's no reason for web clients to be able to run it.
--
-- This migration revokes execute from public, anon and authenticated on every
-- overload of the function, while re-granting to service_role so any legit
-- server-side/admin use keeps working. It is:
--   * signature-agnostic — loops over pg_proc, so unknown arg types are fine;
--   * safe when absent — if the function doesn't exist, it does nothing;
--   * idempotent — re-running changes nothing.
--
-- If you'd rather remove the function entirely, drop it manually after
-- confirming nothing depends on it; this migration only tightens access.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
    raise notice 'Hardened execute grants on %', fn.sig;
  end loop;

  if not found then
    raise notice 'public.rls_auto_enable() not present — nothing to harden';
  end if;
end $$;
