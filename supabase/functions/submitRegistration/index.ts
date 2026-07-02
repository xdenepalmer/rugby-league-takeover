// Public travel-interest registration. Mirrors normalizeInterestRegistration()
// in src/lib/public-forms.js — keep the two in sync.
import { json, preflight, serviceClient, getCaller, trimToLength, isEmail, isLikelyBot, resolveClientIp, findActiveBan } from './shared.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const input = await req.json();

    if (isLikelyBot(input)) return json({ ok: true });

    const name = trimToLength(input?.name, 120);
    const email = trimToLength(input?.email, 200).toLowerCase();
    const team = trimToLength(input?.team_supported, 40);

    if (!name) return json({ error: 'Name is required' }, 400);
    if (!isEmail(email)) return json({ error: 'A valid email address is required' }, 400);
    if (!team) return json({ error: 'Team supported is required' }, 400);
    if (input?.consent_to_contact !== true) {
      return json({ error: 'Contact consent is required' }, 400);
    }

    const user = await getCaller(req, svc);
    const ip = resolveClientIp(req);
    const ban = await findActiveBan(svc, { ip, emails: [email, user?.email], userId: user?.id });
    if (ban) {
      return json({ error: 'Your account or connection has been blocked.', code: 'blocked' }, 403);
    }

    const { data: registration, error } = await svc
      .from('interest_registrations')
      .insert({
        name,
        phone: trimToLength(input?.phone, 40),
        email,
        postcode: trimToLength(input?.postcode, 20),
        team_supported: team,
        trip_details: trimToLength(input?.trip_details, 1000),
        fan_events_only: input?.fan_events_only === true,
        consent_to_contact: true,
        consent_timestamp: new Date().toISOString(),
        source: 'homepage_travel_form',
        ip_address: ip,
        user_email: user?.email || '',
        user_id: user?.id || '',
      })
      .select('id')
      .single();
    if (error) throw error;

    return json({ ok: true, id: registration.id });
  } catch (error) {
    console.error('submitRegistration error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
