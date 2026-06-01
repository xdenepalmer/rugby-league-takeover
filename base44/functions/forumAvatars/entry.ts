import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';

// Returns a minimal map of user id -> current avatar URL so the forum can render
// each author's LATEST profile photo (not the snapshot stored when they posted).
// Base44 blocks client-side User.list, so this runs service-role. Only ids and
// avatar URLs are returned — no emails or other PII.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);
    const avatars = (users || [])
      .filter((u) => u && u.id && u.avatar_url)
      .map((u) => ({ id: u.id, avatar_url: u.avatar_url }));
    return Response.json({ avatars });
  } catch (error) {
    console.error('forumAvatars error:', error);
    return Response.json({ avatars: [] });
  }
});
