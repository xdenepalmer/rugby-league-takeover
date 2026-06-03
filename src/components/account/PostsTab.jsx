import React, { useState, useMemo } from "react";
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
  const [subTab, setSubTab] = useState("my_posts");

  const { data: myPosts = [], isLoading: myPostsLoading } = useQuery({
    queryKey: ["myPosts", user?.email],
    queryFn: () => base44.entities.ForumPost.filter({ user_email: user.email }, "-created_date", 100),
    enabled: Boolean(user?.email),
  });

  const { data: allPosts = [], isLoading: allPostsLoading } = useQuery({
    queryKey: ["forumPosts"],
    queryFn: () => base44.entities.ForumPost.list("-created_date", 200),
    enabled: true,
  });

  const savedIds = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("rlt_saved_posts") || "[]");
    } catch {
      return [];
    }
  }, []);

  const [unsavedIds, setUnsavedIds] = useState([]);

  const savedPosts = useMemo(() => {
    return allPosts.filter(p => savedIds.includes(p.id) && !unsavedIds.includes(p.id));
  }, [allPosts, savedIds, unsavedIds]);

  const isLoading = myPostsLoading || allPostsLoading;

  if (isLoading) return (
    <div className="grid gap-4">
      {[1,2,3].map(i => (
        <div key={i} className="animate-pulse border border-border bg-card p-5 grid gap-2">
          <div className="flex items-center justify-between">
            <div className="h-3 w-20 bg-muted/15" />
            <div className="h-5 w-24 bg-muted/10" />
          </div>
          <div className="h-6 w-2/3 bg-muted/15" />
          <div className="h-3 w-full bg-muted/10" />
          <div className="h-3 w-4/5 bg-muted/10" />
          <div className="h-2 w-24 bg-muted/10 mt-1" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Sub-tabs selector */}
      <div className="flex border border-border bg-card/10 p-0.5 max-w-xs">
        <button
          type="button"
          onClick={() => setSubTab("my_posts")}
          className={`flex-1 text-center py-2 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
            subTab === "my_posts" ? "bg-primary text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          My Threads ({myPosts.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab("saved")}
          className={`flex-1 text-center py-2 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
            subTab === "saved" ? "bg-primary text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          Saved ({savedPosts.length})
        </button>
      </div>

      {subTab === "my_posts" ? (
        myPosts.length === 0 ? (
          <div className="border border-border bg-card p-10 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">You haven't posted in the forum yet.</p>
            <Button asChild className="mt-6 rounded-none bg-primary hover:bg-primary/90"><Link to="/forum">Go to forum</Link></Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {myPosts.map((post) => (
              <article key={post.id} className="grid gap-2 border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.2em] text-primary">{post.category || "General"}</span>
                  <Badge variant="outline" className={`rounded-none uppercase ${post.is_published ? "border-emerald-500/40 text-emerald-400" : "border-amber-500/40 text-amber-400"}`}>
                    {post.is_published ? "Published" : "Pending review"}
                  </Badge>
                </div>
                <h3 className="font-display text-2xl uppercase">
                  <Link to={`/forum?thread=${post.id}`} className="hover:text-primary transition-colors">{post.title || "Discussion thread"}</Link>
                </h3>
                <p className="line-clamp-2 text-sm text-slate-300">{post.body}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
                  {post.created_date ? format(new Date(post.created_date), "dd MMM yyyy") : "Recently"}
                </p>
              </article>
            ))}
          </div>
        )
      ) : (
        savedPosts.length === 0 ? (
          <div className="border border-border bg-card p-10 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">You haven't saved any threads yet.</p>
            <Button asChild className="mt-6 rounded-none bg-primary hover:bg-primary/90"><Link to="/forum">Browse forum</Link></Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {savedPosts.map((post) => (
              <article key={post.id} className="grid gap-2 border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.2em] text-primary">{post.category || "General"}</span>
                  <span className="text-[10px] text-muted-foreground">By {post.author_name || "Anonymous"}</span>
                </div>
                <h3 className="font-display text-2xl uppercase">
                  <Link to={`/forum?thread=${post.id}`} className="hover:text-primary transition-colors">{post.title || "Discussion thread"}</Link>
                </h3>
                <p className="line-clamp-2 text-sm text-slate-300">{post.body}</p>
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground/50 pt-2 border-t border-border/10">
                  <span>{post.created_date ? format(new Date(post.created_date), "dd MMM yyyy") : "Recently"}</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      const key = "rlt_saved_posts";
                      try {
                        const saved = JSON.parse(localStorage.getItem(key) || "[]");
                        const next = saved.filter(x => x !== post.id);
                        localStorage.setItem(key, JSON.stringify(next));
                        setUnsavedIds(prev => [...prev, post.id]);
                      } catch {}
                    }}
                    className="text-destructive hover:underline cursor-pointer font-bold bg-transparent border-0 p-0"
                  >
                    Unsave
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      )}
    </div>
  );
}
