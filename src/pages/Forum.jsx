import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useInView, useMotionValue, useTransform, useSpring } from "framer-motion";
import {
  MessageSquare, Send, Pin, Search, Heart, MessageCircle,
  TrendingUp, Users, Flame, Sparkles, Clock, Eye,
  X, Bookmark, Share2, Zap, Radio, ChevronDown, ChevronUp,
  Trophy, Activity, BarChart3, Globe,
  Plane, MapPin, ThumbsUp, Reply
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FORUM_CATEGORIES, buildForumThreads, buildPendingForumPost } from "@/lib/public-forms";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";

/* ━━━ Constants & Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const emptyPost = { author_name: "", title: "", body: "", category: "General" };
const emptyReply = { author_name: "", body: "" };

const CATEGORY_META = {
  All:      { label: "All Topics",       icon: Globe,        gradient: "from-slate-400/25 to-slate-500/5",  accent: "text-slate-300",   dot: "bg-slate-300",   ring: "ring-slate-400/20",   hue: 220 },
  General:  { label: "General Chat",     icon: MessageSquare,gradient: "from-blue-500/25 to-blue-600/5",   accent: "text-blue-400",    dot: "bg-blue-400",    ring: "ring-blue-400/20",    hue: 220 },
  Travel:   { label: "Travel & Flights", icon: Plane,        gradient: "from-emerald-500/25 to-emerald-600/5",accent: "text-emerald-400",dot: "bg-emerald-400", ring: "ring-emerald-400/20", hue: 160 },
  Events:   { label: "Meetups & Parties",icon: Flame,        gradient: "from-orange-500/25 to-orange-600/5", accent: "text-orange-400", dot: "bg-orange-400",  ring: "ring-orange-400/20",  hue: 25 },
  MatchDay: { label: "Allegiant Stadium",icon: Zap,          gradient: "from-red-500/25 to-red-600/5",      accent: "text-red-400",    dot: "bg-red-400",     ring: "ring-red-400/20",     hue: 15 },
  VegasTips:{ label: "Vegas Strip Tips", icon: MapPin,       gradient: "from-amber-500/25 to-amber-600/5",  accent: "text-amber-400",  dot: "bg-amber-400",   ring: "ring-amber-400/20",   hue: 45 },
};

const getCategoryMeta = (val) => CATEGORY_META[val] || CATEGORY_META.General;

const categories = [
  { value: "All" },
  ...FORUM_CATEGORIES.map((value) => ({ value })),
];

const getEngagement = (post) => {
  const likes = Number(post.like_count ?? (Array.isArray(post.liked_by) ? post.liked_by.length : 0)) || 0;
  const views = Number(post.view_count || 0);
  return {
    likes,
    views,
    hot: post.is_pinned === true || likes >= 10,
  };
};

// Base44 returns created_date in UTC, sometimes without a timezone marker. A bare
// ISO string is parsed as LOCAL time by JS, which shows a just-posted item as
// "10h ago" in AEST. Normalise to UTC when no timezone is present.
function parseForumDate(dateStr) {
  if (!dateStr) return null;
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(String(dateStr).trim());
  const normalized = hasTz ? dateStr : `${String(dateStr).trim().replace(" ", "T")}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? new Date(dateStr) : d;
}

function timeAgo(dateStr) {
  const date = parseForumDate(dateStr);
  if (!date) return "Recently";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

/* ━━━ Animated Number Counter ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function AnimatedNumber({ value, duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * value));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);
  return <>{display}</>;
}

/* ━━━ Floating Particles Background ━━━━━━━━━━━━━━━━━━━━━━ */
function FloatingParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      dur: Math.random() * 15 + 10,
      delay: Math.random() * 5,
      opacity: Math.random() * 0.3 + 0.05,
    })), []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-primary"
          style={{ width: p.size, height: p.size, left: `${p.x}%`, top: `${p.y}%`, opacity: p.opacity }}
          animate={{ y: [0, -30, 0], x: [0, Math.random() * 20 - 10, 0], opacity: [p.opacity, p.opacity * 2, p.opacity] }}
          transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/* ━━━ User Avatar (Enhanced) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function UserAvatar({ name, size = "md", showStatus = false }) {
  const initial = (name || "?")[0].toUpperCase();
  const second = (name || "??").length > 1 ? name.split(/\s+/)?.[1]?.[0]?.toUpperCase() || "" : "";
  const seed = [...(name || "")].reduce((t, c) => t + c.charCodeAt(0), 0);
  const hues = [15, 45, 160, 220, 280, 330, 190, 30, 120, 350];
  const hue = hues[seed % hues.length];
  const sizes = { sm: "h-7 w-7 text-[9px]", md: "h-9 w-9 text-xs", lg: "h-11 w-11 text-sm" };

  return (
    <div className="relative shrink-0">
      <div
        className={`${sizes[size]} flex items-center justify-center font-bold uppercase tracking-wider`}
        style={{
          background: `linear-gradient(135deg, hsl(${hue}, 75%, 45%) 0%, hsl(${(hue + 30) % 360}, 65%, 35%) 100%)`,
          border: `1.5px solid hsl(${hue}, 70%, 55%, 0.4)`,
          boxShadow: `0 0 12px hsl(${hue}, 70%, 50%, 0.15)`,
        }}
      >
        {initial}{second}
      </div>
      {showStatus && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-background cmd-pulse" />
      )}
    </div>
  );
}

/* ━━━ Online Users Widget ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function OnlineUsersWidget({ threads }) {
  const uniqueUsers = useMemo(() => {
    const names = new Set();
    threads.forEach((t) => {
      if (t.author_name) names.add(t.author_name);
      (t.replies || []).forEach((r) => { if (r.author_name) names.add(r.author_name); });
    });
    return [...names].slice(0, 8);
  }, [threads]);

  const onlineCount = Math.min(Math.ceil(uniqueUsers.length * 0.6), uniqueUsers.length);

  return (
    <div className="border border-border/50 bg-card/20 p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-2 w-2 rounded-full bg-emerald-400 cmd-pulse" />
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          {onlineCount} fans online
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {uniqueUsers.map((name, i) => (
          <motion.div
            key={name}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            title={name}
          >
            <UserAvatar name={name} size="sm" showStatus={i < onlineCount} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ━━━ Sort Tabs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const SORT_OPTIONS = [
  { id: "latest", label: "Latest", icon: Clock },
  { id: "hot", label: "Hot", icon: Flame },
  { id: "top", label: "Top", icon: Trophy },
];

function SortTabs({ active, onChange }) {
  return (
    <div className="flex items-center border border-border/50 bg-card/30 p-0.5">
      {SORT_OPTIONS.map((opt) => {
        const isActive = active === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
              isActive ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
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

/* ━━━ Trending Card (Premium) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function TrendingCard({ thread, rank }) {
  const meta = getCategoryMeta(thread.category);
  const engagement = getEngagement(thread);
  const MetaIcon = meta.icon;

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      className="group relative overflow-hidden border border-border/30 bg-card/30 hover:border-primary/25 transition-all duration-300 cursor-pointer"
    >
      {/* Rank accent */}
      <div className={`absolute top-0 left-0 w-8 h-8 bg-gradient-to-br ${meta.gradient} flex items-end justify-start p-1`}>
        <span className="font-display text-lg font-bold text-foreground/60 leading-none">
          {rank}
        </span>
      </div>

      <div className="pl-10 pr-4 py-3">
        <div className="flex items-center gap-1.5 mb-1">
          <MetaIcon className={`h-2.5 w-2.5 ${meta.accent}`} />
          <span className={`text-[8px] font-bold uppercase tracking-wider ${meta.accent}`}>
            {meta.label}
          </span>
        </div>
        <p className="text-xs font-bold text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2">
          {thread.title}
        </p>
        <div className="flex items-center gap-3 mt-2 text-[9px] text-muted-foreground/50">
          <span className="flex items-center gap-1">
            <Heart className="h-2.5 w-2.5" /> {engagement.likes}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-2.5 w-2.5" /> {(thread.replies || []).length}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-2.5 w-2.5" /> {engagement.views}
          </span>
        </div>
      </div>

      {/* Hover glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/3 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </motion.div>
  );
}

/* ━━━ Category Pill (Interactive) ━━━━━━━━━━━━━━━━━━━━━━━━━ */
function CategoryPill({ value, isActive, onClick, count }) {
  const meta = getCategoryMeta(value);
  const MetaIcon = meta.icon;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      className={`relative flex items-center gap-2 border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-250 ${
        isActive
          ? `border-primary/40 bg-gradient-to-r ${meta.gradient} text-foreground shadow-[0_0_16px_hsl(var(--primary)/0.12),inset_0_1px_0_hsl(var(--primary)/0.1)]`
          : `border-border/50 bg-card/20 text-muted-foreground hover:text-foreground hover:bg-card/40 hover:border-border`
      }`}
    >
      <MetaIcon className={`h-3 w-3 ${isActive ? meta.accent : "text-muted-foreground/40"}`} />
      <span>{meta.label}</span>
      {count > 0 && (
        <span className={`ml-1 px-1.5 py-0 text-[8px] font-mono tabular-nums ${
          isActive ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground/50"
        }`}>
          {count}
        </span>
      )}
      {isActive && (
        <motion.div
          layoutId="activeCatLine"
          className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-accent to-primary"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </motion.button>
  );
}

/* ━━━ Post Card (Premium with 3D tilt) ━━━━━━━━━━━━━━━━━━━ */
function ForumPostCard({
  post, isAuthenticated, user, appReady, isSubmitting,
  replyOpen, replyDraft, onToggleReply, onUpdateReply, onReply, index,
}) {
  const engagement = getEngagement(post);
  const replies = post.replies || [];
  const meta = getCategoryMeta(post.category);
  const MetaIcon = meta.icon;
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-30px" });
  const queryClient = useQueryClient();
  const isLiked = isAuthenticated && Array.isArray(post.liked_by) && post.liked_by.includes(user?.id);
  const likeMutation = useMutation({
    mutationFn: () => base44.functions.invoke("forumAction", { action: "like", postId: post.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forumPosts"] }),
  });
  const toggleLike = () => {
    if (!isAuthenticated) { window.location.href = "/login?next=/forum"; return; }
    if (!likeMutation.isPending) likeMutation.mutate();
  };
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
      className={`group relative overflow-hidden border transition-all duration-300 ${
        post.is_pinned
          ? "border-primary/30 bg-gradient-to-br from-primary/[0.06] via-card/80 to-card/50 shadow-[0_0_30px_hsl(var(--primary)/0.06)]"
          : "border-border/60 bg-card/30 hover:border-primary/20 hover:shadow-[0_8px_32px_hsl(var(--primary)/0.06)]"
      }`}
    >
      {/* Top accent */}
      <div className={`h-[2px] w-full bg-gradient-to-r ${meta.gradient}`} />

      {/* Pinned shimmer */}
      {post.is_pinned && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent cmd-scan-line" />
        </div>
      )}

      {/* Hot badge */}
      {engagement.hot && !post.is_pinned && (
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-500/10 border border-orange-500/20 text-[7px] font-bold uppercase tracking-wider text-orange-400">
            <Flame className="h-2 w-2" /> Hot
          </span>
        </div>
      )}

      <div className="relative p-5 md:p-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <UserAvatar name={post.author_name} showStatus={index < 3} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-foreground">{post.author_name || "Anonymous"}</span>
              <span className="text-[10px] text-muted-foreground/30">•</span>
              <span className="text-[10px] font-mono text-muted-foreground/40 tabular-nums">{timeAgo(post.created_date)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {post.is_pinned && (
                <span className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-primary">
                  <Pin className="h-2 w-2" /> Pinned
                </span>
              )}
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border border-border/30 bg-gradient-to-r ${meta.gradient}`}>
                <MetaIcon className={`h-2.5 w-2.5 ${meta.accent}`} />
                <span className={meta.accent}>{meta.label}</span>
              </span>
            </div>
          </div>
          {/* Desktop stats */}
          <div className="hidden md:flex items-center gap-3 text-[10px] text-muted-foreground/30">
            <span className="flex items-center gap-1 font-mono tabular-nums">
              <Eye className="h-3 w-3" /> {engagement.views}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="mt-4 font-display text-xl md:text-2xl uppercase tracking-wide text-foreground leading-tight group-hover:text-primary transition-colors duration-300">
          {post.title || "Discussion Thread"}
        </h3>

        {/* Body */}
        <div className="mt-3">
          <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground/80">{displayBody}</p>
          {shouldTruncate && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary/70 hover:text-primary transition-colors"
            >
              {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Read more</>}
            </button>
          )}
        </div>

        {/* Engagement Bar */}
        <div className="mt-5 flex flex-wrap items-center gap-0.5 border-t border-border/20 pt-3">
          <motion.button
            type="button"
            onClick={toggleLike}
            disabled={likeMutation.isPending}
            whileTap={{ scale: 0.9 }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
              isLiked
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground/50 hover:text-primary hover:bg-primary/5 border border-transparent"
            }`}
          >
            <motion.div animate={isLiked ? { scale: [1, 1.4, 1] } : {}} transition={{ duration: 0.3 }}>
              <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-primary" : ""}`} />
            </motion.div>
            <span className="tabular-nums">{engagement.likes}</span>
          </motion.button>

          <button
            type="button"
            onClick={onToggleReply}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all duration-200 border ${
              replyOpen
                ? "bg-accent/10 text-accent border-accent/20"
                : "text-muted-foreground/50 hover:text-accent hover:bg-accent/5 border-transparent"
            }`}
          >
            <Reply className="h-3.5 w-3.5" />
            <span className="tabular-nums">{replies.length}</span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-wider">
              {replies.length === 1 ? "Reply" : "Replies"}
            </span>
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground/30 hover:text-foreground/50 transition-colors border border-transparent"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground/30 hover:text-foreground/50 transition-colors border border-transparent"
          >
            <Bookmark className="h-3.5 w-3.5" />
          </button>

          <div className="flex-1" />

          {/* Mobile stats */}
          <div className="flex md:hidden items-center gap-1 text-[10px] text-muted-foreground/30">
            <Eye className="h-3 w-3" />
            <span className="font-mono tabular-nums">{engagement.views}</span>
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
                  <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/40 flex items-center gap-1.5">
                    <MessageCircle className="h-3 w-3" />
                    {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
                  </p>
                  {hiddenCount > 0 && !showAllReplies && (
                    <button
                      type="button"
                      onClick={() => setShowAllReplies(true)}
                      className="text-[9px] font-bold uppercase tracking-wider text-primary/60 hover:text-primary transition-colors"
                    >
                      Show {hiddenCount} more
                    </button>
                  )}
                </div>
                {visibleReplies.map((reply, ri) => (
                  <motion.div
                    key={reply.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: ri * 0.06, ease: "easeOut" }}
                    className="group/reply flex gap-3 border-l-2 border-primary/15 bg-muted/[0.03] hover:bg-muted/[0.06] px-4 py-3 transition-colors"
                  >
                    <UserAvatar name={reply.author_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{reply.author_name || "Member"}</span>
                        <span className="text-[9px] font-mono text-muted-foreground/30 tabular-nums">{timeAgo(reply.created_date)}</span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-muted-foreground/70">{reply.body}</p>
                      <div className="flex items-center gap-3 mt-2 opacity-0 group-hover/reply:opacity-100 transition-opacity">
                        <button type="button" className="text-[9px] text-muted-foreground/30 hover:text-primary transition-colors flex items-center gap-1">
                          <ThumbsUp className="h-2.5 w-2.5" /> Like
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!replyOpen) onToggleReply();
                            onUpdateReply({ body: `@${reply.author_name || "Member"} ` });
                          }}
                          className="text-[9px] text-muted-foreground/30 hover:text-accent transition-colors flex items-center gap-1"
                        >
                          <Reply className="h-2.5 w-2.5" /> Reply
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {showAllReplies && hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllReplies(false)}
                    className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 hover:text-muted-foreground pt-1 transition-colors"
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
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/40">
                  Write a Reply
                </p>
                {isAuthenticated ? (
                  <div className="flex items-center gap-2 border border-border/30 bg-muted/[0.04] px-3 py-2">
                    <UserAvatar name={user?.full_name || user?.email} size="sm" />
                    <span className="text-xs text-muted-foreground/60">
                      Replying as <span className="font-bold text-foreground">{user?.full_name || user?.email}</span>
                    </span>
                  </div>
                ) : (
                  <Input
                    required placeholder="Your name"
                    value={replyDraft.author_name}
                    onChange={(e) => onUpdateReply({ author_name: e.target.value })}
                    className="h-10 rounded-none border-border bg-background text-sm"
                  />
                )}
                <Textarea
                  required
                  placeholder={`Reply to ${post.author_name || "this thread"}…`}
                  value={replyDraft.body}
                  onChange={(e) => onUpdateReply({ body: e.target.value })}
                  className="min-h-20 rounded-none border-border bg-background text-sm leading-relaxed resize-none"
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={onToggleReply} className="h-8 rounded-none text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!appReady || (!isAuthenticated && !replyDraft.author_name) || !replyDraft.body || isSubmitting}
                    className="h-8 rounded-none bg-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/90"
                  >
                    <Send className="mr-1.5 h-3 w-3" /> {isSubmitting ? "Sending…" : "Post Reply"}
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

/* ━━━ Compose Sidebar (Premium) ━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ComposeSidebar({ draft, setDraft, isAuthenticated, user, submittedForReview, onSubmit, isPending, allThreads }) {
  return (
    <aside className="sticky top-24 space-y-4">
      {/* Compose Card */}
      <div className="border border-border/60 bg-card/30 cmd-glass overflow-hidden">
        <div className="h-[2px] w-full cmd-accent-bar" />
        <div className="p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-primary/10 border border-primary/20">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg uppercase tracking-wide">Start a Discussion</h2>
              <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/40">Connect with fellow fans</p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground/60 mt-3 mb-4">
            Got questions about tickets, meetups, flights, or Vegas? Post a topic and connect with other Rugby League fans.
          </p>

          <AnimatePresence>
            {submittedForReview && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="mb-4 border border-emerald-500/25 bg-emerald-500/[0.07] p-3 overflow-hidden"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  <p className="text-xs font-bold text-emerald-400">Post submitted!</p>
                </div>
                <p className="text-[10px] text-emerald-400/60 mt-1">Your post is being reviewed and will appear shortly.</p>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={onSubmit} className="space-y-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-2 border border-border/30 bg-muted/[0.04] px-3 py-2">
                <UserAvatar name={user?.full_name || user?.email} size="sm" showStatus />
                <div>
                  <p className="text-xs font-bold text-foreground">{user?.full_name || user?.email}</p>
                  <p className="text-[8px] text-muted-foreground/40">Authenticated</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Your Name</label>
                <Input required placeholder="e.g. Tommy R." value={draft.author_name} onChange={(e) => setDraft({ ...draft, author_name: e.target.value })} className="h-9 rounded-none border-border bg-background text-sm" />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Category</label>
              <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                <SelectTrigger className="h-9 rounded-none border-border bg-background text-left text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.filter((c) => c.value !== "All").map((c) => {
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

            <div className="space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Topic Title</label>
              <Input required placeholder="What's on your mind?" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="h-9 rounded-none border-border bg-background text-sm" />
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Message</label>
              <Textarea required placeholder="Share your thoughts, questions, or tips…" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="min-h-24 rounded-none border-border bg-background text-sm leading-relaxed resize-none" />
            </div>

            <Button
              type="submit"
              disabled={!appParams.hasBase44Config || (!isAuthenticated && !draft.author_name) || !draft.title || !draft.body || isPending}
              className="w-full h-10 rounded-none bg-primary text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-primary/90 transition-all group"
            >
              <Send className="mr-2 h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              {isPending ? "Submitting…" : "Submit for Review"}
            </Button>
            <p className="text-[8px] text-center text-muted-foreground/25">Posts are reviewed before publishing</p>
          </form>
        </div>
      </div>

      {/* Online Users */}
      <OnlineUsersWidget threads={allThreads} />

      {/* Quick Stats */}
      <div className="border border-border/50 bg-card/20 p-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50 mb-3">Forum Stats</p>
        <div className="space-y-2.5">
          {[
            { icon: MessageSquare, label: "Total Threads", value: allThreads.length },
            { icon: MessageCircle, label: "Total Replies", value: allThreads.reduce((s, t) => s + (t.replies || []).length, 0) },
            { icon: Users, label: "Contributors", value: new Set(allThreads.map((t) => t.author_name)).size },
            { icon: BarChart3, label: "Total Views", value: allThreads.reduce((s, t) => s + getEngagement(t).views, 0) },
          ].map(({ icon: SIcon, label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
                <SIcon className="h-3 w-3" /> {label}
              </span>
              <span className="text-[10px] font-mono font-bold text-muted-foreground tabular-nums">{value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Guidelines */}
      <div className="border border-border/30 bg-card/10 p-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/40 mb-2">Community Guidelines</p>
        <ul className="space-y-1.5">
          {["Be respectful to fellow fans", "Keep discussions on-topic", "No spam or commercial posts", "Share tips, ask questions, have fun"].map((rule) => (
            <li key={rule} className="flex items-start gap-2 text-[10px] text-muted-foreground/35">
              <span className="mt-1 h-1 w-1 rounded-full bg-primary/30 shrink-0" />
              {rule}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/* ━━━ MAIN FORUM COMPONENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function Forum() {
  const { isAuthenticated, user } = useAuth();
  const [draft, setDraft] = useState(emptyPost);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("latest");
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
        author_name: post.author_name, title: post.title, body: post.body,
        category: post.category, parent_id: post.parent_id,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forumPosts"] });
      setDraft(emptyPost); setReplyDrafts({}); setActiveReplyId(null); setSubmittedForReview(true);
    },
  });

  const handlePost = (e) => {
    e.preventDefault();
    if ((!isAuthenticated && !draft.author_name) || !draft.title || !draft.body) return;
    createMutation.mutate(draft);
  };

  const getReplyDraft = (postId) => replyDrafts[postId] || emptyReply;
  const updateReplyDraft = (postId, updates) => {
    setReplyDrafts((c) => ({ ...c, [postId]: { ...emptyReply, ...c[postId], ...updates } }));
  };

  const handleReply = (post, e) => {
    e.preventDefault();
    const reply = getReplyDraft(post.id);
    if (!post.id || (!isAuthenticated && !reply.author_name) || !reply.body) return;
    createMutation.mutate({
      author_name: reply.author_name,
      title: `Re: ${post.title || "Discussion Thread"}`,
      body: reply.body, category: post.category || "General", parent_id: post.id,
    });
  };

  const allThreads = buildForumThreads(posts);

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

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      {/* ━━━ HERO SECTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 cmd-grid-bg opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-transparent to-background" />
        <FloatingParticles />

        <div className="relative z-10 mx-auto max-w-6xl px-5 pb-10 pt-28 md:px-8 md:pt-32 md:pb-12">
          {/* Breadcrumb */}
          <motion.nav initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 mb-5">
            <Link to="/" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/30 hover:text-primary transition-colors">Home</Link>
            <span className="text-muted-foreground/20">/</span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold">Forum</span>
          </motion.nav>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}>
              <div className="flex items-center gap-2 mb-3">
                <Radio className="h-3.5 w-3.5 text-primary cmd-pulse" />
                <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-primary font-mono">Fan Discussion Board</p>
                <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[7px] font-bold uppercase tracking-wider text-emerald-400">
                  <Activity className="h-2 w-2" /> Live
                </span>
              </div>
              <h1 className="font-display text-5xl sm:text-6xl md:text-7xl uppercase tracking-tight leading-[0.9]">
                <span className="block">Aussies in</span>
                <span className="block bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Vegas</span>
              </h1>
              <p className="mt-4 max-w-md text-sm text-muted-foreground/60 leading-relaxed">
                Connect with fellow Rugby League fans heading to Las Vegas. Share tips, plan meetups, and get the inside word on the takeover.
              </p>
            </motion.div>

            {/* Stats Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="flex border border-border/40 bg-card/20 cmd-glass divide-x divide-border/30"
            >
              {[
                { icon: MessageSquare, value: allThreads.length, label: "Threads" },
                { icon: MessageCircle, value: totalReplies, label: "Replies" },
                { icon: Users, value: uniqueMembers, label: "Members" },
              ].map(({ icon: SIcon, value, label }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3 md:px-5">
                  <div className="p-1.5 bg-muted/20 border border-border/30">
                    <SIcon className="h-3.5 w-3.5 text-primary/70" />
                  </div>
                  <div>
                    <p className="font-display text-xl tabular-nums text-foreground leading-none">
                      <AnimatedNumber value={value} />
                    </p>
                    <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground/40">{label}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ━━━ MAIN CONTENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-8">
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
                <span className="text-[8px] font-mono text-muted-foreground/30">Updated live</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {[...allThreads].sort((a, b) => getEngagement(b).likes - getEngagement(a).likes).slice(0, 3).map((t, i) => (
                  <TrendingCard key={t.id} thread={t} rank={i + 1} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
          {/* ━━━ LEFT: Feed ━━━ */}
          <div className="space-y-4">
            {/* Search + Filter Bar */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="border border-border/40 bg-card/20 cmd-glass overflow-hidden"
            >
              <div className="p-4 space-y-3">
                {/* Search + Sort row */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/30" />
                    <Input
                      placeholder="Search discussions, topics, or users…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 rounded-none border-border/50 bg-background/60 pl-9 text-sm"
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
                <div className="flex flex-wrap gap-1.5">
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
                <div className="flex items-center justify-between pt-1 border-t border-border/20">
                  <p className="text-[9px] font-mono text-muted-foreground/30">
                    {filteredThreads.length} {filteredThreads.length === 1 ? "thread" : "threads"}
                    {selectedCategory !== "All" ? ` in ${getCategoryMeta(selectedCategory).label}` : ""}
                    {searchQuery ? ` matching "${searchQuery}"` : ""}
                    {sortBy !== "latest" ? ` · sorted by ${sortBy}` : ""}
                  </p>
                  {(selectedCategory !== "All" || searchQuery || sortBy !== "latest") && (
                    <button
                      type="button"
                      onClick={() => { setSelectedCategory("All"); setSearchQuery(""); setSortBy("latest"); }}
                      className="text-[9px] font-bold uppercase tracking-wider text-primary/60 hover:text-primary transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Mobile compose CTA */}
            <div className="lg:hidden">
              <Button
                onClick={() => setShowMobileCompose(true)}
                className="w-full h-10 rounded-none bg-primary text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-primary/90"
              >
                <MessageSquare className="mr-2 h-3.5 w-3.5" /> Start a Discussion
              </Button>
            </div>

            {/* Thread Feed */}
            <div className="space-y-3">
              {filteredThreads.map((post, index) => (
                <ForumPostCard
                  key={post.id} post={post} index={index}
                  isAuthenticated={isAuthenticated} user={user}
                  appReady={appParams.hasBase44Config} isSubmitting={createMutation.isPending}
                  replyOpen={activeReplyId === post.id} replyDraft={getReplyDraft(post.id)}
                  onToggleReply={() => setActiveReplyId(activeReplyId === post.id ? null : post.id)}
                  onUpdateReply={(updates) => updateReplyDraft(post.id, updates)}
                  onReply={(e) => handleReply(post, e)}
                />
              ))}

              {filteredThreads.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-border/30 bg-card/20 p-16 text-center">
                  <div className="inline-flex p-4 bg-muted/10 border border-border/30 mb-4">
                    <Search className="h-8 w-8 text-muted-foreground/15" />
                  </div>
                  <p className="font-display text-xl uppercase text-muted-foreground/30">No discussions found</p>
                  <p className="text-xs text-muted-foreground/20 mt-1 max-w-sm mx-auto">
                    Try adjusting your filters or be the first to start a discussion in this category.
                  </p>
                  <Button
                    onClick={() => { setSelectedCategory("All"); setSearchQuery(""); setSortBy("latest"); }}
                    variant="outline"
                    className="mt-4 h-9 rounded-none text-[10px] font-bold uppercase tracking-wider border-border/30"
                  >
                    Clear filters
                  </Button>
                </motion.div>
              )}
            </div>
          </div>

          {/* ━━━ RIGHT: Sidebar ━━━ */}
          <div className="hidden lg:block">
            <ComposeSidebar
              draft={draft} setDraft={setDraft}
              isAuthenticated={isAuthenticated} user={user}
              submittedForReview={submittedForReview}
              onSubmit={handlePost} isPending={createMutation.isPending}
              allThreads={allThreads}
            />
          </div>
        </div>
      </div>

      {/* ━━━ MOBILE COMPOSE SHEET ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <AnimatePresence>
        {showMobileCompose && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70 lg:hidden" onClick={() => setShowMobileCompose(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto bg-card border-t border-border cmd-scrollbar lg:hidden"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-border/50" />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg uppercase tracking-wide">Start a Discussion</h2>
                  <button type="button" onClick={() => setShowMobileCompose(false)} className="p-1.5 text-muted-foreground hover:text-foreground border border-border/30 hover:border-border transition-colors">
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

                <form onSubmit={(e) => { handlePost(e); setShowMobileCompose(false); }} className="space-y-3">
                  {isAuthenticated ? (
                    <div className="flex items-center gap-2 border border-border/30 bg-muted/[0.04] px-3 py-2">
                      <UserAvatar name={user?.full_name || user?.email} size="sm" showStatus />
                      <span className="text-xs font-bold text-foreground">{user?.full_name || user?.email}</span>
                    </div>
                  ) : (
                    <Input required placeholder="Your name" value={draft.author_name} onChange={(e) => setDraft({ ...draft, author_name: e.target.value })} className="h-9 rounded-none border-border bg-background text-sm" />
                  )}
                  <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                    <SelectTrigger className="h-9 rounded-none border-border bg-background text-left text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.filter((c) => c.value !== "All").map((c) => <SelectItem key={c.value} value={c.value}>{getCategoryMeta(c.value).label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input required placeholder="Topic title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="h-9 rounded-none border-border bg-background text-sm" />
                  <Textarea required placeholder="What's on your mind?" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="min-h-24 rounded-none border-border bg-background text-sm leading-relaxed resize-none" />
                  <Button type="submit" disabled={!appParams.hasBase44Config || (!isAuthenticated && !draft.author_name) || !draft.title || !draft.body || createMutation.isPending} className="w-full h-10 rounded-none bg-primary text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-primary/90">
                    <Send className="mr-2 h-3 w-3" /> {createMutation.isPending ? "Submitting…" : "Submit for Review"}
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
