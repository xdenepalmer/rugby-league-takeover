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
        // Membership is a BOOLEAN here and nothing more: whether someone pays
        // is public (they wear the badge), but when they joined, when they
        // lapse and their member number are not. Evaluated against now() on
        // every call — there is no expiry sweep, so a lapsed member loses the
        // badge the moment their term ends.
        const isMember = !!u.membership_expires_at && new Date(u.membership_expires_at).getTime() > Date.now();
        return {
          id: u.id,
          avatar_url: clean(u.avatar_url),
          display_name: clean(u.full_name) || 'Member',
          location,
          team,
          badges,
          is_member: isMember,
          casino_rank: clean(u.casino_rank) || 'Rookie Punter',
          casino_xp: num(u.casino_xp),
          casino_chips: num(u.casino_chips),
          casino_streak: num(u.casino_streak),
        };
      })
      // A member with an otherwise-empty profile must still reach the feed, or
      // they'd pay for a badge that never renders.
      .filter((row) => row.avatar_url || row.location || row.team || row.badges.length || row.casino_xp > 0 || row.is_member);

    return json({ avatars });
  } catch (error) {
    console.error('forumAvatars error:', error);
    return json({ avatars: [] });
  }
});
