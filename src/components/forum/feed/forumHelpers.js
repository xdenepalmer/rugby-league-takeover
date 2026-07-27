/* ━━━ Forum feed constants & pure helpers ━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 * NOTE: getEngagement is intentionally ALSO defined in Forum.jsx so a source
 * guard test can grep its Math.max(0, …) clamp there. The copy here is identical
 * and used by the extracted feed components to avoid a circular import.
 */
import {
  MessageSquare, Globe, Flame, Zap, Plane, MapPin,
} from "lucide-react";
import { canonicalizeShareUrl } from "@/hooks/useNativeShare";

export const CATEGORY_META = {
  All:      { label: "All Topics",       icon: Globe,        gradient: "from-slate-400/25 to-slate-500/5",  accent: "text-slate-300",   dot: "bg-slate-300",   ring: "ring-slate-400/20",   hue: 220, glow: "rgba(148,163,184,0.15)" },
  General:  { label: "General Chat",     icon: MessageSquare,gradient: "from-blue-500/25 to-blue-600/5",   accent: "text-blue-400",    dot: "bg-blue-400",    ring: "ring-blue-400/20",    hue: 220, glow: "rgba(96,165,250,0.2)" },
  Travel:   { label: "Travel & Flights", icon: Plane,        gradient: "from-emerald-500/25 to-emerald-600/5",accent: "text-emerald-400",dot: "bg-emerald-400", ring: "ring-emerald-400/20", hue: 160, glow: "rgba(52,211,153,0.2)" },
  Events:   { label: "Meetups & Parties",icon: Flame,        gradient: "from-orange-500/25 to-orange-600/5", accent: "text-orange-400", dot: "bg-orange-400",  ring: "ring-orange-400/20",  hue: 25, glow: "rgba(251,146,60,0.2)" },
  MatchDay: { label: "Allegiant Stadium",icon: Zap,          gradient: "from-red-500/25 to-red-600/5",      accent: "text-red-400",    dot: "bg-red-400",     ring: "ring-red-400/20",     hue: 15, glow: "rgba(248,113,113,0.2)" },
  VegasTips:{ label: "Vegas Strip Tips", icon: MapPin,       gradient: "from-amber-500/25 to-amber-600/5",  accent: "text-amber-400",  dot: "bg-amber-400",   ring: "ring-amber-400/20",   hue: 45, glow: "rgba(251,191,36,0.2)" },
};

export const getCategoryMeta = (val) => CATEGORY_META[val] || CATEGORY_META.General;

export const getEngagement = (post) => {
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

// Base44 returns created_date in UTC, sometimes without a timezone marker. A bare
// ISO string is parsed as LOCAL time by JS, which shows a just-posted item as
// "10h ago" in AEST. Normalise to UTC when no timezone is present.
export function parseForumDate(dateStr) {
  if (!dateStr) return null;
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(String(dateStr).trim());
  const normalized = hasTz ? dateStr : `${String(dateStr).trim().replace(" ", "T")}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? new Date(dateStr) : d;
}

export function timeAgo(dateStr) {
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
export function getRecencyScore(dateStr) {
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
export function nameHash(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/* ━━━ Share / Save helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export const threadUrl = (post) => {
  if (typeof window === "undefined") return "";
  // canonicalizeShareUrl rewrites the capacitor://localhost origin of the
  // native shell to the public https domain so shared links stay openable.
  return canonicalizeShareUrl(`${window.location.origin}/forum?thread=${post?.id}`);
};
