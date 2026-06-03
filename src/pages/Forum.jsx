import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import AdSlot from "@/components/ads/AdSlot";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useInView, useMotionValue, useTransform, useSpring } from "framer-motion";
import {
  MessageSquare, Send, Pin, Search, MessageCircle,
  TrendingUp, Users, Flame, Sparkles, Clock, Eye,
  X, Radio, ChevronDown, ChevronUp, Trash2,
  Trophy, Activity, Reply
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FORUM_CATEGORIES, buildForumThreads, buildPendingForumPost } from "@/lib/public-forms";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import ReplyTree from "@/components/forum/ReplyTree";
import ReactionPicker from "@/components/forum/ReactionPicker";
import ForumMedia from "@/components/forum/ForumMedia";
import MentionTextarea from "@/components/forum/MentionTextarea";
import MediaAttach from "@/components/forum/MediaAttach";
import StadiumSeatPlanner from "@/components/forum/StadiumSeatPlanner";
import ScorePredictor from "@/components/forum/ScorePredictor";
import SlotMachineBadgeUnlock from "@/components/forum/SlotMachineBadgeUnlock";
import { topBadge, parseBadgeIds, SPIN_COOLDOWN_MS, SLOT_LAST_SPIN_KEY } from "@/lib/slot-badges";

import { getCategoryMeta, timeAgo, getRecencyScore } from "@/components/forum/feed/forumHelpers";
import { ShareButton, SaveButton } from "@/components/forum/feed/ShareSaveButtons";
import AnimatedNumber from "@/components/forum/feed/AnimatedNumber";
import FloatingParticles from "@/components/forum/feed/FloatingParticles";
import UserAvatar from "@/components/forum/feed/UserAvatar";
import UserProfileHoverCard from "@/components/forum/feed/UserProfileHoverCard";
import UserAchievements from "@/components/forum/feed/UserAchievements";
import AuthorBadge from "@/components/forum/feed/AuthorBadge";
import AuthorMeta from "@/components/forum/feed/AuthorMeta";
import LiveActivityTicker from "@/components/forum/feed/LiveActivityTicker";
import TrendingCard from "@/components/forum/feed/TrendingCard";
import CategoryPill from "@/components/forum/feed/CategoryPill";
import EmptyState from "@/components/forum/feed/EmptyState";
import ScrollToTopButton from "@/components/forum/feed/ScrollToTopButton";
import ThreadDetailModal from "@/components/forum/feed/ThreadDetailModal";
import ComposeSidebar from "@/components/forum/feed/ComposeSidebar";



/* ━━━ Constants & Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const emptyPost = { author_name: "", title: "", body: "", category: "General", media_url: "" };
const emptyReply = { author_name: "", body: "", media_url: "" };

const containsActiveReply = (post, activeId) => {
  if (!activeId) return false;
  if (post.id === activeId) return true;
  if (!post.replies) return false;
  const checkReplies = (replies) => {
    for (const r of replies) {
      if (r.id === activeId) return true;
      if (r.replies && checkReplies(r.replies)) return true;
    }
    return false;
  };
  return checkReplies(post.replies);
};

const categories = [
  { value: "All" },
  ...FORUM_CATEGORIES.map((value) => ({ value })),
];

const getEngagement = (post) => {
  // Clamp to 0: bad/legacy data can carry negative like_count/view_count, and a
  // negative engagement number should never render to fans. Fallback behaviour
  // (liked_by length, missing → 0) is preserved.
  const likes = Math.max(0, Number(post.like_count ?? (Array.isArray(post.liked_by) ? post.liked_by.length : 0)) || 0);
  const views = Math.max(0, Number(post.view_count || 0) || 0);
  return {
    likes,
    views,
    hot: post.is_pinned === true || likes >= 10,
  };
};

/* ━━━ Sort Tabs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const SORT_OPTIONS = [
  { id: "latest", label: "Latest", icon: Clock },
  { id: "hot", label: "Hot", icon: Flame },
  { id: "top", label: "Top", icon: Trophy },
];

function SortTabs({ active, onChange }) {
  return (
    <div className="forum-sort-tabs grid grid-cols-3 border border-border/50 bg-card/30 p-0.5 sm:flex sm:items-center">
      {SORT_OPTIONS.map((opt) => {
        const isActive = active === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`relative flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
              isActive ? "text-foreground" : "text-slate-300 hover:text-foreground"
            }`}
          >
            <opt.icon className={`h-3 w-3 ${isActive ? "text-primary" : ""}`} />
            {opt.label}
            {isActive && (
              <motion.div
                layoutId="sortTabBg"
                className="absolute inset-0 bg-muted/30 border border-border/50"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ━━━ Post Card (Premium with 3D tilt) ━━━━━━━━━━━━━━━━━━━ */
