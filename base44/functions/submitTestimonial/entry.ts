import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';

// Self-contained by design: Base44 deploys each function from its own directory
// and does not support cross-function imports. Public visitors can submit a
// testimonial; it is created UNPUBLISHED so an admin can moderate it before it
// appears on the homepage.
const trimToLength = (value, maxLength) => String(value ?? '').trim().slice(0, maxLength);
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

    const author_name = trimToLength(input?.author_name, 80);
    const quote = trimToLength(input?.quote, 1000);
    if (!author_name) return Response.json({ error: 'Name is required' }, { status: 400 });
    if (!quote) return Response.json({ error: 'Testimonial text is required' }, { status: 400 });

    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }

    const ip = resolveClientIp(req);
    const ban = await findActiveBan(base44, { ip, emails: [user?.email], userId: user?.id });
    if (ban) {
      return Response.json({ error: 'Your account or connection has been blocked.', code: 'blocked' }, { status: 403 });
    }

    let rating = Number(input?.rating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) rating = 0;

    await base44.asServiceRole.entities.Testimonial.create({
      author_name,
      author_role: trimToLength(input?.author_role, 120),
      quote,
      avatar_url: '',
      rating: Math.round(rating),
      sort_order: 100,
      is_published: false,
      ip_address: ip,
      user_email: user?.email || '',
      user_id: user?.id || ''
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('submitTestimonial error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
