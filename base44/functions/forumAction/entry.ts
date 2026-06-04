import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Real likes + views + delete for forum posts. Base44 RLS blocks a user from
// updating/deleting a post they don't own, so these run with the service role
// (with explicit ownership checks).
// - action "like": toggles the caller's like (login required)
// - action "view": increments the view counter (anonymous allowed)
// - action "delete": removes the caller's own post/reply (or any, if admin), and
//   cascades to all nested child replies.
async function deleteWithChildren(base44, postId) {
  const children = await base44.asServiceRole.entities.ForumPost.filter({ parent_id: postId }, '-created_date', 200);
  for (const child of children || []) {
    if (child?.id) await deleteWithChildren(base44, child.id);
  }
  await base44.asServiceRole.entities.ForumPost.delete(postId);
}

const ALLOWED_REACTIONS = ['❤️', '🏉', '🔥', '🎉', '👏'];
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { action, postId, emoji } = await req.json().catch(() => ({}));
    if (!postId) return Response.json({ error: 'postId is required' }, { status: 400 });

    if (action === 'delete') {
      let user = null;
      try {
        user = await base44.auth.me();
      } catch {
        user = null;
      }
      if (!user) return Response.json({ error: 'Login required' }, { status: 401 });

      const post = await base44.asServiceRole.entities.ForumPost.get(postId);
      if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });

      const isOwner = post.user_id && String(post.user_id) === String(user.id);
      if (!isOwner && user.role !== 'admin') {
        return Response.json({ error: 'You can only remove your own posts' }, { status: 403 });
      }

      await deleteWithChildren(base44, postId);
      return Response.json({ ok: true });
    }

    if (action === 'view') {
      const post = await base44.asServiceRole.entities.ForumPost.get(postId);
      if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });
      const next = Number(post.view_count || 0) + 1;
      await base44.asServiceRole.entities.ForumPost.update(postId, { view_count: next });
      return Response.json({ view_count: next });
    }

    if (action === 'like') {
      let user = null;
      try {
        user = await base44.auth.me();
      } catch {
        user = null;
      }
      if (!user) return Response.json({ error: 'Login required to like posts' }, { status: 401 });

      const post = await base44.asServiceRole.entities.ForumPost.get(postId);
      if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });

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
      await base44.asServiceRole.entities.ForumPost.update(postId, { liked_by: likedBy, like_count: likedBy.length });
      return Response.json({ liked, like_count: likedBy.length });
    }

    if (action === 'react') {
      let user = null;
      try {
        user = await base44.auth.me();
      } catch {
        user = null;
      }
      if (!user) return Response.json({ error: 'Login required to react' }, { status: 401 });
      if (!ALLOWED_REACTIONS.includes(emoji)) return Response.json({ error: 'Unsupported reaction' }, { status: 400 });

      const post = await base44.asServiceRole.entities.ForumPost.get(postId);
      if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });

      const reactions = (post.reactions && typeof post.reactions === 'object' && !Array.isArray(post.reactions))
        ? { ...post.reactions }
        : {};
      // Migrate any legacy ❤️ likes into the reactions map the first time.
      if (!reactions['❤️'] && Array.isArray(post.liked_by) && post.liked_by.length) {
        reactions['❤️'] = post.liked_by.slice();
      }

      const id = String(user.id);
      const cleaned = {};
      const claimed = new Set();
      let currentEmoji = '';

      for (const key of ALLOWED_REACTIONS) {
        const ids = Array.isArray(reactions[key]) ? reactions[key].map(String).filter(Boolean) : [];
        const unique = [];
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
      await base44.asServiceRole.entities.ForumPost.update(postId, { reactions: cleaned, like_count: total, liked_by: cleaned['❤️'] || [] });
      let reward = null;
      if (added && firstReactionOnPost) {
        reward = await awardForumReward(base44, user, { kind: 'reaction_given', xp: 2, chips: 5, postId, note: `Reacted with ${emoji}`, counter: 'casino_total_reactions_given' });
        if (post.user_id && String(post.user_id) !== id) {
          const author = { id: post.user_id, email: post.user_email || '' };
          await awardForumReward(base44, author, { kind: 'reaction_received', xp: 4, chips: 10, postId, note: `Received ${emoji} reaction`, counter: 'casino_total_reactions_received' });
        }
      }
      return Response.json({ reactions: cleaned, like_count: total, reward });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('forumAction error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});