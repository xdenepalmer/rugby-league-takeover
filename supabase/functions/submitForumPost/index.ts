// Forum thread/reply submission: sanitisation, profanity censoring, honeypot,
// ban checks, casino rewards, and reply/mention notification fan-out.
// The forum sanitisation mirrors buildPendingForumPost() in src/lib/public-forms.js.
import {
  json, preflight, serviceClient, getCaller, trimToLength, isLikelyBot,
  resolveClientIp, findActiveBan, censorProfanity, FORUM_CATEGORIES,
  awardForumReward, getForumPost,
} from './shared.ts';

// Extract unique lowercased @mention tokens from a body.
function extractMentions(body: unknown) {
  const matches = String(body || '').match(/@([a-zA-Z0-9_.+-]+)/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

// Does a user match any mention token (by email, email local-part, full name, or first name)?
// deno-lint-ignore no-explicit-any
function matchesMention(u: any, tokens: string[]) {
  const candidates = new Set<string>();
  const email = String(u?.email || '').toLowerCase();
  if (email) { candidates.add(email); candidates.add(email.split('@')[0]); }
  const name = String(u?.full_name || '').toLowerCase();
  if (name) { candidates.add(name.replace(/\s+/g, '')); candidates.add(name.split(/\s+/)[0]); }
  return tokens.some((t) => candidates.has(t));
}

// Best-effort notification fan-out for a new post/reply. Never throws.
// deno-lint-ignore no-explicit-any
async function createForumNotifications(svc: any, { post, parentId, actor, authorName, body }: any) {
  try {
    const threadId = parentId || post.id;
    const recipients = new Map<string, { email: string; type: string; title: string }>();

    if (parentId) {
      const parent = await getForumPost(svc, parentId);
      if (parent?.user_id && parent.user_id !== actor?.id) {
        recipients.set(parent.user_id, { email: parent.user_email || '', type: 'reply', title: `${authorName} replied to your post` });
      }
    }

    const tokens = extractMentions(body);
    if (tokens.length) {
      const { data: users } = await svc
        .from('profiles')
        .select('id, email, full_name')
        .order('created_date', { ascending: false })
        .limit(500);
      for (const u of users || []) {
        if (!u?.id || u.id === actor?.id) continue;
        if (matchesMention(u, tokens)) {
          recipients.set(u.id, { email: u.email || '', type: 'mention', title: `${authorName} mentioned you` });
        }
      }
    }

    for (const [recipientId, info] of recipients) {
      await svc.from('notifications').insert({
        recipient_id: recipientId,
        recipient_email: info.email,
        type: info.type,
        title: info.title,
        preview: String(body || '').slice(0, 140),
        actor_name: authorName,
        post_id: threadId,
        link: `/forum?thread=${threadId}`,
        is_read: false,
      });
    }
  } catch (error) {
    console.error('createForumNotifications error:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const input = await req.json();

    // Silently absorb honeypot bot submissions.
    if (isLikelyBot(input)) return json({ ok: true });

    const category = trimToLength(input?.category || 'General', 32);
    if (!FORUM_CATEGORIES.includes(category)) {
      return json({ error: 'Forum category is not supported' }, 400);
    }

    const parentId = trimToLength(input?.parent_id, 120);
    const body = censorProfanity(trimToLength(input?.body, 2000));
    if (!body) return json({ error: 'Message is required' }, 400);

    const user = await getCaller(req, svc);
    const authorName = trimToLength(user?.full_name || input?.author_name, 80) || 'Anonymous';
    const ip = resolveClientIp(req);

    const mediaUrl = trimToLength(input?.media_url, 600);
    const mediaExt = mediaUrl.split('?')[0].split('.').pop()?.toLowerCase();
    const mediaType = trimToLength(input?.media_type, 16)
      || (mediaUrl ? (['mp4', 'webm', 'mov', 'ogg'].includes(mediaExt || '') ? 'video' : mediaExt === 'gif' ? 'gif' : 'image') : '');

    const ban = await findActiveBan(svc, { ip, emails: [user?.email], userId: user?.id });
    if (ban) {
      return json({ error: 'Your account or connection has been blocked from posting.', code: 'blocked' }, 403);
    }

    const { data: post, error } = await svc
      .from('forum_posts')
      .insert({
        author_name: authorName,
        title: censorProfanity(trimToLength(input?.title || (parentId ? 'Reply' : 'Discussion Thread'), 120)),
        body,
        category,
        parent_id: parentId || null,
        is_published: true,
        is_pinned: false,
        ip_address: ip,
        user_email: user?.email || '',
        user_id: user?.id || '',
        author_avatar: trimToLength(user?.avatar_url, 600),
        media_url: mediaUrl,
        media_type: mediaType,
      })
      .select('id')
      .single();
    if (error) throw error;

    const reward = await awardForumReward(svc, user, parentId
      ? { kind: 'reply', xp: 12, chips: 25, postId: post.id, note: 'Posted a forum reply', counter: 'casino_total_replies' }
      : { kind: 'thread', xp: 30, chips: 60, postId: post.id, note: 'Started a forum thread', counter: 'casino_total_posts' });
    await createForumNotifications(svc, { post, parentId, actor: user, authorName, body });

    return json({ ok: true, id: post.id, reward });
  } catch (error) {
    console.error('submitForumPost error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
