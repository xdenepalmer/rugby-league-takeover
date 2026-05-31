import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PostsTab() {
  const { user } = useAuth();
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["myPosts", user?.email],
    queryFn: () => base44.entities.ForumPost.filter({ user_email: user.email }, "-created_date", 100),
    enabled: Boolean(user?.email),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading your posts…</p>;

  if (posts.length === 0) {
    return (
      <div className="border border-border bg-card p-10 text-center">
        <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">You haven't posted in the forum yet.</p>
        <Button asChild className="mt-6 rounded-none bg-primary hover:bg-primary/90"><Link to="/forum">Go to forum</Link></Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {posts.map((post) => (
        <article key={post.id} className="grid gap-2 border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-primary">{post.category || "General"}</span>
            <Badge variant="outline" className={`rounded-none uppercase ${post.is_published ? "border-emerald-500/40 text-emerald-400" : "border-amber-500/40 text-amber-400"}`}>
              {post.is_published ? "Published" : "Pending review"}
            </Badge>
          </div>
          <h3 className="font-display text-2xl uppercase">{post.title || "Discussion thread"}</h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">{post.body}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {post.created_date ? format(new Date(post.created_date), "dd MMM yyyy") : "Recently"}
          </p>
        </article>
      ))}
    </div>
  );
}
