import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useInView, useMotionValue, useTransform, useSpring } from "framer-motion";
import {
  MessageSquare, Send, Pin, Search, Heart, MessageCircle,
  TrendingUp, Users, Flame, Sparkles, Clock, Eye,
  X, Bookmark, Share2, Zap, Radio, ChevronDown, ChevronUp, Trash2,
  Trophy, Activity, BarChart3, Globe,
  Plane, MapPin, Reply, ArrowUp
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
import ForumMedia from "@/components/forum/ForumMedia";
import MentionTextarea from "@/components/forum/MentionTextarea";
import MediaAttach from "@/components/forum/MediaAttach";
import StadiumSeatPlanner from "@/components/forum/StadiumSeatPlanner";
import ScorePredictor from "@/components/forum/ScorePredictor";
import SlotMachineBadgeUnlock from "@/components/forum/SlotMachineBadgeUnlock";
import TeamCrest from "@/components/public/TeamCrest";



/* ━━━ Constants & Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const emptyPost = { author_name: "", title: "", body: "", category: "General", media_url: "" };
const emptyReply = { author_name: "", body: "", media_url: "" };

const CATEGORY_META = {
  All:      { label: "All Topics",       icon: Globe,        gradient: "from-slate-400/25 to-slate-500/5",  accent: "text-slate-300",   dot: "bg-slate-300",   ring: "ring-slate-400/20",   hue: 220, glow: "rgba(148,163,184,0.15)" },
  General:  { label: "General Chat",     icon: MessageSquare,gradient: "from-blue-500/25 to-blue-600/5",   accent: "text-blue-400",    dot: "bg-blue-400",    ring: "ring-blue-400/20",    hue: 220, glow: "rgba(96,165,250,0.2)" },
  Travel:   { label: "Travel & Flights", icon: Plane,        gradient: "from-emerald-500/25 to-emerald-600/5",accent: "text-emerald-400",dot: "bg-emerald-400", ring: "ring-emerald-400/20", hue: 160, glow: "rgba(52,211,153,0.2)" },
  Events:   { label: "Meetups & Parties",icon: Flame,        gradient: "from-orange-500/25 to-orange-600/5", accent: "text-orange-400", dot: "bg-orange-400",  ring: "ring-orange-400/20",  hue: 25, glow: "rgba(251,146,60,0.2)" },
  MatchDay: { label: "Allegiant Stadium",icon: Zap,          gradient: "from-red-500/25 to-red-600/5",      accent: "text-red-400",    dot: "bg-red-400",     ring: "ring-red-400/20",     hue: 15, glow: "rgba(248,113,113,0.2)" },
  VegasTips:{ label: "Vegas Strip Tips", icon: MapPin,       gradient: "from-amber-500/25 to-amber-600/5",  accent: "text-amber-400",  dot: "bg-amber-400",   ring: "ring-amber-400/20",   hue: 45, glow: "rgba(251,191,36,0.2)" },
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

/* ━━━ Recency Score (0-1, 1 = just posted) ━━━━━━━━━━━━━━━━ */
function getRecencyScore(dateStr) {
  const date = parseForumDate(dateStr);
  if (!date) return 0.1;
  const diff = Date.now() - date.getTime();
  const hoursDiff = diff / (1000 * 60 * 60);
  if (hoursDiff < 1) return 1;
  if (hoursDiff < 24) return 0.8;
  if (hoursDiff < 72) return 0.5;
  if (hoursDiff < 168) return 0.3;
  return 0.1;
}

/* ━━━ Name Hash for deterministic mock data ━━━━━━━━━━━━━━━ */
function nameHash(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/* ━━━ Author Badge Logic ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const BADGE_LEVELS = [
  { min: 10, emoji: "🏆", label: "Legend",  bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-400" },
  { min: 5,  emoji: "⭐", label: "Regular", bg: "bg-slate-400/15", border: "border-slate-400/30", text: "text-slate-300" },
  { min: 3,  emoji: "🔥", label: "Active",  bg: "bg-orange-500/15", border: "border-orange-500/30", text: "text-orange-400" },
  { min: 1,  emoji: "👋", label: "New",     bg: "bg-blue-500/15", border: "border-blue-500/30", text: "text-blue-400" },
];

function getAuthorBadge(name, authorPostCounts) {
  const count = authorPostCounts[name] || 0;
  for (const badge of BADGE_LEVELS) {
    if (count >= badge.min) return badge;
  }
  return null;
}

/* ━━━ Reaction Emojis ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const REACTIONS = [
  { emoji: "❤️", label: "Love" },
  { emoji: "🏉", label: "Rugby" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "🎉", label: "Celebrate" },
  { emoji: "👏", label: "Clap" },
];

/* ━━━ Share / Save helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const threadUrl = (post) => {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/forum?thread=${post?.id}`;
};

async function shareThread(post) {
  const url = threadUrl(post);
  const title = post?.title || "Rugby League Takeover forum";
  try {
    if (navigator.share) {
      await navigator.share({ title, text: title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: "Thread link copied to your clipboard." });
  } catch {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Thread link copied to your clipboard." });
    } catch {
      toast({ title: "Couldn't share", description: url });
    }
  }
}

const SAVED_KEY = "rlt_saved_posts";
const getSavedPosts = () => {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); } catch { return []; }
};
const isPostSaved = (id) => getSavedPosts().includes(id);
const toggleSavedPost = (id) => {
  const saved = getSavedPosts();
  const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next.includes(id);
};

function ShareButton({ post }) {
  return (
    <button type="button" onClick={() => shareThread(post)} title="Share / copy link" className="flex min-h-11 items-center justify-center gap-1.5 border border-transparent px-3 py-2 text-xs text-slate-300 transition-colors hover:text-foreground">
      <Share2 className="h-3.5 w-3.5" />
    </button>
  );
}

function SaveButton({ post }) {
  const [saved, setSaved] = useState(() => isPostSaved(post?.id));
  const onToggle = () => {
    const now = toggleSavedPost(post?.id);
    setSaved(now);
    toast({ title: now ? "Saved" : "Removed", description: now ? "Added to your saved threads." : "Removed from saved threads." });
  };
  return (
    <button type="button" onClick={onToggle} title={saved ? "Saved" : "Save thread"} className={`flex min-h-11 items-center justify-center gap-1.5 border border-transparent px-3 py-2 text-xs transition-colors ${saved ? "text-primary" : "text-slate-300 hover:text-foreground"}`}>
      <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-primary" : ""}`} />
    </button>
  );
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
function UserAvatar({ name, size = "md", showStatus = false, src = "" }) {
  const initial = (name || "?")[0].toUpperCase();
  const second = (name || "??").length > 1 ? name.split(/\s+/)?.[1]?.[0]?.toUpperCase() || "" : "";
  const seed = [...(name || "")].reduce((t, c) => t + c.charCodeAt(0), 0);
  const hues = [15, 45, 160, 220, 280, 330, 190, 30, 120, 350];
  const hue = hues[seed % hues.length];
  const sizes = { sm: "h-7 w-7 text-[9px]", md: "h-9 w-9 text-xs", lg: "h-11 w-11 text-sm", xl: "h-14 w-14 text-lg" };

  return (
    <div className="relative shrink-0">
      {src ? (
        <img
          src={src}
          alt={name || "Member"}
          className={`${sizes[size]} rounded-full object-cover`}
          style={{ border: `1.5px solid hsl(${hue}, 70%, 55%, 0.4)`, boxShadow: `0 0 12px hsl(${hue}, 70%, 50%, 0.15)` }}
        />
      ) : (
        <div
          className={`${sizes[size]} flex items-center justify-center font-bold uppercase tracking-wider rounded-full`}
          style={{
            background: `linear-gradient(135deg, hsl(${hue}, 75%, 45%) 0%, hsl(${(hue + 30) % 360}, 65%, 35%) 100%)`,
            border: `1.5px solid hsl(${hue}, 70%, 55%, 0.4)`,
            boxShadow: `0 0 12px hsl(${hue}, 70%, 50%, 0.15)`,
          }}
        >
          {initial}{second}
        </div>
      )}
      {showStatus && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-background cmd-pulse" />
      )}
    </div>
  );
}

/* ━━━ User Profile Hover Card ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function UserProfileHoverCard({ name, authorPostCounts, authorReplyCounts, children }) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  const postCount = authorPostCounts[name] || 0;
  const replyCount = authorReplyCounts[name] || 0;
  const hash = nameHash(name);
  const memberDays = (hash % 365) + 30;
  const memberDate = new Date(Date.now() - memberDays * 24 * 60 * 60 * 1000);
  const badge = getAuthorBadge(name, authorPostCounts);

  const handleEnter = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setPosition({ x: rect.left, y: rect.bottom + 8 });
      }
      setShow(true);
    }, 400);
  }, []);

  const handleLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(false), 200);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="inline-flex"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed z-[100] w-64 border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/30 overflow-hidden"
            style={{ left: Math.min(position.x, window.innerWidth - 280), top: position.y }}
            onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
            onMouseLeave={handleLeave}
          >
            <div className="h-[2px] w-full cmd-accent-bar" />
            <div className="p-4">
              <div className="flex items-center gap-3">
                <UserAvatar name={name} size="xl" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-bold text-foreground truncate uppercase tracking-wide">{name || "Anonymous"}</p>
                  {badge && (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${badge.bg} ${badge.border} ${badge.text} border mt-1`}>
                      {badge.emoji} {badge.label}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-300">
                <Clock className="h-3 w-3" />
                <span>Member since {memberDate.toLocaleDateString("en-AU", { month: "short", year: "numeric" })}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="border border-border/30 bg-muted/[0.04] p-2.5 text-center">
                  <p className="font-display text-lg font-bold text-foreground tabular-nums">{postCount}</p>
                  <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-200">Posts</p>
                </div>
                <div className="border border-border/30 bg-muted/[0.04] p-2.5 text-center">
                  <p className="font-display text-lg font-bold text-foreground tabular-nums">{replyCount}</p>
                  <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-200">Replies</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ━━━ User Achievements Badge Component ━━━━━━━━━━━━━━━━━━ */
function UserAchievements({ isMe }) {
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    const handleBadgeEvent = () => {
      setTrigger((t) => t + 1);
    };
    window.addEventListener("rlt_badge_event", handleBadgeEvent);
    return () => window.removeEventListener("rlt_badge_event", handleBadgeEvent);
  }, []);

  if (!isMe) return null;
  
  let voted = false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("rlt_match_voted_")) {
        voted = true;
        break;
      }
    }
  } catch (err) {}
  
  const claimed = !!localStorage.getItem("rlt_seat_claimed");
  const posted = !!localStorage.getItem("rlt_forum_posted");
  const slotSpins = !!localStorage.getItem("rlt_slot_spins");
  const slotJackpot = !!localStorage.getItem("rlt_slot_jackpot");
  
  if (!voted && !claimed && !posted && !slotSpins && !slotJackpot) return null;
  
  return (
    <div className="inline-flex items-center gap-1 ml-1" title="Vegas Supporter Achievements">
      {voted && (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[8px]" title="Expert Tipster (Unlocked)">
          🏆
        </span>
      )}
      {claimed && (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[8px]" title="Stadium Resident (Unlocked)">
          📍
        </span>
      )}
      {posted && (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center bg-pink-500/10 border border-pink-500/30 text-pink-400 text-[8px]" title="Hype Master (Unlocked)">
          ⚡
        </span>
      )}
      {slotSpins && (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[8px]" title="Vegas High Roller (Unlocked)">
          🎰
        </span>
      )}
      {slotJackpot && (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center bg-red-500/10 border border-red-500/30 text-red-400 text-[8px] animate-bounce" style={{ animationDuration: "1s" }} title="Vegas Jackpot Winner (Unlocked)">
          🔥
        </span>
      )}
    </div>
  );
}

