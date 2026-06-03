import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';

// Self-contained by design: Base44 deploys each function from its own directory
// and does not support cross-function imports. This mirrors
// normalizeInterestRegistration() in src/lib/public-forms.js — keep the two in sync.
// Teams are admin-managed (Team entity) and dynamic, so team_supported is accepted
// as any non-empty, length-capped string rather than gated on a fixed list.

const trimToLength = (value, maxLength) => String(value ?? '').trim().slice(0, maxLength);
const isEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isLikelyBot = (input) => Boolean(trimToLength(input?.website, 256) || trimToLength(input?.company, 256));

function resolveClientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return (req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || '').trim();
}

async function findActiveBan(base44, { ip, emails = [], userId }) {
  const now = Date.now();
  const candidates = [];
  if (ip) candidates.push({ ban_type: 'ip', value: ip.toLowerCase() });
  for (const email of emails) {
    if (email) candidates.push({ ban_type: 'email', value: String(email).toLowerCase() });
  }
  if (userId) candidates.push({ ban_type: 'user', value: String(userId).toLowerCase() });

  for (const candidate of candidates) {
    const matches = await base44.asServiceRole.entities.Ban.filter({ ...candidate, is_active: true });
    for (const ban of matches || []) {
      if (!ban.expires_at || new Date(ban.expires_at).getTime() > now) return ban;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const input = await req.json();

    if (isLikelyBot(input)) {
      return Response.json({ ok: true });
    }

    const name = trimToLength(input?.name, 120);
    const email = trimToLength(input?.email, 200).toLowerCase();
    const team = trimToLength(input?.team_supported, 40);

    if (!name) return Response.json({ error: 'Name is required' }, { status: 400 });
    if (!isEmail(email)) return Response.json({ error: 'A valid email address is required' }, { status: 400 });
    // Teams are admin-managed (Team entity) and dynamic — accept any non-empty,
    // length-capped value rather than gating on a hardcoded list.
    if (!team) return Response.json({ error: 'Team supported is required' }, { status: 400 });
    if (input?.consent_to_contact !== true) return Response.json({ error: 'Contact consent is required' }, { status: 400 });

    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }

    const ip = resolveClientIp(req);
    const ban = await findActiveBan(base44, { ip, emails: [email, user?.email], userId: user?.id });
    if (ban) {
      return Response.json({ error: 'Your account or connection has been blocked.', code: 'blocked' }, { status: 403 });
    }

    const registration = await base44.asServiceRole.entities.InterestRegistration.create({
      name,
      phone: trimToLength(input?.phone, 40),
      email,
      postcode: trimToLength(input?.postcode, 20),
      team_supported: team,
      trip_details: trimToLength(input?.trip_details, 1000),
      consent_to_contact: true,
      consent_timestamp: new Date().toISOString(),
      source: 'homepage_travel_form',
      ip_address: ip,
      user_email: user?.email || '',
      user_id: user?.id || ''
    });

    return Response.json({ ok: true, id: registration.id });
  } catch (error) {
    console.error('submitRegistration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});