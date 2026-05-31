import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MessageSquare, Send, ArrowLeft, Pin, Search, Heart, MessageCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FORUM_CATEGORIES, buildForumThreads, buildPendingForumPost } from "@/lib/public-forms";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";

const emptyPost = { author_name: "", title: "", body: "", category: "General" };
const emptyReply = { author_name: "", body: "" };

const categories = [
  { value: "All", label: "All Topics" },
  ...FORUM_CATEGORIES.map((value) => ({
    value,
    label: {
      General: "General Chat",
      Travel: "Travel & Flights",
      Events: "Meetups & Parties",
      MatchDay: "Allegiant Stadium",
      VegasTips: "Vegas Strip Tips",
    }[value] || value,
  })),
];

const getEngagement = (post) => {
  const seedText = `${post.id || ""}${post.created_date || ""}${post.title || ""}`;
  const seed = [...seedText].reduce((total, char) => total + char.charCodeAt(0), 0);
  return {
    likes: post.is_pinned ? 42 : (seed % 15) + 1,
  };
};

export default function Forum() {
  const { isAuthenticated, user } = useAuth();
  const [draft, setDraft] = useState(emptyPost);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedForReview, setSubmittedForReview] = useState(false);
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const queryClient = useQueryClient();

  const { data: posts = [] } = useQuery({
    queryKey: ["forumPosts"],
    queryFn: () => base44.entities.ForumPost.list("-created_date", 100),
    enabled: appParams.hasBase44Config,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Validate client-side for fast feedback; the function re-sanitises,
      // captures the client IP, and enforces bans server-side.
      const authorName = isAuthenticated ? (user?.full_name || "Member") : data.author_name;
      const post = buildPendingForumPost({ ...data, author_name: authorName });
      const response = await base44.functions.invoke("submitForumPost", {
        author_name: post.author_name,
        title: post.title,
        body: post.body,
        category: post.category,
        parent_id: post.parent_id,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forumPosts"] });
      setDraft(emptyPost);
      setReplyDrafts({});
      setActiveReplyId(null);
      setSubmittedForReview(true);
    },
  });

  const handlePost = (e) => {
    e.preventDefault();
    if ((!isAuthenticated && !draft.author_name) || !draft.title || !draft.body) return;
    createMutation.mutate(draft);
  };

  const getReplyDraft = (postId) => replyDrafts[postId] || emptyReply;

  const updateReplyDraft = (postId, updates) => {
    setReplyDrafts((current) => ({
      ...current,
      [postId]: { ...emptyReply, ...current[postId], ...updates },
    }));
  };

  const handleReply = (post, e) => {
    e.preventDefault();
    const reply = getReplyDraft(post.id);
    if (!post.id || (!isAuthenticated && !reply.author_name) || !reply.body) return;

    createMutation.mutate({
      author_name: reply.author_name,
      title: `Re: ${post.title || "Discussion Thread"}`,
      body: reply.body,
      category: post.category || "General",
      parent_id: post.id,
    });
  };

  const filteredThreads = buildForumThreads(posts)
    .filter((post) => selectedCategory === "All" || post.category === selectedCategory)
    .filter((post) => {
      const replyText = (post.replies || []).map((reply) => `${reply.body || ""} ${reply.author_name || ""}`).join(" ");
      const matchText = `${post.title || ""} ${post.body || ""} ${post.author_name || ""} ${replyText}`.toLowerCase();
      return matchText.includes(searchQuery.toLowerCase());
    });

  const getCategoryLabel = (value) => categories.find((category) => category.value === value)?.label || "General Chat";

  return (
    <main className="relative min-h-screen bg-background px-5 pb-8 pt-28 text-foreground md:px-8">
      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Fan Discussion Board</p>
            <h1 className="font-display text-4xl uppercase tracking-tight sm:text-5xl">Aussies in Vegas Forum</h1>
          </div>
          <Button asChild variant="outline" className="h-12 rounded-none border-border">
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-6">
            <div className="flex flex-col gap-4 border border-border bg-card/40 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search discussions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 rounded-none border-border bg-background pl-10"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => setSelectedCategory(category.value)}
                    className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                      selectedCategory === category.value
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border bg-background/80 text-muted-foreground hover:border-accent hover:text-white"
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              {filteredThreads.map((post) => (
                <ForumPostCard
                  key={post.id}
                  post={post}
                  getCategoryLabel={getCategoryLabel}
                  isAuthenticated={isAuthenticated}
                  user={user}
                  appReady={appParams.hasBase44Config}
                  isSubmitting={createMutation.isPending}
                  replyOpen={activeReplyId === post.id}
                  replyDraft={getReplyDraft(post.id)}
                  onToggleReply={() => setActiveReplyId(activeReplyId === post.id ? null : post.id)}
                  onUpdateReply={(updates) => updateReplyDraft(post.id, updates)}
                  onReply={(e) => handleReply(post, e)}
                />
              ))}

              {filteredThreads.length === 0 && (
                <div className="border border-border bg-card p-12 text-center text-muted-foreground">
                  No discussions found matching your filter options. Start a new chat below.
                </div>
              )}
            </div>
          </div>

          <aside className="border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 font-display text-2xl uppercase tracking-wider">
              <MessageSquare className="h-5 w-5 text-accent" /> Start a chat
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Have questions about tickets, meetups, flights, or Vegas? Post a topic and connect with other Rugby League fans traveling over.
            </p>
            {submittedForReview && (
              <p className="mt-4 border border-accent/50 bg-accent/10 p-3 text-xs font-semibold text-foreground">
                Thanks. Your post has been sent for moderation.
              </p>
            )}

            <form onSubmit={handlePost} className="mt-6 grid gap-4">
              {isAuthenticated ? (
                <p className="border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                  Posting as <span className="font-semibold text-foreground">{user?.full_name || user?.email}</span>
                </p>
              ) : (
                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your Name</label>
                  <Input
                    required
                    placeholder="e.g. Tommy R."
                    value={draft.author_name}
                    onChange={(e) => setDraft({ ...draft, author_name: e.target.value })}
                    className="h-11 rounded-none border-border bg-background text-sm"
                  />
                </div>
              )}

              <div className="grid gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Topic Category</label>
                <Select value={draft.category} onValueChange={(value) => setDraft({ ...draft, category: value })}>
                  <SelectTrigger className="h-11 rounded-none border-border bg-background text-left text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter((category) => category.value !== "All").map((category) => (
                      <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Topic Title</label>
                <Input
                  required
                  placeholder="e.g. Flights to Vegas"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="h-11 rounded-none border-border bg-background text-sm"
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Message</label>
                <Textarea
                  required
                  placeholder="Ask about flights, meetups, events..."
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  className="min-h-32 rounded-none border-border bg-background text-sm leading-relaxed"
                />
              </div>

              <Button
                type="submit"
                disabled={!appParams.hasBase44Config || (!isAuthenticated && !draft.author_name) || !draft.title || !draft.body || createMutation.isPending}
                className="h-12 rounded-none bg-primary text-xs font-bold uppercase tracking-wider hover:bg-primary/90"
              >
                <Send className="mr-2 h-4 w-4" /> {createMutation.isPending ? "Sending..." : "Send for moderation"}
              </Button>
            </form>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ForumPostCard({
  post,
  getCategoryLabel,
  isAuthenticated,
  user,
  appReady,
  isSubmitting,
  replyOpen,
  replyDraft,
  onToggleReply,
  onUpdateReply,
  onReply,
}) {
  const engagement = getEngagement(post);
  const replies = post.replies || [];

  return (
    <article
      className={`relative border bg-card/60 p-6 transition-colors hover:border-accent/30 ${
        post.is_pinned ? "border-primary/40 bg-primary/5" : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          {post.is_pinned && (
            <span className="flex items-center gap-1 bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
              <Pin className="h-3 w-3" /> Pinned
            </span>
          )}
          <span className="border border-border/80 px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
            {getCategoryLabel(post.category)}
          </span>
          <span className="font-semibold uppercase tracking-wider text-accent">{post.author_name}</span>
        </div>
        <span className="text-[10px] font-medium text-muted-foreground">
          {post.created_date ? new Date(post.created_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "Recently"}
        </span>
      </div>

      <h3 className="mt-4 font-display text-2xl uppercase tracking-wide text-foreground">{post.title || "Discussion Thread"}</h3>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{post.body}</p>

      <div className="mt-6 flex items-center gap-6 border-t border-border/40 pt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <button type="button" className="flex items-center gap-2 hover:text-primary">
          <Heart className="h-4 w-4" /> <span>{engagement.likes} Likes</span>
        </button>
        <button type="button" onClick={onToggleReply} className="flex items-center gap-2 hover:text-primary">
          <MessageCircle className="h-4 w-4" /> <span>{replies.length} {replies.length === 1 ? "Comment" : "Comments"}</span>
        </button>
      </div>

      {replies.length > 0 && (
        <div className="mt-5 grid gap-3 border-t border-border/40 pt-5">
          {replies.map((reply) => (
            <div key={reply.id} className="border-l-2 border-primary/40 bg-background/50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span className="text-accent">{reply.author_name || "Member"}</span>
                <span>{reply.created_date ? new Date(reply.created_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "Recently"}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{reply.body}</p>
            </div>
          ))}
        </div>
      )}

      {replyOpen && (
        <form onSubmit={onReply} className="mt-5 grid gap-3 border-t border-border/40 pt-5">
          {isAuthenticated ? (
            <p className="border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
              Commenting as <span className="font-semibold text-foreground">{user?.full_name || user?.email}</span>
            </p>
          ) : (
            <Input
              required
              placeholder="Your name"
              value={replyDraft.author_name}
              onChange={(e) => onUpdateReply({ author_name: e.target.value })}
              className="h-11 rounded-none border-border bg-background text-sm"
            />
          )}
          <Textarea
            required
            placeholder={`Reply to ${post.author_name || "this thread"}...`}
            value={replyDraft.body}
            onChange={(e) => onUpdateReply({ body: e.target.value })}
            className="min-h-24 rounded-none border-border bg-background text-sm leading-relaxed"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onToggleReply} className="h-10 rounded-none border-border text-xs font-bold uppercase tracking-wider">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!appReady || (!isAuthenticated && !replyDraft.author_name) || !replyDraft.body || isSubmitting}
              className="h-10 rounded-none bg-primary text-xs font-bold uppercase tracking-wider hover:bg-primary/90"
            >
              <Send className="mr-2 h-4 w-4" /> {isSubmitting ? "Sending..." : "Send comment"}
            </Button>
          </div>
        </form>
      )}
    </article>
  );
}
