import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';

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
      const list = Array.isArray(reactions[emoji]) ? reactions[emoji].slice() : [];
      const index = list.indexOf(id);
      if (index >= 0) list.splice(index, 1);
      else list.push(id);
      if (list.length) reactions[emoji] = list;
      else delete reactions[emoji];

      const total = Object.values(reactions).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      await base44.asServiceRole.entities.ForumPost.update(postId, { reactions, like_count: total });
      return Response.json({ reactions, like_count: total });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('forumAction error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
