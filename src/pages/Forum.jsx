import React, { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  MessageSquare, Send, ArrowLeft, Pin, Search, Heart, MessageCircle,
  TrendingUp, Users, Flame, ChevronDown, ChevronUp, Sparkles,
  Clock, Eye, Filter, Hash, ArrowUpRight, X, Bookmark, Share2,
  Zap, Radio
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FORUM_CATEGORIES, buildForumThreads, buildPendingForumPost } from "@/lib/public-forms";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";

/* ─── Constants ─────────────────────────────────────────── */
const emptyPost = { author_name: "", title: "", body: "", category: "General" };
const emptyReply = { author_name: "", body: "" };

const CATEGORY_META = {
  All: { label: "All Topics", icon: Sparkles, color: "from-white/20 to-white/5", accent: "text-foreground", dot: "bg-foreground" },
  General: { label: "General Chat", icon: MessageSquare, color: "from-blue-500/20 to-blue-500/5", accent: "text-blue-400", dot: "bg-blue-400" },
  Travel: { label: "Travel & Flights", icon: ArrowUpRight, color: "from-emerald-500/20 to-emerald-500/5", accent: "text-emerald-400", dot: "bg-emerald-400" },
  Events: { label: "Meetups & Parties", icon: Flame, color: "from-orange-500/20 to-orange-500/5", accent: "text-orange-400", dot: "bg-orange-400" },
  MatchDay: { label: "Allegiant Stadium", icon: Zap, color: "from-primary/20 to-primary/5", accent: "text-primary", dot: "bg-primary" },
  VegasTips: { label: "Vegas Strip Tips", icon: Bookmark, color: "from-accent/20 to-accent/5", accent: "text-accent", dot: "bg-accent" },
};

const getCategoryMeta = (val) => CATEGORY_META[val] || CATEGORY_META.General;

const categories = [
  { value: "All" },
  ...FORUM_CATEGORIES.map((value) => ({ value })),
];

const getEngagement = (post) => {
  const seedText = `${post.id || ""}${post.created_date || ""}${post.title || ""}`;
  const seed = [...seedText].reduce((total, char) => total + char.charCodeAt(0), 0);
  return {
    likes: post.is_pinned ? 42 : (seed % 15) + 1,
    views: post.is_pinned ? 318 : ((seed * 7) % 200) + 20,
  };
};

