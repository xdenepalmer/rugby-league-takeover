import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MessageCircle, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const emptyPost = { author_name: "", title: "", body: "", is_published: true, is_pinned: false };

export default function Forum() {
  const [draft, setDraft] = useState(emptyPost);
  const queryClient = useQueryClient();
  const { data: posts = [] } = useQuery({ queryKey: ["forumPosts"], queryFn: () => base44.entities.ForumPost.list("-created_date", 100) });
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ForumPost.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["forumPosts"] }); setDraft(emptyPost); },
  });
  const visiblePosts = posts.filter((post) => post.is_published !== false).sort((a, b) => Number(b.is_pinned === true) - Number(a.is_pinned === true));

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Fan Forum</p>
            <h1 className="font-display text-5xl uppercase">Aussies in Vegas</h1>
          </div>
          <Button asChild variant="outline" className="rounded-none"><Link to="/">Back</Link></Button>
        </div>

        <section className="mt-10 border border-border bg-card p-6">
          <h2 className="flex items-center gap-3 font-display text-3xl uppercase"><MessageCircle className="h-6 w-6 text-primary" /> Start a chat</h2>
          <div className="mt-5 grid gap-3">
            <Input placeholder="Your name" value={draft.author_name} onChange={(e) => setDraft({ ...draft, author_name: e.target.value })} className="rounded-none" />
            <Input placeholder="Topic title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="rounded-none" />
            <Textarea placeholder="Ask about meetups, events, travel plans or anything Rugby League Takeover." value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="min-h-28 rounded-none" />
            <Button onClick={() => createMutation.mutate(draft)} disabled={!draft.author_name || !draft.body || createMutation.isPending} className="rounded-none bg-primary hover:bg-primary/90">
              <Send className="mr-2 h-4 w-4" /> Post to Forum
            </Button>
          </div>
        </section>

        <section className="mt-8 grid gap-4">
          {visiblePosts.map((post) => (
            <article key={post.id} className="border border-border bg-card p-6">
              <div className="flex flex-wrap items-center gap-3">
                {post.is_pinned && <span className="bg-primary px-2 py-1 text-xs font-bold uppercase text-primary-foreground">Pinned</span>}
                <p className="text-xs uppercase tracking-[0.25em] text-primary">{post.author_name}</p>
              </div>
              <h2 className="mt-3 font-display text-3xl uppercase">{post.title || "Forum post"}</h2>
              <p className="mt-3 whitespace-pre-wrap leading-7 text-muted-foreground">{post.body}</p>
            </article>
          ))}
          {visiblePosts.length === 0 && <p className="border border-border bg-card p-8 text-muted-foreground">No forum posts yet. Be the first to speak up.</p>}
        </section>
      </div>
    </main>
  );
}