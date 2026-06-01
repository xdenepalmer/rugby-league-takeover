import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';

// Returns a minimal per-user map for forum rendering: the LATEST avatar plus the
// optional location/team the member chose to display next to their name. Base44
// blocks client-side User.list, so this runs service-role. Privacy is enforced
// HERE — location/team are only returned when the user opted in. No emails or
// other PII are exposed.
const clean = (v) => String(v ?? '').trim();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);

    const avatars = (users || [])
      .filter((u) => u && u.id)
      .map((u) => {
        const city = clean(u.city);
        const country = clean(u.country);
        const location = u.show_location_on_forum
          ? [city, country].filter(Boolean).join(', ')
          : '';
        const team = u.show_team_on_forum ? clean(u.favourite_team) : '';
        return {
          id: u.id,
          avatar_url: clean(u.avatar_url),
          location,
          team,
        };
      })
      // Only include rows that carry something useful for the forum.
      .filter((row) => row.avatar_url || row.location || row.team);

    return Response.json({ avatars });
  } catch (error) {
    console.error('forumAvatars error:', error);
    return Response.json({ avatars: [] });
  }
});