/* ─── Avatar Component ──────────────────────────────────── */
function UserAvatar({ name, size = "md" }) {
  const initial = (name || "?")[0].toUpperCase();
  const seedStr = name || "";
  const seed = [...seedStr].reduce((t, c) => t + c.charCodeAt(0), 0);
  const hues = [15, 45, 160, 220, 280, 330, 190, 30];
  const hue = hues[seed % hues.length];
  const sizeClasses = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";

  return (
    <div
      className={`${sizeClasses} shrink-0 flex items-center justify-center font-bold uppercase`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 70%, 45%), hsl(${hue}, 70%, 30%))`,
        border: `1px solid hsl(${hue}, 70%, 50%, 0.3)`,
      }}
    >
      {initial}
    </div>
  );
}

/* ─── Time Ago Helper ───────────────────────────────────── */
function timeAgo(dateStr) {
  if (!dateStr) return "Recently";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

/* ─── Animated Stat Counter ─────────────────────────────── */
function AnimatedStat({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="p-2 bg-muted/30 border border-border/50">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="font-display text-xl tabular-nums text-foreground">{value}</p>
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/* ─── Trending Topics Strip ─────────────────────────────── */
function TrendingStrip({ threads }) {
  const trending = useMemo(() => {
    return [...threads]
      .sort((a, b) => getEngagement(b).likes - getEngagement(a).likes)
      .slice(0, 3);
  }, [threads]);

  if (trending.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="border border-border bg-card/40 cmd-glass overflow-hidden"
    >
      <div className="h-[2px] w-full bg-gradient-to-r from-primary via-accent to-primary" />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-primary">Trending Now</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {trending.map((thread, i) => {
            const meta = getCategoryMeta(thread.category);
            return (
              <div
                key={thread.id}
                className="group flex items-start gap-3 p-2.5 border border-border/30 bg-muted/10 hover:bg-muted/20 hover:border-primary/20 transition-all cursor-pointer"
              >
                <span className="font-display text-lg text-primary/40 leading-none mt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                    {thread.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    <span className="text-[9px] text-muted-foreground">{meta.label}</span>
                    <span className="text-[9px] text-muted-foreground">·</span>
                    <span className="text-[9px] text-muted-foreground">{getEngagement(thread).likes} likes</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Category Pill (Enhanced) ──────────────────────────── */
function CategoryPill({ value, isActive, onClick }) {
  const meta = getCategoryMeta(value);
  const MetaIcon = meta.icon;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={`relative flex items-center gap-2 border px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
        isActive
          ? `border-primary/50 bg-gradient-to-r ${meta.color} text-foreground shadow-[0_0_12px_hsl(var(--primary)/0.15)]`
          : "border-border bg-card/30 text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/20"
      }`}
    >
      <MetaIcon className={`h-3 w-3 ${isActive ? meta.accent : ""}`} />
      {meta.label}
      {isActive && (
        <motion.div
          layoutId="activeCategoryBar"
          className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary to-accent"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </motion.button>
  );
}

/* ─── Forum Post Card (Premium) ─────────────────────────── */
function ForumPostCard({
  post,
  isAuthenticated,
  user,
  appReady,
  isSubmitting,
  replyOpen,
  replyDraft,
  onToggleReply,
  onUpdateReply,
  onReply,
  index,
}) {
  const engagement = getEngagement(post);
  const replies = post.replies || [];
  const meta = getCategoryMeta(post.category);
  const MetaIcon = meta.icon;
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [liked, setLiked] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const shouldTruncate = (post.body || "").length > 200;
  const displayBody = shouldTruncate && !expanded
    ? post.body.slice(0, 200) + "..."
    : post.body;

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ delay: Math.min(index * 0.06, 0.3), duration: 0.4, ease: "easeOut" }}
      className={`group relative overflow-hidden border transition-all duration-300 hover:shadow-[0_4px_24px_hsl(var(--primary)/0.08)] ${
        post.is_pinned
          ? "border-primary/30 bg-gradient-to-br from-primary/5 via-card/80 to-card/60"
          : "border-border bg-card/40 hover:border-primary/20"
      }`}
    >
      {/* Top accent gradient */}
      <div className={`h-[2px] w-full bg-gradient-to-r ${meta.color}`} />

      {/* Pinned scan overlay */}
      {post.is_pinned && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent cmd-scan-line" />
        </div>
      )}

      <div className="p-5 md:p-6">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <UserAvatar name={post.author_name} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {post.author_name || "Anonymous"}
                </span>
                <span className="text-[10px] text-muted-foreground/60">·</span>
                <span className="text-[10px] font-mono text-muted-foreground/60">
                  {timeAgo(post.created_date)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {post.is_pinned && (
                  <span className="inline-flex items-center gap-1 bg-primary/15 border border-primary/25 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary">
                    <Pin className="h-2.5 w-2.5" /> Pinned
                  </span>
                )}
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-border/50 bg-gradient-to-r ${meta.color}`}>
                  <MetaIcon className={`h-2.5 w-2.5 ${meta.accent}`} />
                  <span className={meta.accent}>{meta.label}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Views badge */}
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground/50">
            <Eye className="h-3 w-3" />
            <span className="font-mono tabular-nums">{engagement.views}</span>
          </div>
        </div>

        {/* Post Title */}
        <h3 className="mt-4 font-display text-xl md:text-2xl uppercase tracking-wide text-foreground leading-tight group-hover:text-primary transition-colors duration-300">
          {post.title || "Discussion Thread"}
        </h3>

        {/* Post Body */}
        <div className="mt-3">
          <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
            {displayBody}
          </p>
          {shouldTruncate && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>

        {/* Engagement Bar */}
        <div className="mt-5 flex items-center gap-1 border-t border-border/30 pt-4">
          <button
            type="button"
            onClick={() => setLiked(!liked)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
              liked
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-primary hover:bg-muted/20 border border-transparent"
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${liked ? "fill-primary" : ""}`} />
            <span className="tabular-nums">{engagement.likes + (liked ? 1 : 0)}</span>
          </button>

          <button
            type="button"
            onClick={onToggleReply}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all duration-200 border ${
              replyOpen
                ? "bg-accent/10 text-accent border-accent/20"
                : "text-muted-foreground hover:text-accent hover:bg-muted/20 border-transparent"
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="tabular-nums">{replies.length}</span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-wider">
              {replies.length === 1 ? "Reply" : "Replies"}
            </span>
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground/50 hover:text-foreground transition-colors border border-transparent"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>

          {/* Spacer + Views (mobile) */}
          <div className="flex-1" />
          <div className="flex sm:hidden items-center gap-1 text-[10px] text-muted-foreground/40">
            <Eye className="h-3 w-3" />
            <span className="font-mono tabular-nums">{engagement.views}</span>
          </div>
        </div>

        {/* Replies Section */}
        <AnimatePresence>
          {replies.length > 0 && (replyOpen || replies.length <= 2) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-2 border-t border-border/30 pt-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50 mb-2">
                  Replies
                </p>
                {replies.map((reply, ri) => (
                  <motion.div
                    key={reply.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: ri * 0.05 }}
                    className="flex gap-3 border-l-2 border-primary/20 bg-muted/5 px-4 py-3 hover:bg-muted/10 transition-colors"
                  >
                    <UserAvatar name={reply.author_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {reply.author_name || "Member"}
                        </span>
                        <span className="text-[9px] font-mono text-muted-foreground/50">
                          {timeAgo(reply.created_date)}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                        {reply.body}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reply Form */}
        <AnimatePresence>
          {replyOpen && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              onSubmit={onReply}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-3 border-t border-border/30 pt-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50">
                  Write a Reply
                </p>
                {isAuthenticated ? (
                  <div className="flex items-center gap-2 border border-border/40 bg-muted/10 px-3 py-2">
                    <UserAvatar name={user?.full_name || user?.email} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      Replying as <span className="font-bold text-foreground">{user?.full_name || user?.email}</span>
                    </span>
                  </div>
                ) : (
                  <Input
                    required
                    placeholder="Your name"
                    value={replyDraft.author_name}
                    onChange={(e) => onUpdateReply({ author_name: e.target.value })}
                    className="h-10 rounded-none border-border bg-background text-sm"
                  />
                )}
                <Textarea
                  required
                  placeholder={`Reply to ${post.author_name || "this thread"}...`}
                  value={replyDraft.body}
                  onChange={(e) => onUpdateReply({ body: e.target.value })}
                  className="min-h-20 rounded-none border-border bg-background text-sm leading-relaxed resize-none"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onToggleReply}
                    className="h-9 rounded-none text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!appReady || (!isAuthenticated && !replyDraft.author_name) || !replyDraft.body || isSubmitting}
                    className="h-9 rounded-none bg-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/90"
                  >
                    <Send className="mr-1.5 h-3 w-3" />
                    {isSubmitting ? "Sending..." : "Post Reply"}
                  </Button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

/* ─── Create Post Form (Premium Sidebar) ────────────────── */
function CreatePostSidebar({ draft, setDraft, isAuthenticated, user, submittedForReview, onSubmit, isPending, categories: cats }) {
  const [focused, setFocused] = useState(false);

  return (
    <aside className="sticky top-24">
      <div className="border border-border bg-card/40 cmd-glass overflow-hidden">
        {/* Header accent */}
        <div className="h-[2px] w-full bg-gradient-to-r from-accent via-primary to-accent" />

        <div className="p-5">
          {/* Compose Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 border border-primary/20">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg uppercase tracking-wide">
                Start a Discussion
              </h2>
              <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60">
                Connect with fellow fans
              </p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground mb-4">
            Got questions about tickets, meetups, flights, or Vegas? Post a topic and
            connect with other Rugby League fans traveling over.
          </p>

          {/* Success message */}
          <AnimatePresence>
            {submittedForReview && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 border border-emerald-500/30 bg-emerald-500/10 p-3"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  <p className="text-xs font-bold text-emerald-400">Post submitted!</p>
                </div>
                <p className="text-[10px] text-emerald-400/80 mt-1">
                  Your post has been sent for moderation and will appear shortly.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-3.5">
            {/* Author */}
            {isAuthenticated ? (
              <div className="flex items-center gap-2 border border-border/40 bg-muted/10 px-3 py-2">
                <UserAvatar name={user?.full_name || user?.email} size="sm" />
                <div>
                  <p className="text-xs font-bold text-foreground">
                    {user?.full_name || user?.email}
                  </p>
                  <p className="text-[9px] text-muted-foreground/60">Authenticated user</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Your Name
                </label>
                <Input
                  required
                  placeholder="e.g. Tommy R."
                  value={draft.author_name}
                  onChange={(e) => setDraft({ ...draft, author_name: e.target.value })}
                  className="h-10 rounded-none border-border bg-background text-sm"
                />
              </div>
            )}

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Category
              </label>
              <Select value={draft.category} onValueChange={(value) => setDraft({ ...draft, category: value })}>
                <SelectTrigger className="h-10 rounded-none border-border bg-background text-left text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cats.filter((c) => c.value !== "All").map((c) => {
                    const m = getCategoryMeta(c.value);
                    return (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                          {m.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Topic Title
              </label>
              <Input
                required
                placeholder="What's on your mind?"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="h-10 rounded-none border-border bg-background text-sm"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Message
              </label>
              <Textarea
                required
                placeholder="Share your thoughts, questions, or tips..."
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                className="min-h-28 rounded-none border-border bg-background text-sm leading-relaxed resize-none"
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={!appParams.hasBase44Config || (!isAuthenticated && !draft.author_name) || !draft.title || !draft.body || isPending}
              className="w-full h-11 rounded-none bg-primary text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-primary/90 transition-all group"
            >
              <Send className="mr-2 h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              {isPending ? "Submitting..." : "Submit for Review"}
            </Button>

            <p className="text-[9px] text-center text-muted-foreground/40">
              Posts are reviewed before publishing
            </p>
          </form>
        </div>
      </div>

      {/* Community Guidelines */}
      <div className="mt-4 border border-border/50 bg-card/20 p-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-2">
          Community Guidelines
        </p>
        <ul className="space-y-1.5">
          {[
            "Be respectful to fellow fans",
            "Keep discussions on-topic",
            "No spam or commercial posts",
            "Share tips, ask questions, have fun",
          ].map((rule) => (
            <li key={rule} className="flex items-start gap-2 text-[10px] text-muted-foreground/60">
              <span className="mt-1 h-1 w-1 rounded-full bg-primary/40 shrink-0" />
              {rule}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/* ─── Main Forum Component ──────────────────────────────── */
export default function Forum() {
  const { isAuthenticated, user } = useAuth();
  const [draft, setDraft] = useState(emptyPost);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedForReview, setSubmittedForReview] = useState(false);
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [showMobileCompose, setShowMobileCompose] = useState(false);
  const queryClient = useQueryClient();

  const { data: posts = [] } = useQuery({
    queryKey: ["forumPosts"],
    queryFn: () => base44.entities.ForumPost.list("-created_date", 100),
    enabled: appParams.hasBase44Config,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
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

  const allThreads = buildForumThreads(posts);

  const filteredThreads = allThreads
    .filter((post) => selectedCategory === "All" || post.category === selectedCategory)
    .filter((post) => {
      const replyText = (post.replies || []).map((reply) => `${reply.body || ""} ${reply.author_name || ""}`).join(" ");
      const matchText = `${post.title || ""} ${post.body || ""} ${post.author_name || ""} ${replyText}`.toLowerCase();
      return matchText.includes(searchQuery.toLowerCase());
    });

  const totalReplies = allThreads.reduce((sum, t) => sum + (t.replies || []).length, 0);

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Grid background */}
        <div className="absolute inset-0 cmd-grid-bg opacity-50" />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-background" />

        <div className="relative z-10 mx-auto max-w-6xl px-5 pb-8 pt-28 md:px-8 md:pt-32 md:pb-10">
          {/* Breadcrumb */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 mb-4"
          >
            <Link to="/" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50 hover:text-primary transition-colors">
              Home
            </Link>
            <span className="text-muted-foreground/30">/</span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
              Forum
            </span>
          </motion.div>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Radio className="h-3.5 w-3.5 text-primary cmd-pulse" />
                <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-primary font-mono">
                  Fan Discussion Board
                </p>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl uppercase tracking-tight leading-none">
                Aussies in Vegas
              </h1>
              <h2 className="font-display text-4xl sm:text-5xl md:text-6xl uppercase tracking-tight leading-none text-primary/40 -mt-1">
                Forum
              </h2>
              <p className="mt-3 max-w-lg text-sm text-muted-foreground leading-relaxed">
                Connect with fellow Rugby League fans heading to Las Vegas.
                Share tips, plan meetups, and get the inside word on the takeover.
              </p>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex border border-border bg-card/30 cmd-glass divide-x divide-border/50"
            >
              <AnimatedStat icon={MessageSquare} value={allThreads.length} label="Threads" />
              <AnimatedStat icon={MessageCircle} value={totalReplies} label="Replies" />
              <AnimatedStat icon={Users} value={new Set(allThreads.map((t) => t.author_name)).size} label="Members" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Main Content ── */}
      <div className="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-8">
        {/* Trending Strip */}
        <TrendingStrip threads={allThreads} />

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          {/* ── Left Column: Feed ── */}
          <div className="space-y-5">
            {/* Search + Filters */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="border border-border bg-card/30 cmd-glass overflow-hidden"
            >
              <div className="p-4 space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                  <Input
                    placeholder="Search discussions, topics, or users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 rounded-none border-border bg-background/80 pl-10 text-sm"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Filters */}
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <CategoryPill
                      key={cat.value}
                      value={cat.value}
                      isActive={selectedCategory === cat.value}
                      onClick={() => setSelectedCategory(cat.value)}
                    />
                  ))}
                </div>

                {/* Filter summary */}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[9px] font-mono text-muted-foreground/40">
                    {filteredThreads.length} {filteredThreads.length === 1 ? "thread" : "threads"}
                    {selectedCategory !== "All" ? ` in ${getCategoryMeta(selectedCategory).label}` : ""}
                    {searchQuery ? ` matching "${searchQuery}"` : ""}
                  </p>
                  {(selectedCategory !== "All" || searchQuery) && (
                    <button
                      type="button"
                      onClick={() => { setSelectedCategory("All"); setSearchQuery(""); }}
                      className="text-[9px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Mobile compose button */}
            <div className="lg:hidden">
              <Button
                onClick={() => setShowMobileCompose(true)}
                className="w-full h-11 rounded-none bg-primary text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-primary/90"
              >
                <MessageSquare className="mr-2 h-3.5 w-3.5" />
                Start a Discussion
              </Button>
            </div>

            {/* Thread Feed */}
            <div className="space-y-3">
              {filteredThreads.map((post, index) => (
                <ForumPostCard
                  key={post.id}
                  post={post}
                  isAuthenticated={isAuthenticated}
                  user={user}
                  appReady={appParams.hasBase44Config}
                  isSubmitting={createMutation.isPending}
                  replyOpen={activeReplyId === post.id}
                  replyDraft={getReplyDraft(post.id)}
                  onToggleReply={() => setActiveReplyId(activeReplyId === post.id ? null : post.id)}
                  onUpdateReply={(updates) => updateReplyDraft(post.id, updates)}
                  onReply={(e) => handleReply(post, e)}
                  index={index}
                />
              ))}

              {filteredThreads.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border border-border bg-card/30 p-12 text-center"
                >
                  <Search className="h-8 w-8 mx-auto text-muted-foreground/20 mb-3" />
                  <p className="font-display text-xl uppercase text-muted-foreground/40">
                    No discussions found
                  </p>
                  <p className="text-xs text-muted-foreground/30 mt-1">
                    Try adjusting your filters or start a new discussion.
                  </p>
                </motion.div>
              )}
            </div>
          </div>

          {/* ── Right Column: Compose Sidebar (Desktop) ── */}
          <div className="hidden lg:block">
            <CreatePostSidebar
              draft={draft}
              setDraft={setDraft}
              isAuthenticated={isAuthenticated}
              user={user}
              submittedForReview={submittedForReview}
              onSubmit={handlePost}
              isPending={createMutation.isPending}
              categories={categories}
            />
          </div>
        </div>
      </div>

      {/* ── Mobile Compose Sheet ── */}
      <AnimatePresence>
        {showMobileCompose && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 lg:hidden"
              onClick={() => setShowMobileCompose(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto bg-card border-t border-border lg:hidden"
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg uppercase tracking-wide">
                    Start a Discussion
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowMobileCompose(false)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <AnimatePresence>
                  {submittedForReview && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="mb-4 border border-emerald-500/30 bg-emerald-500/10 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                        <p className="text-xs font-bold text-emerald-400">Post submitted for moderation!</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={(e) => { handlePost(e); setShowMobileCompose(false); }} className="space-y-3.5">
                  {isAuthenticated ? (
                    <div className="flex items-center gap-2 border border-border/40 bg-muted/10 px-3 py-2">
                      <UserAvatar name={user?.full_name || user?.email} size="sm" />
                      <span className="text-xs text-muted-foreground">
                        <span className="font-bold text-foreground">{user?.full_name || user?.email}</span>
                      </span>
                    </div>
                  ) : (
                    <Input
                      required
                      placeholder="Your name"
                      value={draft.author_name}
                      onChange={(e) => setDraft({ ...draft, author_name: e.target.value })}
                      className="h-10 rounded-none border-border bg-background text-sm"
                    />
                  )}

                  <Select value={draft.category} onValueChange={(value) => setDraft({ ...draft, category: value })}>
                    <SelectTrigger className="h-10 rounded-none border-border bg-background text-left text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter((c) => c.value !== "All").map((c) => (
                        <SelectItem key={c.value} value={c.value}>{getCategoryMeta(c.value).label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    required
                    placeholder="Topic title"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className="h-10 rounded-none border-border bg-background text-sm"
                  />

                  <Textarea
                    required
                    placeholder="What's on your mind?"
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                    className="min-h-28 rounded-none border-border bg-background text-sm leading-relaxed resize-none"
                  />

                  <Button
                    type="submit"
                    disabled={!appParams.hasBase44Config || (!isAuthenticated && !draft.author_name) || !draft.title || !draft.body || createMutation.isPending}
                    className="w-full h-11 rounded-none bg-primary text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-primary/90"
                  >
                    <Send className="mr-2 h-3.5 w-3.5" />
                    {createMutation.isPending ? "Submitting..." : "Submit for Review"}
                  </Button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
