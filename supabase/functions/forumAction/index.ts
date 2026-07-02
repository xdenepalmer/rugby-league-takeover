// Real likes + reactions + views + edit/pin/report/delete for forum posts.
// Runs with the service role (with explicit ownership/role checks).
import {
  json, preflight, serviceClient, getCaller, trimToLength, resolveClientIp,
  censorProfanity, FORUM_CATEGORIES, awardForumReward, getForumPost, num,
} from './shared.ts';

const ALLOWED_REACTIONS = ['❤️', '🏉', '🔥', '🎉', '👏'];

// deno-lint-ignore no-explicit-any
async function deleteWithChildren(svc: any, postId: string) {
  const { data: children } = await svc
    .from('forum_posts')
    .select('id')
    .eq('parent_id', postId)
    .limit(200);
  for (const child of children || []) {
    if (child?.id) await deleteWithChildren(svc, child.id);
  }
  await svc.from('forum_posts').delete().eq('id', postId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const input = await req.json().catch(() => ({}));
    const { action, postId, emoji } = input;
    if (!postId) return json({ error: 'postId is required' }, 400);

    if (action === 'delete') {
      const user = await getCaller(req, svc);
      if (!user) return json({ error: 'Login required' }, 401);

      const post = await getForumPost(svc, postId);
      if (!post) return json({ error: 'Post not found' }, 404);

      const isOwner = post.user_id && String(post.user_id) === String(user.id);
      if (!isOwner && user.role !== 'admin') {
        return json({ error: 'You can only remove your own posts' }, 403);
      }

      await deleteWithChildren(svc, postId);
      return json({ ok: true });
    }

    if (action === 'update') {
      const user = await getCaller(req, svc);
      if (!user) return json({ error: 'Login required' }, 401);

      const post = await getForumPost(svc, postId);
      if (!post) return json({ error: 'Post not found' }, 404);

      const isOwner = post.user_id && String(post.user_id) === String(user.id);
      const isModerator = user.role === 'admin' || user.role === 'moderator';
      if (!isOwner && !isModerator) {
        return json({ error: 'You can only edit your own posts' }, 403);
      }

      const title = censorProfanity(trimToLength(input?.title, 120));
      const body = censorProfanity(trimToLength(input?.body, 2000));
      const category = trimToLength(input?.category || post.category || 'General', 32);
      const mediaUrl = trimToLength(input?.media_url, 600);
      if (!body) return json({ error: 'Message is required' }, 400);
      if (!FORUM_CATEGORIES.includes(category)) return json({ error: 'Forum category is not supported' }, 400);

      await svc.from('forum_posts').update({
        title: title || post.title || 'Discussion Thread',
        body,
        category,
        media_url: mediaUrl,
      }).eq('id', postId);
      return json({ ok: true });
    }

    if (action === 'pin') {
      const user = await getCaller(req, svc);
      if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
        return json({ error: 'Moderator access required' }, 403);
      }
      await svc.from('forum_posts').update({ is_pinned: input?.is_pinned === true }).eq('id', postId);
      return json({ ok: true });
    }

    if (action === 'report') {
      const user = await getCaller(req, svc);
      const post = await getForumPost(svc, postId);
      if (!post) return json({ error: 'Post not found' }, 404);

      const ip = resolveClientIp(req);
      const reporter = String(user?.id || user?.email || ip || 'anonymous').toLowerCase();
      const reportedBy = Array.isArray(post.reported_by) ? post.reported_by.map(String) : [];
      const alreadyReported = reportedBy.includes(reporter);
      const nextReportedBy = alreadyReported ? reportedBy : [...reportedBy, reporter];
      await svc.from('forum_posts').update({
        reported_by: nextReportedBy,
        reported_count: nextReportedBy.length,
        moderation_reason: censorProfanity(trimToLength(input?.reason || post.moderation_reason || 'Reported by user', 160)),
      }).eq('id', postId);
      return json({ ok: true, reported_count: nextReportedBy.length });
    }

    if (action === 'view') {
      const post = await getForumPost(svc, postId);
      if (!post) return json({ error: 'Post not found' }, 404);
      const next = num(post.view_count) + 1;
      await svc.from('forum_posts').update({ view_count: next }).eq('id', postId);
      return json({ view_count: next });
    }

    if (action === 'like') {
      const user = await getCaller(req, svc);
      if (!user) return json({ error: 'Login required to like posts' }, 401);

      const post = await getForumPost(svc, postId);
      if (!post) return json({ error: 'Post not found' }, 404);

      const likedBy = Array.isArray(post.liked_by) ? post.liked_by.slice() : [];
      const id = String(user.id);
      const index = likedBy.indexOf(id);
      let liked;
      if (index >= 0) {
        likedBy.splice(index, 1);
        liked = false;
      } else {
        likedBy.push(id);
        liked = true;
      }
      await svc.from('forum_posts').update({ liked_by: likedBy, like_count: likedBy.length }).eq('id', postId);
      return json({ liked, like_count: likedBy.length });
    }

    if (action === 'react') {
      const user = await getCaller(req, svc);
      if (!user) return json({ error: 'Login required to react' }, 401);
      if (!ALLOWED_REACTIONS.includes(emoji)) return json({ error: 'Unsupported reaction' }, 400);

      const post = await getForumPost(svc, postId);
      if (!post) return json({ error: 'Post not found' }, 404);

      const reactions = (post.reactions && typeof post.reactions === 'object' && !Array.isArray(post.reactions))
        ? { ...post.reactions }
        : {};
      // Migrate any legacy ❤️ likes into the reactions map the first time.
      if (!reactions['❤️'] && Array.isArray(post.liked_by) && post.liked_by.length) {
        reactions['❤️'] = post.liked_by.slice();
      }

      const id = String(user.id);
      const cleaned: Record<string, string[]> = {};
      const claimed = new Set<string>();
      let currentEmoji = '';

      for (const key of ALLOWED_REACTIONS) {
        const ids = Array.isArray(reactions[key]) ? reactions[key].map(String).filter(Boolean) : [];
        const unique: string[] = [];
        for (const reactorId of ids) {
          if (!claimed.has(reactorId)) {
            claimed.add(reactorId);
            unique.push(reactorId);
            if (reactorId === id) currentEmoji = key;
          }
        }
        if (unique.length) cleaned[key] = unique;
      }

      for (const key of ALLOWED_REACTIONS) {
        if (cleaned[key]) cleaned[key] = cleaned[key].filter((reactorId) => reactorId !== id);
        if (cleaned[key]?.length === 0) delete cleaned[key];
      }

      const added = currentEmoji !== emoji;
      const firstReactionOnPost = !currentEmoji;
      if (added) cleaned[emoji] = [...(cleaned[emoji] || []), id];

      const total = Object.values(cleaned).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      await svc.from('forum_posts').update({ reactions: cleaned, like_count: total, liked_by: cleaned['❤️'] || [] }).eq('id', postId);
      let reward = null;
      if (added && firstReactionOnPost) {
        reward = await awardForumReward(svc, user, { kind: 'reaction_given', xp: 2, chips: 5, postId, note: `Reacted with ${emoji}`, counter: 'casino_total_reactions_given' });
        if (post.user_id && String(post.user_id) !== id) {
          const author = { id: post.user_id, email: post.user_email || '' };
          await awardForumReward(svc, author, { kind: 'reaction_received', xp: 4, chips: 10, postId, note: `Received ${emoji} reaction`, counter: 'casino_total_reactions_received' });
        }
      }
      return json({ reactions: cleaned, like_count: total, reward });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('forumAction error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
