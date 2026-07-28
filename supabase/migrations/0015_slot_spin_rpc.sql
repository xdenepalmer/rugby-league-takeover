-- Atomic slot-spin claim + reward.
--
-- The slotSpin edge function rolls the reels (server-side RNG) and computes the
-- reward, then calls THIS function to mutate profile state under a single row
-- lock (`select ... for update`). That closes the read-then-write TOCTOU race
-- in the previous implementation, where N concurrent spins all read
-- "not spun yet", all passed the daily gate, and all awarded — bypassing the
-- one-free-spin-per-day limit, the extra-spin cap, and the 300-chip cost.
--
-- Because the row is locked for the duration, concurrent callers serialize:
-- the first claim wins and flips the day/extra state; the rest re-read the
-- committed row and are rejected. All reward maths (chips, XP, badge dedup,
-- streak, spin counter) happen inside the same locked statement.
--
-- SECURITY: runs as definer but is NOT granted to anon/authenticated — only the
-- edge function's service-role client may call it. This prevents a signed-in
-- user from invoking /rest/v1/rpc/apply_slot_spin directly with an arbitrary
-- p_chips_won to mint themselves rewards.
create or replace function public.apply_slot_spin(
  p_profile_id text,
  p_mode text,
  p_today text,
  p_yesterday text,
  p_cost numeric,
  p_max_extra integer,
  p_chips_won numeric,
  p_xp_won numeric,
  p_new_badge text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.profiles;
  v_daily_used boolean;
  v_extra_used integer;
  v_streak numeric;
  v_badge_added boolean := false;
begin
  select * into r from public.profiles where id = p_profile_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_daily_used := coalesce(r.slot_last_spin_date, '') = p_today;
  v_extra_used := case when coalesce(r.slot_extra_date, '') = p_today then coalesce(r.slot_extra_count, 0)::int else 0 end;
  v_badge_added := p_new_badge <> '' and not (coalesce(r.badges, '[]'::jsonb) ? p_new_badge);

  if p_mode = 'extra' then
    if not v_daily_used then
      return jsonb_build_object('ok', false, 'reason', 'use_daily_first');
    end if;
    if v_extra_used >= p_max_extra then
      return jsonb_build_object('ok', false, 'reason', 'no_extra_left', 'chips', coalesce(r.casino_chips, 0), 'extra_used', v_extra_used);
    end if;
    if coalesce(r.casino_chips, 0) < p_cost then
      return jsonb_build_object('ok', false, 'reason', 'insufficient_chips', 'chips', coalesce(r.casino_chips, 0), 'extra_used', v_extra_used);
    end if;
    update public.profiles set
      slot_extra_date = p_today,
      slot_extra_count = v_extra_used + 1,
      slot_total_spins = coalesce(slot_total_spins, 0) + 1,
      casino_chips = greatest(0, coalesce(casino_chips, 0) - p_cost + p_chips_won),
      casino_xp = coalesce(casino_xp, 0) + p_xp_won,
      badges = case when v_badge_added then coalesce(badges, '[]'::jsonb) || to_jsonb(p_new_badge) else badges end,
      updated_date = now()
    where id = p_profile_id
    returning * into r;
  else
    if v_daily_used then
      return jsonb_build_object('ok', false, 'reason', 'daily_used', 'chips', coalesce(r.casino_chips, 0), 'extra_used', v_extra_used);
    end if;
    v_streak := case when coalesce(r.slot_last_spin_date, '') = p_yesterday then coalesce(r.slot_streak, 0) + 1 else 1 end;
    update public.profiles set
      slot_last_spin_date = p_today,
      slot_streak = v_streak,
      slot_total_spins = coalesce(slot_total_spins, 0) + 1,
      casino_chips = greatest(0, coalesce(casino_chips, 0) + p_chips_won),
      casino_xp = coalesce(casino_xp, 0) + p_xp_won,
      badges = case when v_badge_added then coalesce(badges, '[]'::jsonb) || to_jsonb(p_new_badge) else badges end,
      updated_date = now()
    where id = p_profile_id
    returning * into r;
  end if;

  return jsonb_build_object(
    'ok', true,
    'badge_added', v_badge_added,
    'chips', r.casino_chips,
    'xp', r.casino_xp,
    'streak', r.slot_streak,
    'total_spins', r.slot_total_spins,
    'extra_used', case when coalesce(r.slot_extra_date, '') = p_today then coalesce(r.slot_extra_count, 0)::int else 0 end
  );
end;
$$;

-- Only the service role (edge function) may call this — never end users directly.
revoke all on function public.apply_slot_spin(text, text, text, text, numeric, integer, numeric, numeric, text) from public;
revoke all on function public.apply_slot_spin(text, text, text, text, numeric, integer, numeric, numeric, text) from anon;
revoke all on function public.apply_slot_spin(text, text, text, text, numeric, integer, numeric, numeric, text) from authenticated;
