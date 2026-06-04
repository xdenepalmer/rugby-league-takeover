import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Self-contained by design: Base44 deploys each function from its own directory
// and does not support cross-function imports. The forum sanitisation here mirrors
// buildPendingForumPost() in src/lib/public-forms.js — keep the two in sync.
const FORUM_CATEGORIES = ['General', 'Travel', 'Events', 'MatchDay', 'VegasTips'];

const trimToLength = (value, maxLength) => String(value ?? '').trim().slice(0, maxLength);

// Automatic profanity censoring. Word-boundary match, keeps the first letter and
// masks the rest (e.g. "shit" -> "s***"). Applied to post body and title.
const PROFANITY = [
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bullshit', 'bitch', 'cunt',
  'asshole', 'arsehole', 'bastard', 'dickhead', 'piss', 'slut', 'whore', 'wanker',
  'prick', 'bollocks', 'bugger', 'twat', 'fag', 'faggot', 'nigger', 'nigga', 'retard',
];
const PROFANITY_RE = new RegExp(`\\b(${PROFANITY.join('|')})\\b`, 'gi');
const censorProfanity = (text) =>
  String(text || '').replace(PROFANITY_RE, (match) => match[0] + '*'.repeat(Math.max(match.length - 1, 1)));

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

// Extract unique lowercased @mention tokens from a body.
function extractMentions(body) {
  const matches = String(body || '').match(/@([a-zA-Z0-9_.+-]+)/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

// Does a user match any mention token (by email, email local-part, full name, or first name)?
function matchesMention(u, tokens) {
  const candidates = new Set();
  const email = String(u?.email || '').toLowerCase();
  if (email) { candidates.add(email); candidates.add(email.split('@')[0]); }
  const name = String(u?.full_name || '').toLowerCase();
  if (name) { candidates.add(name.replace(/\s+/g, '')); candidates.add(name.split(/\s+/)[0]); }
  return tokens.some((t) => candidates.has(t));
}

const CASINO_RANKS = [
  { min: 2500, name: 'Vegas Royalty' }, { min: 1500, name: 'Whale' }, { min: 900, name: 'High Roller' },
  { min: 450, name: 'Pit Boss' }, { min: 180, name: 'Table Regular' }, { min: 60, name: 'Lucky Local' }, { min: 0, name: 'Rookie Punter' },
];
const todayKey = () => new Date().toISOString().slice(0, 10);
const rankForXp = (xp) => CASINO_RANKS.find((r) => xp >= r.min)?.name || 'Rookie Punter';
async function awardForumReward(base44, user, { kind, xp, chips, postId, note, counter }) {
  if (!user?.id) return null;
  try {
    const fullUser = await base44.asServiceRole.entities.User.get(user.id);
    const today = todayKey();
    const last = String(fullUser?.casino_last_active_date || '');
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const streak = last === today ? Number(fullUser?.casino_streak || 0) : last === yesterday ? Number(fullUser?.casino_streak || 0) + 1 : 1;
    const streakBonus = last === today ? 0 : Math.min(50, streak * 5);
    const nextXp = Number(fullUser?.casino_xp || 0) + xp + streakBonus;
    const nextChips = Number(fullUser?.casino_chips || 0) + chips + streakBonus;
    const rank = rankForXp(nextXp);
    const data = { casino_xp: nextXp, casino_chips: nextChips, casino_rank: rank, casino_streak: streak, casino_last_active_date: today };
    if (counter) data[counter] = Number(fullUser?.[counter] || 0) + 1;
    await base44.asServiceRole.entities.User.update(user.id, data);
    await base44.asServiceRole.entities.ForumRewardEvent.create({ user_id: user.id, user_email: user.email || '', kind, xp: xp + streakBonus, chips: chips + streakBonus, rank_after: rank, post_id: postId || '', note: streakBonus ? `${note} · ${streak} day streak bonus` : note });
    return { xp: xp + streakBonus, chips: chips + streakBonus, rank, streak };
  } catch (error) { console.error('awardForumReward error:', error); return null; }
}

// Best-effort notification fan-out for a new post/reply. Never throws.
async function createForumNotifications(base44, { post, parentId, actor, authorName, body }) {
  try {
    const threadId = parentId || post.id;
    const recipients = new Map(); // recipientId -> { email, type, title }

    if (parentId) {
      const parent = await base44.asServiceRole.entities.ForumPost.get(parentId);
      if (parent?.user_id && parent.user_id !== actor?.id) {
        recipients.set(parent.user_id, { email: parent.user_email || '', type: 'reply', title: `${authorName} replied to your post` });
      }
    }

    const tokens = extractMentions(body);
    if (tokens.length) {
      const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
      for (const u of users || []) {
        if (!u?.id || u.id === actor?.id) continue;
        if (matchesMention(u, tokens)) {
          recipients.set(u.id, { email: u.email || '', type: 'mention', title: `${authorName} mentioned you` });
        }
      }
    }

    for (const [recipientId, info] of recipients) {
      await base44.asServiceRole.entities.Notification.create({
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
    const body = censorProfanity(trimToLength(input?.body, 2000));
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

    const mediaUrl = trimToLength(input?.media_url, 600);
    const mediaExt = mediaUrl.split('?')[0].split('.').pop()?.toLowerCase();
    const mediaType = trimToLength(input?.media_type, 16)
      || (mediaUrl ? (['mp4', 'webm', 'mov', 'ogg'].includes(mediaExt) ? 'video' : mediaExt === 'gif' ? 'gif' : 'image') : '');

    const ban = await findActiveBan(base44, { ip, emails: [user?.email], userId: user?.id });
    if (ban) {
      return Response.json({ error: 'Your account or connection has been blocked from posting.', code: 'blocked' }, { status: 403 });
    }

    const post = await base44.asServiceRole.entities.ForumPost.create({
      author_name: authorName,
      title: censorProfanity(trimToLength(input?.title || (parentId ? 'Reply' : 'Discussion Thread'), 120)),
      body,
      category,
      parent_id: parentId,
      is_published: true,
      is_pinned: false,
      ip_address: ip,
      user_email: user?.email || '',
      user_id: user?.id || '',
      author_avatar: trimToLength(user?.avatar_url, 600),
      media_url: mediaUrl,
      media_type: mediaType
    });

    const reward = await awardForumReward(base44, user, parentId
      ? { kind: 'reply', xp: 12, chips: 25, postId: post.id, note: 'Posted a forum reply', counter: 'casino_total_replies' }
      : { kind: 'thread', xp: 30, chips: 60, postId: post.id, note: 'Started a forum thread', counter: 'casino_total_posts' });
    await createForumNotifications(base44, { post, parentId, actor: user, authorName, body });

    return Response.json({ ok: true, id: post.id, reward });
  } catch (error) {
    console.error('submitForumPost error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});