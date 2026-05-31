import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";

export default function ForumManager({ posts }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["forumPosts"] });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.ForumPost.update(id, data), onSuccess: refresh });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.ForumPost.delete(id), onSuccess: refresh });

  return (
    <section id="forum-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <h2 className="font-display text-4xl uppercase">Forum Moderation</h2>
      <div className="mt-6 grid gap-4">
        {posts.length === 0 && <p className="text-sm text-muted-foreground">No forum posts yet.</p>}
        {posts.map((post) => (
          <div key={post.id} className="grid gap-4 border border-border p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-primary">{post.author_name} · {post.created_date ? format(new Date(post.created_date), "dd MMM yyyy") : "Today"}</p>
              <h3 className="mt-2 text-lg font-semibold">{post.title || "Reply"}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.body}</p>
            </div>
            <div className="flex items-center gap-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Live <Switch checked={post.is_published !== false} onCheckedChange={(value) => updateMutation.mutate({ id: post.id, data: { is_published: value } })} />
              Pin <Switch checked={post.is_pinned === true} onCheckedChange={(value) => updateMutation.mutate({ id: post.id, data: { is_pinned: value } })} />
              <Button variant="destructive" size="icon" className="rounded-none" onClick={() => deleteMutation.mutate(post.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}