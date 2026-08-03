// Server-authoritative tip submission. Tips must lock at kickoff — this is the
// sole write path and re-checks the deadline server-side. For admin-managed
// matchups the kickoff is read from the DB; for external-API fixtures we fall
// back to the client-supplied kickoff.
//
// Like every real tipping comp (ESPN footytips, NRL Tipping), a tip is
// EDITABLE until kickoff: a repeat submission from the same user (or IP for
// anonymous tippers) updates the existing entry instead of bouncing with 409.
// The lock is the kickoff, not the first submission.
import { json, preflight, serviceClient, getCaller, trimToLength, resolveClientIp, findActiveBan } from './shared.ts';

const toScore = (value: unknown) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 0 && n <= 200 ? n : 0;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const input = await req.json().catch(() => ({}));

    const gameId = trimToLength(input?.game_id, 120);
    const selectedTeam = trimToLength(input?.selected_team, 80);
    const margin = Math.floor(Number(input?.margin));

    if (!gameId) return json({ error: 'game_id is required' }, 400);
    if (!selectedTeam) return json({ error: 'A selected team is required' }, 400);
    if (!Number.isFinite(margin) || margin < 1 || margin > 60) {
      return json({ error: 'Margin must be between 1 and 60' }, 400);
    }

    const user = await getCaller(req, svc);
    const ip = resolveClientIp(req);

    const ban = await findActiveBan(svc, { ip, emails: [user?.email], userId: user?.id });
    if (ban) {
      return json({ error: 'Your account or connection has been blocked.', code: 'blocked' }, 403);
    }

    // Authoritative kickoff for admin-managed games; fall back to the client
    // value for external-API fixtures that have no DB row.
    let kickoff = trimToLength(input?.kickoff, 40);
    const { data: matchup } = await svc.from('matchups').select('*').eq('id', gameId).maybeSingle();
    if (matchup) {
      // Admin-managed game: the DB is authoritative. Only a 'scheduled' game is
      // open for tips. The status CHECK constraint (migration 0001) only allows
      // 'scheduled' or 'final', so the old guard — comparing against 'finished'
      // and 'live', values that can never exist — was dead code, and a 'final'
      // game (whose score is public) was tippable: a guaranteed perfect
      // prediction. Trust the DB kickoff, never the client value, for a known game.
      if (matchup.status !== 'scheduled') {
        return json({ error: 'This game is no longer open for tips.', code: 'locked' }, 403);
      }
      // A scored game is closed even if nobody has flipped the status yet.
      // Status alone left a window between "admin enters the result" and
      // "admin marks it final" in which the real score is public and tips are
      // still writable — a guaranteed perfect tip worth 150 chips and 50 XP.
      if (matchup.home_score != null || matchup.away_score != null) {
        return json({ error: 'This game already has a result.', code: 'locked' }, 403);
      }
      kickoff = matchup.kickoff || '';
    }
    // Every tip needs a real kickoff: it is the only lock there is. A game
    // with no kickoff can never be time-locked, so it would stay writable
    // forever — including after full time.
    const kickoffMs = kickoff ? new Date(kickoff).getTime() : NaN;
    if (!Number.isFinite(kickoffMs)) {
      return json({ error: 'Tipping opens once the kickoff time is confirmed.', code: 'no_kickoff' }, 400);
    }
    if (kickoffMs <= Date.now()) {
      return json({ error: 'Tips are locked — this game has kicked off.', code: 'locked' }, 403);
    }

    // One entry per user (or IP for anonymous) per game — a repeat submission
    // EDITS that entry while the game is still open. The lookup is targeted
    // rather than "scan the game's first 500 rows": on a popular game the
    // caller's own entry could fall outside that window, and the miss would
    // insert a duplicate tip instead of editing.
    let mine = null;
    if (user?.id || ip) {
      let query = svc
        .from('tipping_entries')
        .select('id, user_id, ip_address, kickoff, settled_at')
        .eq('game_id', gameId);
      query = user?.id
        ? query.eq('user_id', user.id)
        // Anonymous callers match on IP — but ONLY against other anonymous
        // entries. Without the empty-user_id guard, anyone sharing a NAT/CGNAT
        // exit with a signed-in tipper could overwrite that account's tip
        // just by tipping the same game while logged out.
        : query.eq('ip_address', ip).eq('user_id', '');
      const { data: existing } = await query.limit(1);
      mine = (existing || [])[0] || null;
    }
    if (mine) {
      // Never rewrite a settled entry (results are already paid out), and for
      // API fixtures with no DB row the STORED kickoff is authoritative — a
      // client can't post a fresh future kickoff to edit after the game starts.
      const storedKickoffMs = mine.kickoff ? new Date(mine.kickoff).getTime() : NaN;
      // No stored kickoff means no lock is possible — refuse rather than
      // leave the entry editable indefinitely.
      const storedLocked = !Number.isFinite(storedKickoffMs) || storedKickoffMs <= Date.now();
      if (mine.settled_at || storedLocked) {
        return json({ error: 'Tips are locked — this game has kicked off.', code: 'locked' }, 403);
      }
      const { error: updateError } = await svc
        .from('tipping_entries')
        .update({
          selected_team: selectedTeam,
          predicted_home_score: toScore(input?.predicted_home_score),
          predicted_away_score: toScore(input?.predicted_away_score),
          margin,
          tipper_name: trimToLength(user?.full_name || input?.tipper_name, 80) || 'Vegas Fan',
        })
        .eq('id', mine.id)
        .is('settled_at', null); // belt-and-braces against a settle racing this edit
      if (updateError) throw updateError;
      return json({ ok: true, id: mine.id, updated: true });
    }

    const { data: entry, error } = await svc
      .from('tipping_entries')
      .insert({
        game_id: gameId,
        game_label: trimToLength(input?.game_label, 120) || 'NRL Fixture',
        home_team: trimToLength(input?.home_team, 80),
        away_team: trimToLength(input?.away_team, 80),
        selected_team: selectedTeam,
        predicted_home_score: toScore(input?.predicted_home_score),
        predicted_away_score: toScore(input?.predicted_away_score),
        margin,
        tipper_name: trimToLength(user?.full_name || input?.tipper_name, 80) || 'Vegas Fan',
        user_id: user?.id || '',
        user_email: user?.email || '',
        ip_address: ip || '',
        kickoff: kickoff || null,
      })
      .select('id')
      .single();
    // The one-tip-per-person rule is now held by partial unique indexes
    // (migration 0031) rather than by the read-then-insert above, which was a
    // check-then-act: two concurrent requests both saw "no existing tip", both
    // inserted, and settleTips pays per ROW — so a tipster could back both
    // teams on one game and be guaranteed a payout. Losing the race is not an
    // error for the user: their tip already exists, so apply it as an edit and
    // the two requests converge.
    if (error?.code === '23505') {
      let raced = svc
        .from('tipping_entries')
        .select('id, settled_at')
        .eq('game_id', gameId);
      raced = user?.id ? raced.eq('user_id', user.id) : raced.eq('ip_address', ip).eq('user_id', '');
      const { data: existingRow } = await raced.limit(1);
      const row = (existingRow || [])[0];
      // Unique violation but the row is unreadable: a genuine anomaly, not the
      // by-design repeat-is-an-edit path. 409 so the client retries rather than
      // discarding the tip.
      if (!row) return json({ error: 'That tip collided — please try again.', code: 'conflict' }, 409);
      await svc
        .from('tipping_entries')
        .update({
          selected_team: selectedTeam,
          predicted_home_score: toScore(input?.predicted_home_score),
          predicted_away_score: toScore(input?.predicted_away_score),
          margin,
        })
        .eq('id', row.id)
        .is('settled_at', null);
      return json({ ok: true, id: row.id, updated: true });
    }
    if (error) throw error;

    return json({ ok: true, id: entry.id });
  } catch (error) {
    console.error('submitTip error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
