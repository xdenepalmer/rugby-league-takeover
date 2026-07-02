// Fan leaderboard. Authenticated users only; returns a privacy-safe projection
// (display name + avatar + rank/xp/chips, NEVER email).
// Scopes: alltime | weekly | team — see src/lib/leaderboard.js.
import { json, preflight, serviceClient, getCaller, num } from './shared.ts';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function safeDisplayName(fullName: unknown, email: unknown) {
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

// deno-lint-ignore no-explicit-any
function project(u: any, rank: number, weeklyXp: number) {
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
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const me = await getCaller(req, svc);
    if (!me?.id) return json({ error: 'Login required' }, 401);

    const { scope = 'alltime', limit } = await req.json().catch(() => ({}));
    const top = Math.min(Math.max(num(limit) || 20, 1), 100);

    const { data: all } = await svc
      .from('profiles')
      .select('*')
      .order('casino_xp', { ascending: false })
      .limit(500);
    const active = (all || []).filter((u) => u && !u.disabled);

    // Weekly XP totals from the reward log (last 7 days).
    const weeklyById: Record<string, number> = {};
    if (scope === 'weekly') {
      const cutoff = Date.now() - WEEK_MS;
      const { data: events } = await svc
        .from('forum_reward_events')
        .select('user_id, xp, created_date')
        .order('created_date', { ascending: false })
        .limit(2000);
      for (const e of events || []) {
        const t = new Date(e.created_date || 0).getTime();
        if (!t || t < cutoff) continue;
        if (!e.user_id) continue;
        weeklyById[e.user_id] = num(weeklyById[e.user_id]) + num(e.xp);
      }
    }

    const myTeam = String(me.favourite_team || '').toLowerCase();

    // deno-lint-ignore no-explicit-any
    let pool: { u: any; w: number }[];
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
    const mine = ranked.find((e) => e.user_id === me.id) || null;

    return json({
      ok: true,
      scope,
      entries,
      me: mine,
      hasTeam: !!myTeam,
      total: ranked.length,
    });
  } catch (error) {
    console.error('leaderboard error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
