import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Admin-only user management. Base44 blocks client-side User.list/update, so the
// admin panel calls this function; it verifies the caller is an admin, then uses
// the service role (admin-level) to list and update users.
const SAFE_FIELDS = ['id', 'email', 'full_name', 'role', 'disabled', 'is_verified', 'created_date', 'phone', 'postcode', 'favourite_team', 'avatar_url', 'marketing_opt_in'];

const pick = (user) => {
  const out = {};
  for (const key of SAFE_FIELDS) out[key] = user?.[key];
  return out;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let me = null;
    try {
      me = await base44.auth.me();
    } catch {
      me = null;
    }
    if (!me || me.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { action, userId, data } = await req.json().catch(() => ({}));

    if (action === 'list') {
      const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
      return Response.json({ users: (users || []).map(pick) });
    }

    if (action === 'update') {
      if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 });
      // Only allow safe admin-managed fields; never let role escalation through arbitrary keys.
      const allowed = {};
      for (const key of ['role', 'disabled']) {
        if (data && key in data) allowed[key] = data[key];
      }
      if (allowed.role && !['admin', 'moderator', 'user'].includes(allowed.role)) {
        return Response.json({ error: 'Invalid role' }, { status: 400 });
      }
      // Guard: an admin cannot disable or demote their own account here.
      if (userId === me.id && (allowed.disabled === true || (allowed.role && allowed.role !== 'admin'))) {
        return Response.json({ error: 'You cannot disable or demote your own account' }, { status: 400 });
      }
      if (allowed.role && allowed.role !== 'admin') {
        const target = await base44.asServiceRole.entities.User.get(userId);
        if (target?.role === 'admin') {
          const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' }, '-created_date', 2);
          if ((admins || []).length <= 1) {
            return Response.json({ error: 'At least one admin must remain' }, { status: 400 });
          }
        }
      }
      const updated = await base44.asServiceRole.entities.User.update(userId, allowed);
      return Response.json({ user: pick(updated) });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('adminUsers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});