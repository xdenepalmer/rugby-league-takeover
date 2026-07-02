// Returns a minimal per-user map for forum rendering: latest avatar plus the
// optional location/team the member chose to display. Privacy is enforced
// HERE — location/team are only returned when the user opted in.
import { json, preflight, serviceClient, num } from './shared.ts';

const clean = (v: unknown) => String(v ?? '').trim();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const { data: users } = await svc
      .from('profiles')
      .select('*')
      .order('created_date', { ascending: false })
      .limit(1000);

    const avatars = (users || [])
      .filter((u) => u && u.id && !u.disabled)
      .map((u) => {
        const city = clean(u.city);
        const country = clean(u.country);
        const location = u.show_location_on_forum
          ? [city, country].filter(Boolean).join(', ')
          : '';
        const team = u.show_team_on_forum ? clean(u.favourite_team) : '';
        const badges = Array.isArray(u.badges) ? u.badges.filter(Boolean) : [];
        return {
          id: u.id,
          avatar_url: clean(u.avatar_url),
          display_name: clean(u.full_name) || 'Member',
          location,
          team,
          badges,
          casino_rank: clean(u.casino_rank) || 'Rookie Punter',
          casino_xp: num(u.casino_xp),
          casino_chips: num(u.casino_chips),
          casino_streak: num(u.casino_streak),
        };
      })
      .filter((row) => row.avatar_url || row.location || row.team || row.badges.length || row.casino_xp > 0);

    return json({ avatars });
  } catch (error) {
    console.error('forumAvatars error:', error);
    return json({ avatars: [] });
  }
});
