// Settle footy tips for a finished matchup: award real points/chips/XP to
// every correct tip, exactly once. Callable by any signed-in user (the
// frontend lazily triggers it when it sees a finished-but-unsettled game),
// and safe under concurrency: each entry is claimed with a conditional
// "settled_at is null" update, so double-triggering can't double-award.
//
// Scoring (matches the client display in tipping/constants.js):
//   correct winner            +3 pts · +50 chips · +20 XP
//   correct winner + margin   +5 pts · +150 chips · +50 XP
//   wrong                      0 pts (entry still marked settled)
import { json, preflight, serviceClient, getCaller, num, serverError } from './shared.ts';

const PTS_CORRECT = 3;
const PTS_MARGIN_BONUS = 2;
const WIN_CHIPS = 50;
const WIN_XP = 20;
const PERFECT_CHIPS = 150;
const PERFECT_XP = 50;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const me = await getCaller(req, svc);
    if (!me) return json({ error: 'Sign in required' }, 401);

    const { gameId } = await req.json().catch(() => ({}));
    const id = String(gameId || '').trim();
    if (!id) return json({ error: 'gameId is required' }, 400);

    // Only admin-managed matchups can be settled — the scores come from OUR
    // database, never from the caller (so nobody can invent a result).
    const { data: matchup } = await svc.from('matchups').select('*').eq('id', id).maybeSingle();
    if (!matchup) return json({ error: 'Matchup not found' }, 404);
    const finished = matchup.status === 'final' || matchup.status === 'finished';
    if (!finished || matchup.home_score == null || matchup.away_score == null) {
      return json({ error: 'Matchup has no final result yet' }, 400);
    }

    const home = num(matchup.home_score);
    const away = num(matchup.away_score);
    const actualWinner = home > away ? matchup.home_team : away > home ? matchup.away_team : 'draw';
    const actualMargin = Math.abs(home - away);

    const { data: entries } = await svc
      .from('tipping_entries')
      .select('*')
      .eq('game_id', id)
      .is('settled_at', null)
      .limit(2000);

    let settled = 0;
    let winners = 0;

    for (const entry of entries || []) {
      const correct = entry.selected_team === actualWinner;
      const perfect = correct && Math.abs(num(entry.margin) - actualMargin) === 0;
      const points = correct ? PTS_CORRECT + (perfect ? PTS_MARGIN_BONUS : 0) : 0;
      const result = perfect ? 'perfect' : correct ? 'win' : 'loss';

      // Claim the entry: only proceed if WE flipped settled_at from null.
      const { data: claimed } = await svc
        .from('tipping_entries')
        .update({ settled_at: new Date().toISOString(), points, result })
        .eq('id', entry.id)
        .is('settled_at', null)
        .select('id');
      if (!claimed?.length) continue; // another settle call got here first
      settled += 1;

      if (correct && entry.user_id) {
        const { data: profile } = await svc.from('profiles').select('id, email, casino_chips, casino_xp, casino_rank').eq('id', entry.user_id).maybeSingle();
        if (profile) {
          const chips = perfect ? PERFECT_CHIPS : WIN_CHIPS;
          const xp = perfect ? PERFECT_XP : WIN_XP;
          await svc.from('profiles').update({
            casino_chips: num(profile.casino_chips) + chips,
            casino_xp: num(profile.casino_xp) + xp,
          }).eq('id', profile.id);
          await svc.from('forum_reward_events').insert({
            user_id: profile.id,
            user_email: profile.email || '',
            kind: 'tip_win',
            xp,
            chips,
            rank_after: profile.casino_rank || 'Rookie Punter',
            post_id: '',
            note: perfect
              ? `Perfect tip — ${entry.selected_team} by exactly ${actualMargin} (${matchup.home_team} v ${matchup.away_team})`
              : `Winning tip — ${entry.selected_team} (${matchup.home_team} v ${matchup.away_team})`,
          });
          winners += 1;
        }
      }
    }

    return json({ ok: true, game_id: id, settled, winners });
  } catch (error) {
    return serverError('settleTips', error);
  }
});