/* ━━━ Author Badge Component ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function AuthorBadge({ name, authorPostCounts }) {
  const badge = getAuthorBadge(name, authorPostCounts);
  if (!badge) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider ${badge.bg} ${badge.border} ${badge.text} border`}>
      {badge.emoji} {badge.label}
    </span>
  );
}

/* ━━━ Author Meta (opt-in location / team shown next to name) ━━ */
function AuthorMeta({ meta, className = "" }) {
  if (!meta || (!meta.location && !meta.team)) return null;
  return (
    <>
      {meta.location && (
        <span className={`inline-flex items-center gap-1 text-[10px] text-slate-300 font-semibold ${className}`} title={meta.location}>📍 {meta.location}</span>
      )}
      {meta.team && (
        <span className={`inline-flex items-center gap-1 text-[10px] text-slate-300 font-semibold ${className}`} title={`Supports ${meta.team}`}>
          <TeamCrest name={meta.team} logo={meta.teamLogo} className="h-4 w-4 text-[7px]" /> {meta.team}
        </span>
      )}
    </>
  );
}

/* ━━━ Reaction Picker ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ReactionPicker({ postId, isLiked, likeCount, onLike, isPending }) {
  const [showPicker, setShowPicker] = useState(false);
  // The viewer's own chosen reaction emoji, remembered per post.
  const reactionKey = `rlt_reaction_${postId}`;
  const [myReaction, setMyReaction] = useState(() => {
    try { return localStorage.getItem(reactionKey) || ""; } catch { return ""; }
  });
  const timerRef = useRef(null);

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowPicker(true);
  };

  const handleLeave = () => {
    timerRef.current = setTimeout(() => setShowPicker(false), 300);
  };

  const handleReaction = (emoji) => {
    setMyReaction(emoji);
    try { localStorage.setItem(reactionKey, emoji); } catch { /* ignore */ }
    if (!isLiked) onLike(); // picking a reaction also registers the like
    setShowPicker(false);
  };

  // Show the viewer's own reaction if they've liked; otherwise a neutral heart.
  const dominantEmoji = (isLiked && myReaction) || myReaction || "❤️";

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <motion.button
        type="button"
        onClick={onLike}
        disabled={isPending}
        whileTap={{ scale: 0.9 }}
        className={`flex min-h-11 items-center gap-1.5 px-3 py-2 text-xs font-bold transition-all duration-200 ${
          isLiked
            ? "bg-primary/10 text-primary border border-primary/20"
            : "text-slate-300 hover:text-primary hover:bg-primary/5 border border-transparent"
        }`}
      >
        <motion.span
          animate={isLiked ? { scale: [1, 1.4, 1] } : {}}
          transition={{ duration: 0.3 }}
          className="text-sm"
        >
          {dominantEmoji}
        </motion.span>
        <span className="tabular-nums">{likeCount}</span>
      </motion.button>

      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute bottom-full left-0 mb-2 flex items-center gap-0.5 p-1.5 border border-border/60 bg-card/95 backdrop-blur-xl shadow-xl shadow-black/20 z-50"
          >
            {REACTIONS.map((r) => (
              <motion.button
                key={r.emoji}
                type="button"
                onClick={() => handleReaction(r.emoji)}
                whileHover={{ scale: 1.3, y: -4 }}
                whileTap={{ scale: 0.85 }}
                className={`flex min-h-11 min-w-11 flex-col items-center justify-center px-2 py-1 transition-all rounded-sm ${
                  myReaction === r.emoji ? "bg-primary/10" : "hover:bg-muted/20"
                }`}
                title={r.label}
              >
                <span className="text-lg leading-none">{r.emoji}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ━━━ Live Activity Ticker ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function LiveActivityTicker({ threads }) {
  const [dismissed, setDismissed] = useState(false);

  const activities = useMemo(() => {
    const items = [];
    threads.slice(0, 15).forEach((t) => {
      const catMeta = getCategoryMeta(t.category);
      items.push({
        id: `post-${t.id}`,
        text: `🏉 ${t.author_name || "Someone"} posted in ${catMeta.label}`,
        time: timeAgo(t.created_date),
      });
      (t.replies || []).slice(0, 2).forEach((r) => {
        items.push({
          id: `reply-${r.id}`,
          text: `💬 ${r.author_name || "Someone"} replied to ${(t.title || "a thread").slice(0, 30)}${(t.title || "").length > 30 ? "…" : ""}`,
          time: timeAgo(r.created_date),
        });
      });
    });
    return items.slice(0, 20);
  }, [threads]);

  if (dismissed || activities.length === 0) return null;

  const tickerContent = activities.map(a => a.text).join("    •    ");
  const doubled = `${tickerContent}    •    ${tickerContent}`;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="relative border border-border/30 bg-card/20 overflow-hidden mb-4"
    >
      <div className="flex items-center w-full min-w-0">
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-r border-border/30 bg-primary/5">
          <Activity className="h-3 w-3 text-primary cmd-pulse" />
          <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-primary">Live</span>
        </div>
        <div className="min-w-0 flex-1 overflow-hidden py-2">
          <motion.div
            className="whitespace-nowrap text-[10px] text-slate-300 font-mono font-bold"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: activities.length * 4, repeat: Infinity, ease: "linear" }}
          >
            {doubled}
          </motion.div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 p-2 text-slate-400 hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </motion.div>
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
    <div className="grid grid-cols-3 border border-border/50 bg-card/30 p-0.5 sm:flex sm:items-center">
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

/* ━━━ Trending Card (Premium) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function TrendingCard({ thread, rank, onClick }) {
  const meta = getCategoryMeta(thread.category);
  const engagement = getEngagement(thread);
  const MetaIcon = meta.icon;

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      onClick={onClick}
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
      className={`relative flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-250 ${
        isActive
          ? `border-primary/40 bg-gradient-to-r ${meta.gradient} text-foreground shadow-[0_0_16px_hsl(var(--primary)/0.12),inset_0_1px_0_hsl(var(--primary)/0.1)]`
          : `border-border/50 bg-card/20 text-slate-300 hover:text-foreground hover:bg-card/40 hover:border-border`
      }`}
    >
      <MetaIcon className={`h-3 w-3 ${isActive ? meta.accent : "text-slate-400"}`} />
      <span>{meta.label}</span>
      {count > 0 && (
        <span className={`ml-1 px-1.5 py-0 text-[8px] font-mono tabular-nums ${
          isActive ? "bg-primary/20 text-primary" : "bg-muted/30 text-slate-300"
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

/* ━━━ Thread Detail Modal ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ThreadDetailModal({ post, onClose, isAuthenticated, user, appReady, isSubmitting, replyDraft, onUpdateReply, onReply, replyApi, authorPostCounts, authorReplyCounts, resolveAvatar, resolveMeta }) {
  const meta = getCategoryMeta(post.category);
  const MetaIcon = meta.icon;
  const engagement = getEngagement(post);
  const replies = post.replies || [];
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

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 60, scale: 0.96 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="ios-sheet fixed inset-x-0 bottom-0 z-[81] flex max-h-[92dvh] flex-col overflow-hidden border-t border-border/60 bg-card/95 shadow-2xl shadow-black/30 md:inset-x-[10%] md:inset-y-8 md:max-h-none md:border"
      >
        {/* Top accent */}
        <div className={`h-[3px] w-full bg-gradient-to-r ${meta.gradient}`} />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-4 py-3 shrink-0 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 bg-gradient-to-br ${meta.gradient} border border-border/30`}>
              <MetaIcon className={`h-4 w-4 ${meta.accent}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-[8px] font-bold uppercase tracking-[0.25em] ${meta.accent}`}>{meta.label}</p>
              <h2 className="font-display text-lg md:text-xl uppercase tracking-wide text-foreground truncate">{post.title || "Discussion Thread"}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-border/30 hover:border-border text-muted-foreground hover:text-foreground transition-all hover:bg-muted/10"
            aria-label="Close thread"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="ios-scroll flex-1 overflow-y-auto cmd-scrollbar">
          <div className="p-4 sm:p-6 md:p-8">
            {/* Author info */}
            <div className="flex items-start gap-3 mb-6">
              <UserProfileHoverCard name={post.author_name} authorPostCounts={authorPostCounts} authorReplyCounts={authorReplyCounts}>
                <UserAvatar name={post.author_name} size="lg" src={resolveAvatar ? resolveAvatar(post.user_id, post.author_avatar) : post.author_avatar} />
              </UserProfileHoverCard>
              <div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-bold text-foreground">{post.author_name || "Anonymous"}</span>
                  <AuthorBadge name={post.author_name} authorPostCounts={authorPostCounts} />
                  <AuthorMeta meta={resolveMeta ? resolveMeta(post.user_id) : null} />
                  <UserAchievements isMe={user && String(post.user_id) === String(user.id)} />
                  <span className="text-[10px] text-slate-300 font-bold">•</span>
                  <span className="text-[10px] font-mono text-slate-200 font-bold tabular-nums">{timeAgo(post.created_date)}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-250 font-semibold">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-primary" /> {engagement.views} views</span>
                  <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-accent" /> {replies.length} replies</span>
                </div>
              </div>
            </div>

            {/* Full body */}
            <div className="prose prose-invert max-w-none">
              <p className="whitespace-pre-wrap break-words text-sm leading-8 text-slate-200">{post.body}</p>
              <ForumMedia url={post.media_url} type={post.media_type} />
            </div>

            {/* Engagement */}
            <div className="mt-6 flex flex-wrap items-center gap-1 border-t border-border/20 pt-4">
              <ReactionPicker postId={post.id} isLiked={isLiked} likeCount={engagement.likes} onLike={toggleLike} isPending={likeMutation.isPending} />
              <ShareButton post={post} />
              <SaveButton post={post} />
            </div>

            {/* All replies */}
            {replies.length > 0 && (
              <div className="mt-6 border-t border-border/20 pt-6">
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300 flex items-center gap-1.5 mb-4">
                  <MessageCircle className="h-3 w-3" />
                  {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
                </p>
                <ReplyTree replies={replies} {...replyApi} />
              </div>
            )}
          </div>
        </div>

        {/* Sticky reply form at bottom */}
        <div className="ios-keyboard-spacer shrink-0 border-t border-border/30 bg-card/80 p-4 backdrop-blur-sm md:p-6">
          <form onSubmit={onReply} className="space-y-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300">
              Write a Reply
            </p>
            <div className="flex gap-3">
              <div className="shrink-0 hidden sm:block">
                <UserAvatar name={isAuthenticated ? (user?.full_name || user?.email) : replyDraft.author_name} size="sm" src={isAuthenticated ? user?.avatar_url : ""} />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {!isAuthenticated && (
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
                  className="min-h-16 rounded-none border-border bg-background text-sm leading-relaxed resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                size="mobile"
                disabled={!appReady || (!isAuthenticated && !replyDraft.author_name) || !replyDraft.body || isSubmitting}
                className="rounded-none bg-primary text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_0_10px_rgba(249,115,22,0.15)] transition-all hover:bg-primary/95 hover:shadow-[0_0_15px_rgba(249,115,22,0.4)]"
              >
                <Send className="mr-1.5 h-3.5 w-3.5" /> {isSubmitting ? "Sending…" : "Post Reply"}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  );
}

/* ━━━ Post Card (Premium with 3D tilt) ━━━━━━━━━━━━━━━━━━━ */
function ForumPostCard({
  post, isAuthenticated, user, appReady, isSubmitting,
  replyOpen, replyDraft, onToggleReply, onUpdateReply, onReply, index,
  onOpenThread, onDeletePost, replyApi, authorPostCounts, authorReplyCounts, resolveAvatar, resolveMeta,
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
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-500/10 border border-orange-500/20 text-[7px] font-bold uppercase tracking-wider text-orange-400">
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
                <span className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-primary">
                  <Pin className="h-2 w-2" /> Pinned
                </span>
              )}
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider border border-border/30 bg-gradient-to-r ${meta.gradient}`}>
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
          <ReactionPicker postId={post.id} isLiked={isLiked} likeCount={engagement.likes} onLike={toggleLike} isPending={likeMutation.isPending} />

          <button
            type="button"
            onClick={onToggleReply}
            className={`flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold transition-all duration-200 border ${
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
              className="flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 text-xs text-slate-300 hover:text-destructive transition-colors border border-transparent"
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
          <div className="flex min-h-11 items-center justify-center gap-1 text-[10px] text-slate-300 font-bold md:hidden">
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
                <ReplyTree replies={visibleReplies} {...replyApi} />
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
}

/* ━━━ Top Contributors Leaderboard ━━━━━━━━━━━━━━━━━━━━━━━ */
function TopContributors({ allThreads }) {
  const topUsers = useMemo(() => {
    const totalCounts = {};
    allThreads.forEach(t => {
      const name = t.author_name;
      if (name) totalCounts[name] = (totalCounts[name] || 0) + 1;
      (t.replies || []).forEach(r => {
        if (r.author_name) totalCounts[r.author_name] = (totalCounts[r.author_name] || 0) + 1;
      });
    });
    return Object.entries(totalCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [allThreads]);

  if (topUsers.length === 0) return null;

  const rankIcons = ["🥇", "🥈", "🥉"];

  return (
    <div className="border border-border/50 bg-card/20 p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-3.5 w-3.5 text-amber-400" />
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Top Contributors</p>
      </div>
      <div className="space-y-2">
        {topUsers.map((u, i) => (
          <motion.div
            key={u.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-2.5 py-1"
          >
            <span className="w-5 text-center text-sm shrink-0">
              {i < 3 ? rankIcons[i] : <span className="text-[10px] font-mono font-bold text-slate-300">{i + 1}</span>}
            </span>
            <UserAvatar name={u.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground truncate">{u.name}</p>
              <p className="text-[8px] text-slate-300 font-medium">{u.count} contributions</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ━━━ Recent Activity Mini-Feed ━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function RecentActivityFeed({ allThreads }) {
  const activities = useMemo(() => {
    const items = [];
    allThreads.forEach(t => {
      items.push({ type: "post", name: t.author_name, title: t.title, date: t.created_date, id: t.id });
      (t.replies || []).forEach(r => {
        items.push({ type: "reply", name: r.author_name, title: t.title, date: r.created_date, id: r.id });
      });
    });
    items.sort((a, b) => {
      const da = parseForumDate(a.date);
      const db = parseForumDate(b.date);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    });
    return items.slice(0, 3);
  }, [allThreads]);

  if (activities.length === 0) return null;

  return (
    <div className="border border-border/50 bg-card/20 p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300">Recent Activity</p>
      </div>
      <div className="space-y-2.5">
        {activities.map((a, i) => (
          <div key={`${a.id}-${i}`} className="flex items-start gap-2">
            <div className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${a.type === "post" ? "bg-primary" : "bg-accent"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                <span className="font-bold text-foreground">{a.name || "Someone"}</span>
                {" "}{a.type === "post" ? "posted" : "replied to"}{" "}
                <span className="text-primary font-bold">"{(a.title || "a thread").slice(0, 32)}{(a.title || "").length > 32 ? "…" : ""}"</span>
              </p>
              <p className="text-[9px] font-mono text-slate-300 font-bold tabular-nums mt-0.5">{timeAgo(a.date)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ━━━ Collapsible Guidelines ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function CollapsibleGuidelines() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/30 bg-card/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/5 transition-colors"
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300">Community Guidelines</p>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-3 w-3 text-slate-200" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ul className="space-y-1.5 px-4 pb-4">
              {["Be respectful to fellow fans", "Keep discussions on-topic", "No spam or commercial posts", "Share tips, ask questions, have fun"].map((rule) => (
                <li key={rule} className="flex items-start gap-2.5 text-[11px] text-slate-200 font-medium py-0.5">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                  {rule}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ━━━ Better Empty State ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function EmptyState({ onClearFilters, onSelectCategory }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border/30 bg-card/20 p-16 text-center"
    >
      <motion.div
        className="inline-flex p-5 bg-gradient-to-br from-primary/10 to-accent/5 border border-border/30 mb-5"
        animate={{
          y: [0, -8, 0],
          rotate: [0, 3, -3, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Search className="h-10 w-10 text-primary" />
      </motion.div>
      <p className="font-display text-2xl uppercase text-slate-200 tracking-wide">
        No discussions found
      </p>
      <p className="text-sm text-slate-300 mt-2 max-w-sm mx-auto leading-relaxed">
        Try adjusting your filters, or be the first to spark a conversation in one of these categories:
      </p>
      <div className="flex flex-wrap justify-center gap-2 mt-6">
        {FORUM_CATEGORIES.slice(0, 3).map((cat) => {
          const m = getCategoryMeta(cat);
          const CatIcon = m.icon;
          return (
            <motion.button
              key={cat}
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelectCategory(cat)}
              className={`flex min-h-11 items-center gap-2 px-4 py-2.5 border border-border/30 bg-gradient-to-r ${m.gradient} text-[10px] font-bold uppercase tracking-wider text-foreground hover:border-primary/30 transition-all`}
            >
              <CatIcon className={`h-3.5 w-3.5 ${m.accent}`} />
              {m.label}
            </motion.button>
          );
        })}
      </div>
      <Button
        onClick={onClearFilters}
        variant="outline"
        size="mobile"
        className="mt-5 rounded-none text-[10px] font-bold uppercase tracking-wider border-border/30"
      >
        Clear all filters
      </Button>
    </motion.div>
  );
}

/* ━━━ Scroll to Top Button ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ScrollToTopButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ duration: 0.2 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 p-3 border border-border/40 bg-card/90 backdrop-blur-xl shadow-xl shadow-black/20 text-primary hover:text-foreground hover:bg-primary/10 hover:border-primary/30 transition-all hidden lg:flex items-center justify-center"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <ArrowUp className="h-4 w-4" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

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

/* ━━━ Compose Sidebar (Premium Enhanced) ━━━━━━━━━━━━━━━━━ */
function ComposeSidebar({ draft, setDraft, isAuthenticated, user, submittedForReview, onSubmit, isPending, allThreads, people = [], onFilterSearch, onClaimSeat, searchQuery, onSharePrediction }) {
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
              <p className="text-[8px] font-mono uppercase tracking-wider text-slate-300">Connect with fellow fans</p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-200 mt-3 mb-4">
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
                <UserAvatar name={user?.full_name || user?.email} size="sm" showStatus src={user?.avatar_url} />
                <div>
                  <p className="text-xs font-bold text-foreground">{user?.full_name || user?.email}</p>
                  <p className="text-[8px] text-slate-300 font-bold">Authenticated</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-200">Your Name</label>
                <Input required placeholder="e.g. Tommy R." value={draft.author_name} onChange={(e) => setDraft({ ...draft, author_name: e.target.value })} className="h-11 rounded-none border-border bg-background text-sm" />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-200">Category</label>
              <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                <SelectTrigger className="h-11 rounded-none border-border bg-background text-left text-sm"><SelectValue /></SelectTrigger>
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
              <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-200">Topic Title</label>
              <Input required placeholder="What's on your mind?" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="h-11 rounded-none border-border bg-background text-sm" />
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-200">Message</label>
              <MentionTextarea required people={people} placeholder="Share your thoughts, questions, or tips… use @ to mention" value={draft.body} onChange={(val) => setDraft({ ...draft, body: val })} className="min-h-24 rounded-none border-border bg-background text-sm leading-relaxed resize-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-200">Attach image / GIF / video</label>
              <MediaAttach value={draft.media_url} onChange={(url) => setDraft({ ...draft, media_url: url })} />
            </div>

            <Button
              type="submit"
              disabled={!appParams.hasBase44Config || (!isAuthenticated && !draft.author_name) || !draft.title || !draft.body || isPending}
              size="mobile"
              className="w-full rounded-none bg-primary text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-[0_0_10px_rgba(249,115,22,0.15)] transition-all hover:bg-primary/95 hover:shadow-[0_0_18px_rgba(249,115,22,0.45)] group"
            >
              <Send className="mr-2 h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              {isPending ? "Submitting…" : "Submit for Review"}
            </Button>
            <p className="text-[8px] text-center text-slate-400 font-bold">Posts are reviewed before publishing</p>
          </form>
        </div>
      </div>

      {/* Stadium Seating Planner */}
      <StadiumSeatPlanner
        onFilterSearch={onFilterSearch}
        onClaimSeat={onClaimSeat}
        currentSearch={searchQuery}
      />

      {/* Score Predictor */}
      <ScorePredictor
        onSharePrediction={onSharePrediction}
      />

      {/* Vegas Takeover Slot Machine */}
      <SlotMachineBadgeUnlock />

      {/* Top Contributors */}
      <TopContributors allThreads={allThreads} />

      {/* Online Users */}
      <OnlineUsersWidget threads={allThreads} />


      {/* Recent Activity */}
      <RecentActivityFeed allThreads={allThreads} />


      {/* Quick Stats */}
      <div className="border border-border/50 bg-card/20 p-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-300 mb-3">Forum Stats</p>
        <div className="space-y-2.5">
          {[
            { icon: MessageSquare, label: "Total Threads", value: allThreads.length },
            { icon: MessageCircle, label: "Total Replies", value: allThreads.reduce((s, t) => s + (t.replies || []).length, 0) },
            { icon: Users, label: "Contributors", value: new Set(allThreads.map((t) => t.author_name)).size },
            { icon: BarChart3, label: "Total Views", value: allThreads.reduce((s, t) => s + getEngagement(t).views, 0) },
          ].map(({ icon: SIcon, label, value }) => (
            <div key={label} className="flex items-center justify-between py-1 border-b border-border/10 last:border-0 last:pb-0">
              <span className="flex items-center gap-2 text-[11px] text-slate-300 font-medium">
                <SIcon className="h-3.5 w-3.5 text-primary" /> {label}
              </span>
              <span className="text-[11px] font-mono font-bold text-foreground tabular-nums">{value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Collapsible Guidelines */}
      <CollapsibleGuidelines />
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
    const map = new Map((avatarData?.data?.avatars || []).map((a) => [String(a.id), { avatar_url: a.avatar_url || "", location: a.location || "", team: a.team || "" }]));
    if (isAuthenticated && user?.id) {
      map.set(String(user.id), {
        avatar_url: user.avatar_url || "",
        location: user.show_location_on_forum ? [user.city, user.country].filter(Boolean).join(", ") : "",
        team: user.show_team_on_forum ? (user.favourite_team || "") : "",
      });
    }
    return map;
  }, [avatarData, isAuthenticated, user]);
  const avatarFor = (userId, snapshot) => (userId && profileById.get(String(userId))?.avatar_url) || snapshot || "";
  const forumMetaFor = (userId) => {
    const p = userId && profileById.get(String(userId));
    if (!p) return null;
    const teamLogo = p.team ? (teamLogoByName.get(String(p.team).trim().toLowerCase()) || "") : "";
    return { ...p, teamLogo };
  };

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forumPosts"] });
      setDraft(emptyPost); setReplyDrafts({}); setActiveReplyId(null); setSubmittedForReview(true);
      setShowMobileCompose(false);
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
      media_url: reply.media_url || "",
    });
  };

  const deleteMutation = useMutation({
    mutationFn: (postId) => base44.functions.invoke("forumAction", { action: "delete", postId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["forumPosts"] }); toast({ title: "Removed" }); },
  });

  const handleDelete = (node) => {
    if (!node?.id) return;
    if (typeof window !== "undefined" && !window.confirm("Remove this and any replies under it?")) return;
    deleteMutation.mutate(node.id);
  };

  // Shared API for the recursive ReplyTree (reply to / delete any comment at any depth).
  const replyApi = {
    isAuthenticated,
    user,
    isSubmitting: createMutation.isPending,
    activeReplyId,
    onToggleReply: (id) => setActiveReplyId(activeReplyId === id ? null : id),
    getReplyDraft,
    onUpdateReply: (id, updates) => updateReplyDraft(id, updates),
    onReply: (node, e) => handleReply(node, e),
    onDelete: handleDelete,
    timeAgo,
    resolveAvatar: avatarFor,
    resolveMeta: forumMetaFor,
  };

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
    <main className="forum-mobile-shell relative min-h-screen overflow-x-hidden bg-background text-foreground">
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
                <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[7px] font-bold uppercase tracking-wider text-emerald-400">
                  <Activity className="h-2 w-2" /> Live
                </span>
              </div>
              <h1 className="font-display text-4xl sm:text-6xl md:text-7xl uppercase tracking-tight leading-[0.92]">
                <span className="block">Aussies in</span>
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
                    <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground/40">{label}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ━━━ MAIN CONTENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="mx-auto max-w-6xl px-3 pb-[calc(7rem+var(--safe-bottom))] pt-4 sm:px-5 sm:py-6 md:px-8 md:py-8">
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
                  <TrendingCard key={t.id} thread={t} rank={i + 1} onClick={() => setThreadModalPost(t)} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,_1fr)_320px]">
          {/* ━━━ LEFT: Feed ━━━ */}
          <div className="min-w-0 space-y-4">
            {/* Live Activity Ticker */}
            <LiveActivityTicker threads={allThreads} />

            {/* Mobile Vegas Slot Machine Badge Unlocker */}
            <div className="lg:hidden">
              <SlotMachineBadgeUnlock />
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
                <div className="forum-filter-rail -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
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
                  <div className="grid gap-4 md:grid-cols-2">
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
                    <ScorePredictor
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
                        setShowMobileCompose(true);
                        window.scrollTo({ top: 300, behavior: "smooth" });
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                  onOpenThread={(p) => setThreadModalPost(p)}
                  onDeletePost={handleDelete}
                  replyApi={replyApi}
                  authorPostCounts={authorPostCounts}
                  authorReplyCounts={authorReplyCounts}
                  resolveAvatar={avatarFor}
                  resolveMeta={forumMetaFor}
                />
              ))}

              {filteredThreads.length === 0 && (
                <EmptyState
                  onClearFilters={clearAllFilters}
                  onSelectCategory={(cat) => { setSelectedCategory(cat); setSearchQuery(""); setSortBy("latest"); }}
                />
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
            replyDraft={getReplyDraft(threadModalPost.id)}
            onUpdateReply={(updates) => updateReplyDraft(threadModalPost.id, updates)}
            onReply={(e) => { handleReply(threadModalPost, e); }}
            replyApi={replyApi}
            authorPostCounts={authorPostCounts}
            authorReplyCounts={authorReplyCounts}
            resolveAvatar={avatarFor}
            resolveMeta={forumMetaFor}
          />
        )}
      </AnimatePresence>

      {/* ━━━ MOBILE COMPOSE SHEET ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <AnimatePresence>
        {showMobileCompose && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70 lg:hidden" onClick={() => setShowMobileCompose(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
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
                    <Input required placeholder="Your name" value={draft.author_name} onChange={(e) => setDraft({ ...draft, author_name: e.target.value })} className="h-11 rounded-none border-border bg-background text-sm" />
                  )}
                  <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                    <SelectTrigger className="h-11 rounded-none border-border bg-background text-left text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.filter((c) => c.value !== "All").map((c) => <SelectItem key={c.value} value={c.value}>{getCategoryMeta(c.value).label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input required placeholder="Topic title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="h-11 rounded-none border-border bg-background text-sm" />
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
