// Admin-only user management. Verifies the caller is an admin, then uses the
// service role to list and update profiles.
import { json, preflight, serviceClient, getCaller } from './shared.ts';

const SAFE_FIELDS = ['id', 'email', 'full_name', 'role', 'disabled', 'is_verified', 'created_date', 'phone', 'postcode', 'favourite_team', 'avatar_url', 'marketing_opt_in'];

// deno-lint-ignore no-explicit-any
const pick = (user: any) => {
  const out: Record<string, unknown> = {};
  for (const key of SAFE_FIELDS) out[key] = user?.[key];
  return out;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const me = await getCaller(req, svc);
    if (!me || me.role !== 'admin') {
      return json({ error: 'Admin access required' }, 403);
    }

    const { action, userId, data } = await req.json().catch(() => ({}));

    if (action === 'list') {
      const { data: users } = await svc
        .from('profiles')
        .select('*')
        .order('created_date', { ascending: false })
        .limit(500);
      return json({ users: (users || []).map(pick) });
    }

    if (action === 'update') {
      if (!userId) return json({ error: 'userId is required' }, 400);
      // Only allow safe admin-managed fields; never let role escalation through arbitrary keys.
      const allowed: Record<string, unknown> = {};
      for (const key of ['role', 'disabled']) {
        if (data && key in data) allowed[key] = data[key];
      }
      if (allowed.role && !['admin', 'moderator', 'user'].includes(allowed.role as string)) {
        return json({ error: 'Invalid role' }, 400);
      }
      // Guard: an admin cannot disable or demote their own account here.
      if (userId === me.id && (allowed.disabled === true || (allowed.role && allowed.role !== 'admin'))) {
        return json({ error: 'You cannot disable or demote your own account' }, 400);
      }
      if (allowed.role && allowed.role !== 'admin') {
        const { data: target } = await svc.from('profiles').select('role').eq('id', userId).maybeSingle();
        if (target?.role === 'admin') {
          const { data: admins } = await svc.from('profiles').select('id').eq('role', 'admin').limit(2);
          if ((admins || []).length <= 1) {
            return json({ error: 'At least one admin must remain' }, 400);
          }
        }
      }
      const { data: updated, error } = await svc
        .from('profiles')
        .update(allowed)
        .eq('id', userId)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return json({ user: pick(updated) });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('adminUsers error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
