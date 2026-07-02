// Lightweight user search for @mention autocomplete. Authenticated users only;
// returns minimal public fields (no email exposure beyond the handle).
import { json, preflight, serviceClient, getCaller } from './shared.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const me = await getCaller(req, svc);
    if (!me) return json({ users: [] });

    const { q } = await req.json().catch(() => ({}));
    const query = String(q || '').trim().toLowerCase();

    const { data: all } = await svc
      .from('profiles')
      .select('id, full_name, email, disabled')
      .order('created_date', { ascending: false })
      .limit(500);

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

    return json({ users: matched });
  } catch (error) {
    console.error('searchUsers error:', error);
    return json({ users: [] });
  }
});
