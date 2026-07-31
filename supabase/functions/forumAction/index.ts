// Real likes + reactions + views + edit/pin/report/delete for forum posts.
// Runs with the service role (with explicit ownership/role checks).
import {
  json, preflight, serviceClient, getCaller, trimToLength, resolveClientIp,
  censorProfanity, FORUM_CATEGORIES, getForumPost, num, findActiveBan,
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
      const isModerator = user.role === 'admin' || user.role === 'moderator';
      if (!isOwner && !isModerator) {
        return json({ error: 'You can only remove your own posts unless you are a moderator' }, 403);
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
      // Reporting requires an account. Anonymous reporting let anyone drive the
      // moderation queue from behind a rotating IP, and the reporter identity
      // fell back to an IP — which is shared by everyone behind mobile CGNAT,
      // so one reporter could silently consume the whole street's report.
      const user = await getCaller(req, svc);
      if (!user) return json({ error: 'Login required to report a post' }, 401);

      // A banned user does not get to keep driving moderation.
      const ban = await findActiveBan(svc, { ip: resolveClientIp(req), emails: [user?.email], userId: user?.id });
      if (ban) return json({ error: 'Your account has been blocked.', code: 'blocked' }, 403);

      const post = await getForumPost(svc, postId);
      if (!post) return json({ error: 'Post not found' }, 404);

      const reporter = String(user.id || user.email).toLowerCase();
      const reportedBy = Array.isArray(post.reported_by) ? post.reported_by.map(String) : [];
      if (reportedBy.includes(reporter)) {
        // Idempotent: re-reporting is a no-op rather than another count.
        return json({ ok: true, reported_count: reportedBy.length, already_reported: true });
      }
      const nextReportedBy = [...reportedBy, reporter];

      // Reporter text is UNTRUSTED and goes in its own column. It must never be
      // written to moderation_reason: that field is rendered to moderators as
      // "Mod reason: …", so writing to it let a reporter put words in a
      // moderator's mouth and erase a note a moderator had already written.
      const reason = censorProfanity(trimToLength(input?.reason, 160));
      const existingReports = Array.isArray(post.report_reasons) ? post.report_reasons : [];
      const nextReports = [
        ...existingReports.slice(-49),
        { reporter, reason: reason || 'Reported by user', at: new Date().toISOString() },
      ];

      await svc.from('forum_posts').update({
        reported_by: nextReportedBy,
        reported_count: nextReportedBy.length,
        report_reasons: nextReports,
      }).eq('id', postId);
      return json({ ok: true, reported_count: nextReportedBy.length });
    }

    if (action === 'view') {
      // Atomic + de-duplicated per viewer per post per hour. Previously this was
      // an unauthenticated read-modify-write fired on every render, so a loop
      // could inflate the count and drive unbounded writes.
      const user = await getCaller(req, svc);
      const viewerKey = String(user?.id || resolveClientIp(req) || '').toLowerCase();
      if (!viewerKey) return json({ view_count: 0 });

      const { data: viewCount, error: viewError } = await svc.rpc('forum_register_view', {
        p_post_id: String(postId),
        p_viewer_key: viewerKey,
      });
      if (viewError) {
        console.error('forum_register_view error:', viewError);
        return json({ error: 'Unable to record view' }, 500);
      }
      return json({ view_count: num(viewCount) });
    }

    if (action === 'like') {
      const user = await getCaller(req, svc);
      if (!user) return json({ error: 'Login required to like posts' }, 401);

      const post = await getForumPost(svc, postId);
      if (!post) return json({ error: 'Post not found' }, 404);

      // Toggled under a row lock in Postgres. The old read-modify-write lost one
      // of any two concurrent likes and let like_count drift permanently away
      // from liked_by; the count is now derived from the array inside the same
      // statement, so the two cannot disagree.
      const { data: result, error: likeError } = await svc.rpc('forum_toggle_like', {
        p_post_id: String(postId),
        p_user_id: String(user.id),
      });
      if (likeError) {
        console.error('forum_toggle_like error:', likeError);
        return json({ error: 'Unable to update like' }, 500);
      }
      return json({ liked: Boolean(result?.liked), like_count: num(result?.like_count) });
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
        const { data: claimedReward, error: rewardError } = await svc.rpc('claim_forum_reaction_reward', {
          p_user_id: user.id,
          p_user_email: user.email || '',
          p_kind: 'reaction_given',
          p_xp: 2,
          p_chips: 5,
          p_post_id: String(postId),
          p_note: `Reacted with ${emoji}`,
        });
        if (rewardError) {
          console.error('claim_forum_reaction_reward (given) error:', rewardError);
        } else {
          reward = claimedReward;
        }
        if (post.user_id && String(post.user_id) !== id) {
          const { error: authorRewardError } = await svc.rpc('claim_forum_reaction_reward', {
            p_user_id: String(post.user_id),
            p_user_email: post.user_email || '',
            p_kind: 'reaction_received',
            p_xp: 4,
            p_chips: 10,
            p_post_id: String(postId),
            p_note: `Received ${emoji} reaction`,
          });
          if (authorRewardError) {
            console.error('claim_forum_reaction_reward (received) error:', authorRewardError);
          }
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
