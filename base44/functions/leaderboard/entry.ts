import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';

// Fan leaderboard. Base44 blocks client-side User.list, so authenticated users
// hit this; it returns a privacy-safe projection only (display name + avatar +
// rank/xp/chips, NEVER email). Mirrors searchUsers' auth + projection posture.
//
// Scopes:
//   alltime — top fans by casino_xp
//   weekly  — top fans by XP earned in the last 7 days (from ForumRewardEvent)
//   team    — alltime, filtered to the caller's favourite_team
//
// safeDisplayName mirrors src/lib/leaderboard.js — keep in sync.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function safeDisplayName(fullName, email) {
  const name = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (name) {
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0];
    const last = parts[parts.length - 1];
    return `${parts[0]} ${last.charAt(0).toUpperCase()}.`;
  }
  const handle = String(email || '').split('@')[0].trim();
  return handle || 'Fan';
}

function project(u, rank, weeklyXp) {
  return {
    rank,
    user_id: u.id,
    name: safeDisplayName(u.full_name, u.email),
    avatar: u.avatar_url || '',
    fan_rank: u.casino_rank || 'Rookie Punter',
    xp: num(u.casino_xp),
    chips: num(u.casino_chips),
    weekly_xp: num(weeklyXp),
    team: u.favourite_team || '',
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let me = null;
    try {
      me = await base44.auth.me();
    } catch {
      me = null;
    }
    if (!me?.id) return Response.json({ error: 'Login required' }, { status: 401 });

    const { scope = 'alltime', limit } = await req.json().catch(() => ({}));
    const top = Math.min(Math.max(num(limit) || 20, 1), 100);

    const all = (await base44.asServiceRole.entities.User.list('-casino_xp', 500)) || [];
    const active = all.filter((u) => u && !u.disabled);

    // Weekly XP totals from the reward log (last 7 days).
    const weeklyById = {};
    if (scope === 'weekly') {
      const cutoff = Date.now() - WEEK_MS;
      const events = (await base44.asServiceRole.entities.ForumRewardEvent.list('-created_date', 2000)) || [];
      for (const e of events) {
        const t = new Date(e.created_date || e.created_at || 0).getTime();
        if (!t || t < cutoff) continue;
        if (!e.user_id) continue;
        weeklyById[e.user_id] = num(weeklyById[e.user_id]) + num(e.xp);
      }
    }

    const myTeam = String(me.favourite_team || '').toLowerCase();

    let pool;
    if (scope === 'weekly') {
      pool = active
        .map((u) => ({ u, w: num(weeklyById[u.id]) }))
        .filter((x) => x.w > 0)
        .sort((a, b) => b.w - a.w);
    } else if (scope === 'team') {
      pool = active
        .filter((u) => myTeam && String(u.favourite_team || '').toLowerCase() === myTeam && num(u.casino_xp) > 0)
        .map((u) => ({ u, w: 0 }));
    } else {
      pool = active.filter((u) => num(u.casino_xp) > 0).map((u) => ({ u, w: 0 }));
    }

    const ranked = pool.map((x, i) => project(x.u, i + 1, x.w));
    const entries = ranked.slice(0, top);

    // The caller's own position, even when outside the visible top N.
    const mine = ranked.find((e) => e.user_id === me.id) || null;

    return Response.json({
      ok: true,
      scope,
      entries,
      me: mine,
      hasTeam: !!myTeam,
      total: ranked.length,
    });
  } catch (error) {
    console.error('leaderboard error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
