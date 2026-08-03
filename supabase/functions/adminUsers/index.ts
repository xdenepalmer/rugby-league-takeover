// Admin-only user management. Verifies the caller is an admin, then uses the
// service role to list and update profiles.
import { json, preflight, serviceClient, getCaller } from './shared.ts';

const SAFE_FIELDS = ['id', 'email', 'full_name', 'role', 'disabled', 'is_verified', 'created_date', 'phone', 'postcode', 'favourite_team', 'avatar_url', 'marketing_opt_in',
  // Membership is admin-managed: without these the People screen can't show
  // who is a paid-up member, and a comped or refunded membership would have
  // no home but the SQL editor.
  'membership_number', 'membership_started_at', 'membership_expires_at', 'membership_source'];

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

    // Grant or extend a membership by hand: comps, a guest checkout that
    // couldn't be matched to an account, or making good on a support case.
    // Routed through the same RPC as a paid order, so renewal semantics
    // (extend from the current expiry, never lose paid time) are identical.
    if (action === 'grantMembership') {
      if (!userId) return json({ error: 'userId is required' }, 400);
      const months = Math.floor(Number(data?.months));
      if (!Number.isFinite(months) || months < 1 || months > 120) {
        return json({ error: 'Months must be between 1 and 120' }, 400);
      }
      const { data: result, error } = await svc.rpc('grant_membership', {
        p_profile_id: userId,
        p_months: months,
        p_source: `admin:${me.id}`,
      });
      if (error) throw error;
      if (result?.result === 'no_profile') return json({ error: 'User not found' }, 404);
      const { data: updated } = await svc.from('profiles').select('*').eq('id', userId).maybeSingle();
      return json({ ok: true, membership: result, user: updated ? pick(updated) : null });
    }

    if (action === 'revokeMembership') {
      if (!userId) return json({ error: 'userId is required' }, 400);
      const { data: result, error } = await svc.rpc('revoke_membership', {
        p_profile_id: userId,
        p_source: `admin-revoked:${me.id}`,
      });
      if (error) throw error;
      if (result?.result === 'no_profile') return json({ error: 'User not found' }, 404);
      const { data: updated } = await svc.from('profiles').select('*').eq('id', userId).maybeSingle();
      return json({ ok: true, user: updated ? pick(updated) : null });
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
