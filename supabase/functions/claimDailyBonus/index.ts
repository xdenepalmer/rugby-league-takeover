// Daily missions: check (and claim) the day's forum missions. All checks are
// server-side from forum_reward_events + profile slot state, so the bonus
// can't be claimed by just poking the button.
//
//   Missions (UTC day):
//     post    — created a thread or reply today
//     react   — gave 3+ reactions today
//     spin    — used today's slot spin
//   All three complete → +100 chips, +40 XP, once per day.
//
// Request: { claim?: boolean } — omit/false just returns mission status.
import { json, preflight, serviceClient, getCaller, num, todayKey } from './shared.ts';

const BONUS_CHIPS = 100;
const BONUS_XP = 40;
const REACTIONS_NEEDED = 3;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const me = await getCaller(req, svc);
    if (!me) return json({ error: 'Sign in required' }, 401);

    const { claim = false } = await req.json().catch(() => ({}));
    const today = todayKey();
    const dayStart = `${today}T00:00:00Z`;

    const { data: events } = await svc
      .from('forum_reward_events')
      .select('kind, created_date')
      .eq('user_id', me.id)
      .gte('created_date', dayStart)
      .limit(500);

    const todayEvents = events || [];
    const posted = todayEvents.some((e) => e.kind === 'thread' || e.kind === 'reply');
    const reactions = todayEvents.filter((e) => e.kind === 'reaction_given').length;
    const { data: profile } = await svc
      .from('profiles')
      .select('id, email, casino_chips, casino_xp, casino_rank, slot_last_spin_date, daily_bonus_date')
      .eq('id', me.id)
      .maybeSingle();
    if (!profile) return json({ error: 'Profile not found' }, 404);

    const spun = String(profile.slot_last_spin_date || '') === today;
    const claimed = String(profile.daily_bonus_date || '') === today;
    const missions = {
      post: posted,
      react: { done: reactions >= REACTIONS_NEEDED, progress: Math.min(reactions, REACTIONS_NEEDED), needed: REACTIONS_NEEDED },
      spin: spun,
    };
    const allComplete = posted && reactions >= REACTIONS_NEEDED && spun;

    if (!claim) {
      return json({ ok: true, missions, allComplete, claimed, bonus: { chips: BONUS_CHIPS, xp: BONUS_XP } });
    }

    if (claimed) return json({ error: 'Daily bonus already claimed today' }, 429);
    if (!allComplete) return json({ error: 'Finish all three missions first' }, 400);

    // Claim guard: only award if WE flip today's date on (concurrency-safe).
    const { data: took } = await svc
      .from('profiles')
      .update({
        daily_bonus_date: today,
        casino_chips: num(profile.casino_chips) + BONUS_CHIPS,
        casino_xp: num(profile.casino_xp) + BONUS_XP,
      })
      .eq('id', me.id)
      // NULL-safe "not yet claimed today" guard (neq alone skips NULL rows).
      .or(`daily_bonus_date.is.null,daily_bonus_date.neq.${today}`)
      .select('id');
    if (!took?.length) return json({ error: 'Daily bonus already claimed today' }, 429);

    await svc.from('forum_reward_events').insert({
      user_id: me.id,
      user_email: me.email || '',
      kind: 'daily_bonus',
      xp: BONUS_XP,
      chips: BONUS_CHIPS,
      rank_after: profile.casino_rank || 'Rookie Punter',
      post_id: '',
      note: 'Daily missions complete — post, react ×3, slot spin',
    });

    return json({ ok: true, claimedNow: true, missions, allComplete: true, claimed: true, bonus: { chips: BONUS_CHIPS, xp: BONUS_XP } });
  } catch (error) {
    console.error('claimDailyBonus error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