const ForumPostCard = memo(function ForumPostCard({
  post, isAuthenticated, user, appReady, isSubmitting,
  replyOpen, replyDraft, onToggleReply, onUpdateReply, onReply, index,
  onOpenThread, onDeletePost, replyApi, activeReplyDraft, authorPostCounts, authorReplyCounts, resolveAvatar, resolveMeta, reactionProfiles,
}) {
  const engagement = getEngagement(post);
  const replies = post.replies || [];
  const meta = getCategoryMeta(post.category);
  const MetaIcon = meta.icon;
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-30px" });
  const queryClient = useQueryClient();
  const reactMutation = useMutation({
    mutationFn: (emoji) => base44.functions.invoke("forumAction", { action: "react", postId: post.id, emoji }),
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ["forumPosts"] }); queryClient.invalidateQueries({ queryKey: ["forumAvatars"] }); if (res?.data?.reward) toast({ title: `+${res.data.reward.xp} XP · +${res.data.reward.chips} chips`, description: res.data.reward.rank }); },
  });
  const onReact = (emoji) => { if (!reactMutation.isPending) reactMutation.mutate(emoji); };
  useEffect(() => {
    if (!isInView || !post.id || typeof window === "undefined") return;
    const key = `rlt_viewed_${post.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    base44.functions.invoke("forumAction", { action: "view", postId: post.id }).catch(() => {});
  }, [isInView, post.id]);
  const [expanded, setExpanded] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState(false);

  const shouldTruncate = (post.body || "").length > 220;
  const displayBody = shouldTruncate && !expanded ? post.body.slice(0, 220) + "…" : post.body;

  const visibleReplies = showAllReplies ? replies : replies.slice(0, 2);
  const hiddenCount = replies.length - 2;

  // Recency progress bar
  const recency = getRecencyScore(post.created_date);

  // 3D hover tilt
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [2, -2]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-2, 2]), { stiffness: 300, damping: 30 });

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }, [mouseX, mouseY]);

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ delay: Math.min(index * 0.07, 0.35), duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ rotateX, rotateY, transformPerspective: 1200 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`forum-post-card group relative overflow-hidden border transition-all duration-300 ${
        post.is_pinned
          ? "border-primary/30 bg-gradient-to-br from-primary/[0.06] via-card/80 to-card/50 shadow-[0_0_30px_hsl(var(--primary)/0.06)]"
          : "border-border/60 bg-card/30 hover:border-primary/20"
      }`}
      whileHover={{
        boxShadow: `0 12px 40px ${meta.glow}, 0 0 0 1px ${meta.glow}`,
        y: -3,
      }}
    >
      {/* Top accent */}
      <div className={`h-[2px] w-full bg-gradient-to-r ${meta.gradient}`} />

      {/* Pinned diagonal stripes pattern */}
      {post.is_pinned && (
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 11px)",
          }}
        />
      )}

      {/* Pinned shimmer */}
      {post.is_pinned && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent cmd-scan-line" />
        </div>
      )}

      {/* Glass glare sweep overlay */}
      <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent skew-x-[-25deg] -translate-x-[150%] transition-transform duration-1000 group-hover:translate-x-[250%] pointer-events-none" />

      {/* Hot badge */}
      {engagement.hot && !post.is_pinned && (
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-500/10 border border-orange-500/20 text-[9px] font-bold uppercase tracking-wider text-orange-400">
            <Flame className="h-2 w-2" /> Hot
          </span>
        </div>
      )}

      <div className="relative p-4 sm:p-5 md:p-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <UserProfileHoverCard name={post.author_name} authorPostCounts={authorPostCounts} authorReplyCounts={authorReplyCounts}>
            <UserAvatar name={post.author_name} showStatus={index < 3} src={resolveAvatar ? resolveAvatar(post.user_id, post.author_avatar) : post.author_avatar} />
          </UserProfileHoverCard>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 truncate text-sm font-bold text-foreground">{post.author_name || "Anonymous"}</span>
              <AuthorBadge name={post.author_name} authorPostCounts={authorPostCounts} />
              <AuthorMeta meta={resolveMeta ? resolveMeta(post.user_id) : null} />
              <UserAchievements isMe={user && String(post.user_id) === String(user.id)} />
              <span className="text-[10px] text-slate-300 font-bold">•</span>
              <span className="text-[10px] font-mono text-slate-200 font-bold tabular-nums">{timeAgo(post.created_date)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {post.is_pinned && (
                <span className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  <Pin className="h-2 w-2" /> Pinned
                </span>
              )}
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-border/30 bg-gradient-to-r ${meta.gradient}`}>
                <MetaIcon className={`h-3 w-3 ${meta.accent}`} />
                <span className={meta.accent}>{meta.label}</span>
              </span>
            </div>
          </div>
          {/* Desktop stats */}
          <div className="hidden md:flex items-center gap-3 text-[10px] text-slate-300 font-semibold">
            <span className="flex items-center gap-1 font-mono font-bold tabular-nums text-slate-200">
              <Eye className="h-3 w-3 text-primary" /> {engagement.views}
            </span>
          </div>
        </div>

        {/* Title - clickable to open thread modal */}
        <h3
          className="mt-4 font-display text-xl md:text-2xl uppercase tracking-wide text-foreground leading-tight group-hover:text-primary transition-colors duration-300 cursor-pointer break-words"
          onClick={() => onOpenThread(post)}
        >
          {post.title || "Discussion Thread"}
        </h3>

        {/* Body */}
        <div className="mt-3">
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{displayBody}</p>
          <ForumMedia url={post.media_url} type={post.media_type} />
          {shouldTruncate && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary transition-colors"
            >
              {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Read more</>}
            </button>
          )}
        </div>

        {/* Engagement Bar */}
        <div className="forum-engagement-bar mt-5 flex flex-wrap items-center gap-0.5 border-t border-border/20 pt-3">
          <ReactionPicker reactions={post.reactions} legacyLikes={engagement.likes} currentUserId={user?.id} isAuthenticated={isAuthenticated} onReact={onReact} isPending={reactMutation.isPending} reactionProfiles={reactionProfiles} />

          <button
            type="button"
            onClick={onToggleReply}
            className={`forum-action-button flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold transition-all duration-200 border ${
              replyOpen
                ? "bg-accent/10 text-accent border-accent/20"
                : "text-slate-300 hover:text-accent hover:bg-accent/5 border-transparent"
            }`}
            aria-label="Write a reply"
          >
            <Reply className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">Reply</span>
            {replies.length > 0 && <span className="rounded-sm bg-muted/60 px-1.5 py-0.5 tabular-nums text-foreground font-bold">{replies.length}</span>}
          </button>

          <ShareButton post={post} />
          <SaveButton post={post} />

          {isAuthenticated && ((user?.id && String(post.user_id) === String(user.id)) || user?.role === "admin") && (
            <button
              type="button"
              onClick={() => onDeletePost(post)}
              className="forum-action-button flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 text-xs text-slate-300 hover:text-destructive transition-colors border border-transparent"
              title="Remove this thread"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="hidden flex-1 sm:block" />

          {/* View Thread button */}
          <button
            type="button"
            onClick={() => onOpenThread(post)}
            className="hidden min-h-11 items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary hover:bg-primary/5 transition-all border border-transparent hover:border-primary/20 sm:flex"
          >
            <Eye className="h-3 w-3" />
            <span className="hidden sm:inline">View Thread</span>
          </button>

          {/* Mobile stats */}
          <div className="forum-action-button flex min-h-11 items-center justify-center gap-1 text-[10px] text-slate-300 font-bold md:hidden">
            <Eye className="h-3 w-3 text-primary" />
            <span className="font-mono font-bold tabular-nums text-slate-200">{engagement.views}</span>
          </div>
        </div>

        {/* Replies */}
        <AnimatePresence>
          {replies.length > 0 && (replyOpen || replies.length <= 2) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-2 border-t border-border/20 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300 flex items-center gap-1.5">
                    <MessageCircle className="h-3 w-3 text-primary" />
                    {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
                  </p>
                  {hiddenCount > 0 && !showAllReplies && (
                    <button
                      type="button"
                      onClick={() => setShowAllReplies(true)}
                      className="text-[9px] font-bold uppercase tracking-wider text-primary hover:underline transition-colors"
                    >
                      Show {hiddenCount} more
                    </button>
                  )}
                </div>
                <ReplyTree replies={visibleReplies} activeReplyDraft={activeReplyDraft} {...replyApi} />
                {showAllReplies && hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllReplies(false)}
                    className="text-[9px] font-bold uppercase tracking-wider text-slate-200 hover:text-primary pt-1 transition-colors"
                  >
                    Collapse replies
                  </button>
                )}
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
              <div className="mt-4 space-y-3 border-t border-border/20 pt-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300">
                  Write a Reply
                </p>
                {isAuthenticated ? (
                  <div className="flex items-center gap-2 border border-border/30 bg-muted/[0.04] px-3 py-2">
                    <UserAvatar name={user?.full_name || user?.email} size="sm" src={user?.avatar_url} />
                    <span className="text-xs text-slate-300">
                      Replying as <span className="font-bold text-foreground">{user?.full_name || user?.email}</span>
                    </span>
                  </div>
                ) : (
                  <Input
                    required placeholder="Your name"
                    value={replyDraft.author_name}
                    onChange={(e) => onUpdateReply({ author_name: e.target.value })}
                    className="h-11 rounded-none border-border bg-background text-sm"
                  />
                )}
                <MentionTextarea
                  required
                  people={replyApi?.people}
                  placeholder={`Reply to ${post.author_name || "this thread"}… use @ to mention`}
                  value={replyDraft.body}
                  onChange={(val) => onUpdateReply({ body: val })}
                  className="min-h-20 rounded-none border-border bg-background text-sm leading-relaxed resize-none"
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="mobile" onClick={onToggleReply} className="rounded-none text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="mobile"
                    disabled={!appReady || (!isAuthenticated && !replyDraft.author_name) || !replyDraft.body || isSubmitting}
                    className="rounded-none bg-primary text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_0_10px_rgba(249,115,22,0.15)] transition-all hover:bg-primary/95 hover:shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" /> {isSubmitting ? "Sending…" : "Post Reply"}
                  </Button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Recency progress bar at bottom */}
      <div className="h-[2px] w-full bg-border/10 overflow-hidden">
        <motion.div
          className="h-full"
          initial={{ width: 0 }}
          animate={isInView ? { width: `${recency * 100}%` } : { width: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          style={{
            background: `linear-gradient(90deg, hsl(${meta.hue}, 70%, 50%, 0.6), hsl(${meta.hue}, 70%, 50%, 0.1))`,
          }}
        />
      </div>
    </motion.article>
  );
});


