import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';

// Lightweight user search for @mention autocomplete. Base44 blocks client-side
// User.list, so authenticated users hit this; it returns minimal public fields
// only (no email exposure beyond the handle used for matching display).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let me = null;
    try {
      me = await base44.auth.me();
    } catch {
      me = null;
    }
    if (!me) return Response.json({ users: [] });

    const { q } = await req.json().catch(() => ({}));
    const query = String(q || '').trim().toLowerCase();

    const all = await base44.asServiceRole.entities.User.list('-created_date', 500);
    const matched = (all || [])
      .filter((u) => {
        if (!u || u.disabled) return false;
        if (!query) return true;
        const name = String(u.full_name || '').toLowerCase();
        const handle = String(u.email || '').split('@')[0].toLowerCase();
        return name.includes(query) || handle.includes(query);
      })
      .slice(0, 8)
      .map((u) => ({
        id: u.id,
        name: u.full_name || String(u.email || '').split('@')[0],
        handle: String(u.email || '').split('@')[0],
      }));

    return Response.json({ users: matched });
  } catch (error) {
    console.error('searchUsers error:', error);
    return Response.json({ users: [] });
  }
});
