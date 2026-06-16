import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Server-authoritative tip submission. Tips must lock at kickoff — the client
// disables the UI past kickoff, but TippingEntry.create is locked down (admin
// only) so this function is the sole write path and re-checks the deadline
// server-side. For admin-managed Matchup games the kickoff is read from the DB
// (authoritative); for external-API fixtures (synthetic id, no DB row) we fall
// back to the client-supplied kickoff. Mirrors the ban posture of the other
// submit functions. Self-contained (Base44 has no cross-function imports).

const trimToLength = (value, maxLength) => String(value ?? '').trim().slice(0, maxLength);
const toScore = (value) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 0 && n <= 200 ? n : 0;
};

function resolveClientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return (req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || '').trim();
}

async function findActiveBan(base44, { ip, emails = [], userId }) {
  const now = Date.now();
  const candidates = [];
  if (ip) candidates.push({ ban_type: 'ip', value: ip.toLowerCase() });
  for (const email of emails) {
    if (email) candidates.push({ ban_type: 'email', value: String(email).toLowerCase() });
  }
  if (userId) candidates.push({ ban_type: 'user', value: String(userId).toLowerCase() });
  for (const candidate of candidates) {
    const matches = await base44.asServiceRole.entities.Ban.filter({ ...candidate, is_active: true });
    for (const ban of matches || []) {
      if (!ban.expires_at || new Date(ban.expires_at).getTime() > now) return ban;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const input = await req.json().catch(() => ({}));

    const gameId = trimToLength(input?.game_id, 120);
    const selectedTeam = trimToLength(input?.selected_team, 80);
    const margin = Math.floor(Number(input?.margin));

    if (!gameId) return Response.json({ error: 'game_id is required' }, { status: 400 });
    if (!selectedTeam) return Response.json({ error: 'A selected team is required' }, { status: 400 });
    if (!Number.isFinite(margin) || margin < 1 || margin > 60) {
      return Response.json({ error: 'Margin must be between 1 and 60' }, { status: 400 });
    }

    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }
    const ip = resolveClientIp(req);

    const ban = await findActiveBan(base44, { ip, emails: [user?.email], userId: user?.id });
    if (ban) {
      return Response.json({ error: 'Your account or connection has been blocked.', code: 'blocked' }, { status: 403 });
    }

    // Authoritative kickoff for admin-managed games; fall back to the client
    // value for external-API fixtures that have no DB row.
    let kickoff = trimToLength(input?.kickoff, 40);
    let matchup = null;
    try {
      matchup = await base44.asServiceRole.entities.Matchup.get(gameId);
    } catch {
      matchup = null;
    }
    if (matchup?.kickoff) kickoff = matchup.kickoff;
    if (matchup && (matchup.status === 'finished' || matchup.status === 'live')) {
      return Response.json({ error: 'This game is no longer open for tips.', code: 'locked' }, { status: 403 });
    }
    if (kickoff) {
      const kickoffMs = new Date(kickoff).getTime();
      if (Number.isFinite(kickoffMs) && kickoffMs <= Date.now()) {
        return Response.json({ error: 'Tips are locked — this game has kicked off.', code: 'locked' }, { status: 403 });
      }
    }

    // One tip per user (or IP for anonymous) per game.
    const existing = await base44.asServiceRole.entities.TippingEntry.filter({ game_id: gameId }, '-created_date', 500);
    const alreadyTipped = (existing || []).some((e) =>
      (user?.id && String(e.user_id || '') === String(user.id)) ||
      (!user?.id && ip && String(e.reporter_ip || e.ip || '') === ip));
    if (alreadyTipped) {
      return Response.json({ error: 'You have already tipped this game.', code: 'duplicate' }, { status: 409 });
    }

    const entry = await base44.asServiceRole.entities.TippingEntry.create({
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
      kickoff: kickoff || '',
    });

    return Response.json({ ok: true, id: entry.id });
  } catch (error) {
    console.error('submitTip error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
