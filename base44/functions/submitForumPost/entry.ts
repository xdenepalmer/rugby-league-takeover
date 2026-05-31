import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';

// Self-contained by design: Base44 deploys each function from its own directory
// and does not support cross-function imports. The forum sanitisation here mirrors
// buildPendingForumPost() in src/lib/public-forms.js — keep the two in sync.
const FORUM_CATEGORIES = ['General', 'Travel', 'Events', 'MatchDay', 'VegasTips'];

const trimToLength = (value, maxLength) => String(value ?? '').trim().slice(0, maxLength);

const isLikelyBot = (input) => Boolean(trimToLength(input?.website, 256) || trimToLength(input?.company, 256));

function resolveClientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return (req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || '').trim();
}

// Returns the first matching active, non-expired ban, or null.
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

    // Silently absorb honeypot bot submissions.
    if (isLikelyBot(input)) {
      return Response.json({ ok: true });
    }

    const category = trimToLength(input?.category || 'General', 32);
    if (!FORUM_CATEGORIES.includes(category)) {
      return Response.json({ error: 'Forum category is not supported' }, { status: 400 });
    }

    const parentId = trimToLength(input?.parent_id, 120);
    const body = trimToLength(input?.body, 2000);
    if (!body) {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }

    let authorName = trimToLength(user?.full_name || input?.author_name, 80) || 'Anonymous';
    const ip = resolveClientIp(req);

    const ban = await findActiveBan(base44, { ip, emails: [user?.email], userId: user?.id });
    if (ban) {
      return Response.json({ error: 'Your account or connection has been blocked from posting.', code: 'blocked' }, { status: 403 });
    }

    const post = await base44.asServiceRole.entities.ForumPost.create({
      author_name: authorName,
      title: trimToLength(input?.title || (parentId ? 'Reply' : 'Discussion Thread'), 120),
      body,
      category,
      parent_id: parentId,
      is_published: false,
      is_pinned: false,
      ip_address: ip,
      user_email: user?.email || '',
      user_id: user?.id || ''
    });

    return Response.json({ ok: true, id: post.id });
  } catch (error) {
    console.error('submitForumPost error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
