// Admin-only: invite a new member by email. Sends a Supabase Auth invite
// email; the handle_new_auth_user trigger creates their profile, then the
// requested role is applied. If the auth user already exists, just ensures
// the profile role.
import { json, preflight, serviceClient, getCaller, isEmail } from './shared.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const me = await getCaller(req, svc);
    if (!me || me.role !== 'admin') {
      return json({ error: 'Admin access required' }, 403);
    }

    const { email, role = 'user' } = await req.json().catch(() => ({}));
    const target = String(email || '').trim().toLowerCase();
    if (!isEmail(target)) return json({ error: 'A valid email is required' }, 400);
    if (!['admin', 'moderator', 'user'].includes(role)) {
      return json({ error: 'Invalid role' }, 400);
    }

    const redirectTo = Deno.env.get('SITE_URL')
      ? `${Deno.env.get('SITE_URL')}/account`
      : 'https://rugbyleaguetakeover.com/account';

    const { error: inviteError } = await svc.auth.admin.inviteUserByEmail(target, { redirectTo });
    if (inviteError && !/already/i.test(inviteError.message || '')) {
      return json({ error: inviteError.message || 'Invite could not be sent' }, 400);
    }

    // Apply the requested role to the (pre-existing or trigger-created) profile.
    const { data: profile } = await svc
      .from('profiles')
      .select('id, role')
      .ilike('email', target)
      .maybeSingle();
    if (profile) {
      if (profile.role !== role) {
        await svc.from('profiles').update({ role }).eq('id', profile.id);
      }
    } else {
      await svc.from('profiles').insert({ email: target, role, full_name: target.split('@')[0] });
    }

    return json({ ok: true, invited: target, role, alreadyExisted: !!inviteError });
  } catch (error) {
    console.error('inviteUser error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