/* ━━━ Mobile Floating Action Button ━━━━━━━━━━━━━━━━━━━━━━ */
function MobileFAB({ onClick }) {
  const [scrollDir, setScrollDir] = useState("up");
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY;
      setScrollDir(current > lastScrollY.current ? "down" : "up");
      lastScrollY.current = current;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      animate={{
        scale: scrollDir === "down" ? 0.85 : 1,
        opacity: scrollDir === "down" ? 0.7 : 1,
      }}
      whileTap={{ scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="forum-compose-fab fixed bottom-[calc(5.5rem+var(--safe-bottom))] right-5 z-40 lg:hidden"
      aria-label="Start a discussion"
    >
      <div className="relative">
        {/* Pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/30"
          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
        <div className="relative h-14 w-14 rounded-full bg-primary shadow-lg shadow-primary/30 flex items-center justify-center text-primary-foreground">
          <MessageSquare className="h-5 w-5" />
        </div>
      </div>
    </motion.button>
  );
}


/* ━━━ MAIN FORUM COMPONENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function Forum() {
  const { isAuthenticated, user } = useAuth();
  const [draft, setDraft] = useState(emptyPost);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  /* ── Collapsible tipping + slot machine position ── */
  const [tippingExpanded, setTippingExpanded] = useState(() => {
    try { return localStorage.getItem("rlt_tipping_expanded") === "true"; } catch { return false; }
  });
  const [slotSpinAvailable, setSlotSpinAvailable] = useState(() => {
    const last = Number(localStorage.getItem(SLOT_LAST_SPIN_KEY) || 0);
    return Date.now() - last >= SPIN_COOLDOWN_MS;
  });
  useEffect(() => {
    const tick = () => {
      const last = Number(localStorage.getItem(SLOT_LAST_SPIN_KEY) || 0);
      setSlotSpinAvailable(Date.now() - last >= SPIN_COOLDOWN_MS);
    };
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, []);
  const toggleTipping = useCallback(() => {
    setTippingExpanded((prev) => {
      const next = !prev;
      try { localStorage.setItem("rlt_tipping_expanded", String(next)); } catch {}
      return next;
    });
  }, []);
  const [sortBy, setSortBy] = useState("latest");
  const [submittedForReview, setSubmittedForReview] = useState(false);
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [showMobileCompose, setShowMobileCompose] = useState(false);

  // Lock body scroll when mobile compose sheet is open
  useEffect(() => {
    if (showMobileCompose) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showMobileCompose]);
  const [threadModalPost, setThreadModalPost] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const { data: posts = [] } = useQuery({
    queryKey: ["forumPosts"],
    queryFn: () => base44.entities.ForumPost.list("-created_date", 100),
    enabled: appParams.hasBase44Config,
  });

  // Current avatars by user id, so changing a profile photo updates that
  // member's existing threads/replies. Falls back to the per-post snapshot, then
  // a monogram. Degrades gracefully if the function isn't deployed yet.
  const { data: avatarData } = useQuery({
    queryKey: ["forumAvatars"],
    queryFn: () => base44.functions.invoke("forumAvatars", {}),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
    staleTime: 60000,
  });
  // Club crests (from the Events teams list) so a member's favourite team shows
  // its logo next to their name instead of a generic emoji.
  const { data: teamRecords = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list("name", 200),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
    staleTime: 60000,
  });
  const teamLogoByName = useMemo(
    () => new Map((teamRecords || []).map((t) => [String(t.name || "").trim().toLowerCase(), t.logo_url || ""])),
    [teamRecords]
  );
  // Per-user forum profile: avatar + the optional location/team a member chose to
  // display. Built from the forumAvatars function; the viewer's own row is merged
  // in live so their changes show immediately.
  const profileById = useMemo(() => {
    const map = new Map((avatarData?.data?.avatars || []).map((a) => [String(a.id), { display_name: a.display_name || "Member", avatar_url: a.avatar_url || "", location: a.location || "", team: a.team || "", badges: parseBadgeIds(a.badges), casino_rank: a.casino_rank || "Rookie Punter", casino_xp: Number(a.casino_xp || 0), casino_chips: Number(a.casino_chips || 0), casino_streak: Number(a.casino_streak || 0) }]));
    if (isAuthenticated && user?.id) {
      // The viewer's own row, live — including badges saved to their profile and
      // any just won this session (kept in localStorage).
      let localBadges = [];
      try { localBadges = parseBadgeIds(JSON.parse(localStorage.getItem("rlt_slot_badges") || "[]")); } catch { localBadges = []; }
      const badges = Array.from(new Set([...parseBadgeIds(user.badges), ...localBadges]));
      map.set(String(user.id), {
        display_name: user.full_name || user.email || "You",
        avatar_url: user.avatar_url || "",
        location: user.show_location_on_forum ? [user.city, user.country].filter(Boolean).join(", ") : "",
        team: user.show_team_on_forum ? (user.favourite_team || "") : "",
        badges, casino_rank: user.casino_rank || "Rookie Punter", casino_xp: Number(user.casino_xp || 0), casino_chips: Number(user.casino_chips || 0), casino_streak: Number(user.casino_streak || 0),
      });
    }
    return map;
  }, [avatarData, isAuthenticated, user]);
  const avatarFor = useCallback((userId, snapshot) => (userId && profileById.get(String(userId))?.avatar_url) || snapshot || "", [profileById]);
  const forumMetaFor = useCallback((userId) => {
    const p = userId && profileById.get(String(userId));
    if (!p) return null;
    const teamLogo = p.team ? (teamLogoByName.get(String(p.team).trim().toLowerCase()) || "") : "";
    return { ...p, teamLogo, badge: topBadge(p.badges) };
  }, [profileById, teamLogoByName]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const authorName = isAuthenticated ? (user?.full_name || "Member") : data.author_name;
      const post = buildPendingForumPost({ ...data, author_name: authorName });
      const response = await base44.functions.invoke("submitForumPost", {
        author_name: post.author_name, title: post.title, body: post.body,
        category: post.category, parent_id: post.parent_id, media_url: data.media_url || "",
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["forumPosts"] }); queryClient.invalidateQueries({ queryKey: ["forumAvatars"] });
      setDraft(emptyPost); setReplyDrafts({}); setActiveReplyId(null); setSubmittedForReview(true); setShowMobileCompose(false);
      if (data?.reward) toast({ title: `+${data.reward.xp} XP · +${data.reward.chips} chips`, description: `${data.reward.rank}${data.reward.streak ? ` · ${data.reward.streak} day streak` : ""}` });
    },
  });

  const handlePost = (e) => {
    e.preventDefault();
    if ((!isAuthenticated && !draft.author_name) || !draft.title || !draft.body) return;
    createMutation.mutate(draft);
  };

  const getReplyDraft = useCallback((postId) => replyDrafts[postId] || emptyReply, [replyDrafts]);
  const updateReplyDraft = useCallback((postId, updates) => {
    setReplyDrafts((c) => ({ ...c, [postId]: { ...emptyReply, ...c[postId], ...updates } }));
  }, []);

  const handleReply = useCallback((post, e) => {
    e.preventDefault();
    setReplyDrafts((currentDrafts) => {
      const reply = currentDrafts[post.id] || emptyReply;
      if (!post.id || (!isAuthenticated && !reply.author_name) || !reply.body) return currentDrafts;
      createMutation.mutate({
        author_name: reply.author_name,
        title: `Re: ${post.title || "Discussion Thread"}`,
        body: reply.body, category: post.category || "General", parent_id: post.id,
        media_url: reply.media_url || "",
      });
      return currentDrafts;
    });
  }, [isAuthenticated, createMutation]);

  const deleteMutation = useMutation({
    mutationFn: (postId) => base44.functions.invoke("forumAction", { action: "delete", postId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["forumPosts"] }); toast({ title: "Removed" }); },
  });

  const handleDelete = useCallback((node) => {
    if (!node?.id) return;
    if (typeof window !== "undefined" && !window.confirm("Remove this and any replies under it?")) return;
    deleteMutation.mutate(node.id);
  }, [deleteMutation]);

  const handleToggleReply = useCallback((postId) => {
    setActiveReplyId((curr) => (curr === postId ? null : postId));
  }, []);

  const handleOpenThread = useCallback((p) => {
    setThreadModalPost(p);
  }, []);

  // Shared API for the recursive ReplyTree (reply to / delete any comment at any depth).
  const replyApi = useMemo(() => ({
    isAuthenticated,
    user,
    isSubmitting: createMutation.isPending,
    activeReplyId,
    onToggleReply: handleToggleReply,
    onUpdateReply: updateReplyDraft,
    onReply: handleReply,
    onDelete: handleDelete,
    timeAgo,
    resolveAvatar: avatarFor,
    resolveMeta: forumMetaFor,
  }), [
    isAuthenticated,
    user,
    createMutation.isPending,
    activeReplyId,
    handleToggleReply,
    updateReplyDraft,
    handleReply,
    handleDelete,
    avatarFor,
    forumMetaFor
  ]);

  const allThreads = buildForumThreads(posts);

  // Deep-link: /forum?thread=<id> (used by notifications) opens that thread, then
  // clears the param so closing the modal doesn't reopen it.
  const threadParam = searchParams.get("thread");
  useEffect(() => {
    if (!threadParam || !posts.length) return;
    const target = buildForumThreads(posts).find((t) => t.id === threadParam);
    if (target) {
      setThreadModalPost(target);
      const next = new URLSearchParams(searchParams);
      next.delete("thread");
      setSearchParams(next, { replace: true });
    }
  }, [threadParam, posts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Author post/reply counts for badges and hover cards
  const { authorPostCounts, authorReplyCounts } = useMemo(() => {
    const postCounts = {};
    const replyCounts = {};
    allThreads.forEach(t => {
      const name = t.author_name;
      if (name) postCounts[name] = (postCounts[name] || 0) + 1;
      (t.replies || []).forEach(r => {
        if (r.author_name) replyCounts[r.author_name] = (replyCounts[r.author_name] || 0) + 1;
      });
    });
    return { authorPostCounts: postCounts, authorReplyCounts: replyCounts };
  }, [allThreads]);

  // Mentionable people for @autocomplete — every participant currently in the
  // forum, plus the logged-in member. Used as a client-side fallback so mentions
  // work even before the searchUsers function is deployed (MentionTextarea also
  // merges the full user directory from that function when it's available).
  const mentionPeople = useMemo(() => {
    const names = new Set();
    allThreads.forEach((t) => {
      if (t.author_name) names.add(t.author_name);
      (t.replies || []).forEach((r) => { if (r.author_name) names.add(r.author_name); });
    });
    if (isAuthenticated && (user?.full_name || user?.email)) names.add(user.full_name || user.email);
    return [...names].map((name) => ({ name }));
  }, [allThreads, isAuthenticated, user]);
  replyApi.people = mentionPeople;

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { All: allThreads.length };
    FORUM_CATEGORIES.forEach((c) => { counts[c] = allThreads.filter((t) => t.category === c).length; });
    return counts;
  }, [allThreads]);

  // Filter + Sort
  const filteredThreads = useMemo(() => {
    let result = allThreads
      .filter((p) => selectedCategory === "All" || p.category === selectedCategory)
      .filter((p) => {
        const replyText = (p.replies || []).map((r) => `${r.body || ""} ${r.author_name || ""}`).join(" ");
        return `${p.title || ""} ${p.body || ""} ${p.author_name || ""} ${replyText}`.toLowerCase().includes(searchQuery.toLowerCase());
      });

    if (sortBy === "hot") {
      result = [...result].sort((a, b) => getEngagement(b).likes - getEngagement(a).likes);
    } else if (sortBy === "top") {
      result = [...result].sort((a, b) => getEngagement(b).views - getEngagement(a).views);
    }
    // "latest" is default order
    return result;
  }, [allThreads, selectedCategory, searchQuery, sortBy]);

  const totalReplies = allThreads.reduce((s, t) => s + (t.replies || []).length, 0);
  const uniqueMembers = new Set(allThreads.map((t) => t.author_name)).size;

  const clearAllFilters = () => {
    setSelectedCategory("All");
    setSearchQuery("");
    setSortBy("latest");
  };

  return (
    <main className="forum-mobile-shell relative min-h-dvh overflow-x-hidden bg-background text-foreground">
      {/* ━━━ HERO SECTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="forum-mobile-hero relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 cmd-grid-bg opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-transparent to-background" />
        <FloatingParticles />

        <div className="relative z-10 mx-auto max-w-6xl px-3 pb-5 pt-[calc(6.5rem+env(safe-area-inset-top,0px))] sm:px-5 sm:pb-10 sm:pt-[calc(8rem+env(safe-area-inset-top,0px))] md:px-8 md:pt-[calc(8.5rem+env(safe-area-inset-top,0px))] md:pb-12">
          {/* Breadcrumb */}
          <motion.nav initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 hidden items-center gap-2 sm:flex">
            <Link to="/" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/30 hover:text-primary transition-colors">Home</Link>
            <span className="text-muted-foreground/20">/</span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold">Forum</span>
          </motion.nav>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}>
              <div className="flex items-center gap-2 mb-3">
                <Radio className="h-3.5 w-3.5 text-primary cmd-pulse" />
                <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-primary font-mono">Fan Discussion Board</p>
                <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                  <Activity className="h-2 w-2" /> Live
                </span>
              </div>
              <h1 className="font-display text-4xl sm:text-6xl md:text-7xl uppercase tracking-tight leading-[0.92]">
                <span className="block">Rugby in</span>
                <span className="block bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Vegas</span>
              </h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground/60 sm:mt-4 sm:leading-relaxed">
                Connect with fellow Rugby League fans heading to Las Vegas. Share tips, plan meetups, and get the inside word on the takeover.
              </p>
            </motion.div>

            {/* Stats Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="grid w-full grid-cols-3 border border-border/40 bg-card/20 cmd-glass divide-x divide-border/30 lg:w-auto"
            >
              {[
                { icon: MessageSquare, value: allThreads.length, label: "Threads" },
                { icon: MessageCircle, value: totalReplies, label: "Replies" },
                { icon: Users, value: uniqueMembers, label: "Members" },
              ].map(({ icon: SIcon, value, label }) => (
                <div key={label} className="flex min-w-0 items-center gap-2 px-2 py-3 sm:gap-3 sm:px-4 md:px-5">
                  <div className="shrink-0 p-1.5 bg-muted/20 border border-border/30">
                    <SIcon className="h-3.5 w-3.5 text-primary/70" />
                  </div>
                  <div>
                    <p className="font-display text-xl tabular-nums text-foreground leading-none">
                      <AnimatedNumber value={value} />
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/40">{label}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ━━━ MAIN CONTENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="forum-mobile-content mx-auto max-w-6xl px-2 pb-[calc(7rem+var(--safe-bottom))] pt-4 sm:px-5 sm:py-6 md:px-8 md:py-8">
        {/* Trending */}
        {allThreads.length >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="border border-border/40 bg-card/20 cmd-glass overflow-hidden mb-6"
          >
            <div className="h-[2px] w-full bg-gradient-to-r from-primary via-accent to-primary" />
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span className="text-[9px] font-bold uppercase tracking-[0.35em] text-primary">Trending Now</span>
                <div className="flex-1" />
                <span className="text-[10px] font-mono text-muted-foreground/30">Updated live</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {[...allThreads].sort((a, b) => getEngagement(b).likes - getEngagement(a).likes).slice(0, 3).map((t, i) => (
                  <TrendingCard key={t.id} thread={t} rank={i + 1} onClick={() => setThreadModalPost(t)} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Sponsored */}
        <div className="mb-6">
          <AdSlot position="in-feed" size="leaderboard" className="w-full" />
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,_1fr)_320px]">
          {/* ━━━ LEFT: Feed ━━━ */}
          <div className="min-w-0 space-y-4">
            {/* Live Activity Ticker */}
            <LiveActivityTicker threads={allThreads} />

            {/* Slot Machine — TOP position when spin is available (mobile only) */}
            {slotSpinAvailable && (
              <div className="lg:hidden">
                <SlotMachineBadgeUnlock />
              </div>
            )}

            {/* Mobile Footy Tipping — Collapsible */}
            <div className="lg:hidden">
              <button
                onClick={toggleTipping}
                className="flex w-full items-center justify-between border border-border/50 bg-card/30 cmd-glass px-4 py-3 text-left transition-colors hover:bg-card/50 active:scale-[0.99]"
                aria-expanded={tippingExpanded}
                aria-controls="mobile-tipping-panel"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Trophy className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">Footy Tipping</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Tap to {tippingExpanded ? "collapse" : "expand"} tips</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: tippingExpanded ? 180 : 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </motion.div>
                </div>
              </button>
              <AnimatePresence initial={false}>
                {tippingExpanded && (
                  <motion.div
                    id="mobile-tipping-panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2">
                      <ScorePredictor
                        onSharePrediction={(matchup, homeScore, awayScore) => {
                          const home = matchup.home_team;
                          const away = matchup.away_team;
                          const label = matchup.label || "NRL Fixture";
                          setDraft((d) => ({
                            ...d,
                            title: `[Tip] ${home} ${homeScore} - ${awayScore} ${away}`,
                            body: `My footy tip for ${label}: ${home} ${homeScore} - ${awayScore} ${away}. Who are you backing?`,
                            category: "MatchDay",
                          }));
                          setShowMobileCompose(true);
                          window.scrollTo({ top: 300, behavior: "smooth" });
                        }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Search + Filter Bar */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="border border-border/40 bg-card/20 cmd-glass overflow-hidden"
            >
              <div className="space-y-3 p-3 sm:p-4">
                {/* Search + Sort row */}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/30" />
                    <Input
                      placeholder="Search discussions, topics, or users…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-11 rounded-none border-border/50 bg-background/60 pl-9 text-sm"
                    />
                    {searchQuery && (
                      <button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-foreground transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <SortTabs active={sortBy} onChange={setSortBy} />
                </div>

                {/* Categories */}
                <div className="forum-filter-rail grid grid-cols-2 gap-2 pb-1 sm:flex sm:flex-wrap">
                  {categories.map((cat) => (
                    <CategoryPill
                      key={cat.value}
                      value={cat.value}
                      isActive={selectedCategory === cat.value}
                      onClick={() => setSelectedCategory(cat.value)}
                      count={categoryCounts[cat.value] || 0}
                    />
                  ))}
                </div>

                {/* Summary */}
                <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border/20 pt-1">
                  <p className="text-[9px] font-mono text-muted-foreground/30">
                    {filteredThreads.length} {filteredThreads.length === 1 ? "thread" : "threads"}
                    {selectedCategory !== "All" ? ` in ${getCategoryMeta(selectedCategory).label}` : ""}
                    {searchQuery ? ` matching "${searchQuery}"` : ""}
                    {sortBy !== "latest" ? ` · sorted by ${sortBy}` : ""}
                  </p>
                  {(selectedCategory !== "All" || searchQuery || sortBy !== "latest") && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-[9px] font-bold uppercase tracking-wider text-primary/60 hover:text-primary transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Seating Planner & Score Predictor for MatchDay category */}
            <AnimatePresence>
              {selectedCategory === "MatchDay" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-4 mb-4"
                >
                  <div className="grid gap-4">
                    <StadiumSeatPlanner
                      onFilterSearch={(q) => setSearchQuery(q)}
                      onClaimSeat={(q) => {
                        setDraft((d) => ({
                          ...d,
                          title: `[${q}] Supporter Meetup!`,
                          body: `Hey fellow fans! I am sitting in ${q}. Let's coordinate and sync up at the game!`,
                          category: "MatchDay",
                        }));
                        setShowMobileCompose(true);
                        window.scrollTo({ top: 300, behavior: "smooth" });
                        try {
                          localStorage.setItem("rlt_seat_claimed", q);
                          window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "claim_seat" } }));
                        } catch (err) {}
                      }}
                      currentSearch={searchQuery}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Thread Feed */}
            <div className="space-y-3">
              {filteredThreads.map((post, index) => {
                const isActiveThread = activeReplyId && (activeReplyId === post.id || containsActiveReply(post, activeReplyId));
                const activeReplyDraft = isActiveThread ? (replyDrafts[activeReplyId] || emptyReply) : emptyReply;

                return (
                  <ForumPostCard
                    key={post.id} post={post} index={index}
                    isAuthenticated={isAuthenticated} user={user}
                    appReady={appParams.hasBase44Config} isSubmitting={createMutation.isPending}
                    replyOpen={activeReplyId === post.id}
                    replyDraft={activeReplyId === post.id ? (replyDrafts[post.id] || emptyReply) : emptyReply}
                    onToggleReply={handleToggleReply}
                    onUpdateReply={updateReplyDraft}
                    onReply={handleReply}
                    onOpenThread={handleOpenThread}
                    onDeletePost={handleDelete}
                    replyApi={replyApi}
                    activeReplyDraft={activeReplyDraft}
                    authorPostCounts={authorPostCounts}
                    authorReplyCounts={authorReplyCounts}
                    resolveAvatar={avatarFor}
                    resolveMeta={forumMetaFor}
                    reactionProfiles={profileById}
                  />
                );
              })}

              {filteredThreads.length === 0 && (
                <EmptyState
                  onClearFilters={clearAllFilters}
                  onSelectCategory={(cat) => { setSelectedCategory(cat); setSearchQuery(""); setSortBy("latest"); }}
                />
              )}
            </div>

            {/* Slot Machine — BOTTOM position when no spin available (mobile only) */}
            {!slotSpinAvailable && (
              <div className="lg:hidden">
                <SlotMachineBadgeUnlock />
              </div>
            )}
          </div>

          {/* ━━━ RIGHT: Sidebar ━━━ */}
          <div className="hidden lg:block">
            <AdSlot position="sidebar" size="medium-rectangle" className="mb-6 w-full" />
            <ComposeSidebar
              draft={draft} setDraft={setDraft}
              isAuthenticated={isAuthenticated} user={user}
              submittedForReview={submittedForReview}
              onSubmit={handlePost} isPending={createMutation.isPending}
              allThreads={allThreads}
              people={mentionPeople}
              onFilterSearch={(q) => setSearchQuery(q)}
              onClaimSeat={(q) => {
                setDraft((d) => ({
                  ...d,
                  title: `[${q}] Supporter Meetup!`,
                  body: `Hey fellow fans! I am sitting in ${q}. Let's coordinate and sync up at the game!`,
                  category: "MatchDay",
                }));
                window.scrollTo({ top: 300, behavior: "smooth" });
                try {
                  localStorage.setItem("rlt_seat_claimed", q);
                  window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "claim_seat" } }));
                } catch (err) {}
              }}
              searchQuery={searchQuery}
              onSharePrediction={(matchup, homeScore, awayScore) => {
                const home = matchup.home_team;
                const away = matchup.away_team;
                const label = matchup.label || "Opening Showdown";
                setDraft((d) => ({
                  ...d,
                  title: `[Prediction] ${home} ${homeScore} - ${awayScore} ${away}`,
                  body: `Here is my match prediction for ${label}: ${home} ${homeScore} - ${awayScore} ${away}! Let's go! What are your score predictions?`,
                  category: "MatchDay",
                }));
                window.scrollTo({ top: 300, behavior: "smooth" });
              }}
            />
          </div>
        </div>
      </div>

      {/* ━━━ THREAD DETAIL MODAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <AnimatePresence>
        {threadModalPost && (
          <ThreadDetailModal
            post={threadModalPost}
            onClose={() => setThreadModalPost(null)}
            isAuthenticated={isAuthenticated}
            user={user}
            appReady={appParams.hasBase44Config}
            isSubmitting={createMutation.isPending}
            replyDraft={replyDrafts[threadModalPost.id] || emptyReply}
            onUpdateReply={updateReplyDraft}
            onReply={handleReply}
            replyApi={replyApi}
            activeReplyDraft={replyDrafts[activeReplyId] || emptyReply}
            authorPostCounts={authorPostCounts}
            authorReplyCounts={authorReplyCounts}
            resolveAvatar={avatarFor}
            resolveMeta={forumMetaFor}
            reactionProfiles={profileById}
          />
        )}
      </AnimatePresence>

      {/* ━━━ MOBILE COMPOSE SHEET ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <AnimatePresence>
        {showMobileCompose && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              transition={{ duration: 0.2, ease: "linear" }}
              style={{ willChange: "opacity" }}
              className="fixed inset-0 z-50 bg-black/65 lg:hidden" 
              onClick={() => setShowMobileCompose(false)} 
            />
            <motion.div
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.3 }}
              style={{ willChange: "transform" }}
              className="ios-sheet ios-scroll fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto border-t border-border bg-card/95 pb-[calc(1.25rem+var(--safe-bottom))] cmd-scrollbar lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-labelledby="forum-mobile-compose-title"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="ios-home-indicator" />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 id="forum-mobile-compose-title" className="font-display text-lg uppercase tracking-wide">Start a Discussion</h2>
                  <button type="button" onClick={() => setShowMobileCompose(false)} className="touch-target flex items-center justify-center border border-border/30 text-slate-300 transition-colors hover:border-border hover:text-foreground" aria-label="Close composer">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <AnimatePresence>
                  {submittedForReview && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 border border-emerald-500/25 bg-emerald-500/[0.07] p-3 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                        <p className="text-xs font-bold text-emerald-400">Post submitted for moderation!</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handlePost} className="space-y-3">
                  {isAuthenticated ? (
                    <div className="flex items-center gap-2 border border-border/30 bg-muted/[0.04] px-3 py-2">
                      <UserAvatar name={user?.full_name || user?.email} size="sm" showStatus src={user?.avatar_url} />
                      <span className="text-xs font-bold text-foreground">{user?.full_name || user?.email}</span>
                    </div>
                  ) : (
                    <>
                      <label htmlFor="mobile-compose-name" className="sr-only">Your name</label>
                      <Input id="mobile-compose-name" required placeholder="Your name" value={draft.author_name} onChange={(e) => setDraft({ ...draft, author_name: e.target.value })} className="h-11 rounded-none border-border bg-background text-sm" />
                    </>
                  )}
                  <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                    <SelectTrigger className="h-11 rounded-none border-border bg-background text-left text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.filter((c) => c.value !== "All").map((c) => <SelectItem key={c.value} value={c.value}>{getCategoryMeta(c.value).label}</SelectItem>)}</SelectContent>
                  </Select>
                  <label htmlFor="mobile-compose-title" className="sr-only">Topic title</label>
                  <Input id="mobile-compose-title" required placeholder="Topic title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="h-11 rounded-none border-border bg-background text-sm" />
                  <MentionTextarea required people={mentionPeople} placeholder="What's on your mind? Use @ to mention" value={draft.body} onChange={(val) => setDraft({ ...draft, body: val })} className="min-h-24 rounded-none border-border bg-background text-sm leading-relaxed resize-none" />
                  <MediaAttach value={draft.media_url} onChange={(url) => setDraft({ ...draft, media_url: url })} />
                  <Button type="submit" disabled={!appParams.hasBase44Config || (!isAuthenticated && !draft.author_name) || !draft.title || !draft.body || createMutation.isPending} size="mobile" className="w-full rounded-none bg-primary text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-primary/90">
                    <Send className="mr-2 h-3 w-3" /> {createMutation.isPending ? "Submitting…" : "Submit for Review"}
                  </Button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ━━━ MOBILE FAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <MobileFAB onClick={() => setShowMobileCompose(true)} />

      {/* ━━━ SCROLL TO TOP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <ScrollToTopButton />
    </main>
  );
}