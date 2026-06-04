/* ━━━ Compose Sidebar (Premium Enhanced) ━━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import React, { lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MessageSquare, MessageCircle, Send, Sparkles, Users, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FORUM_CATEGORIES } from "@/lib/public-forms";
import { appParams } from "@/lib/app-params";
import MentionTextarea from "@/components/forum/MentionTextarea";
import MediaAttach from "@/components/forum/MediaAttach";
import UserAvatar from "./UserAvatar";
import TopContributors from "./TopContributors";
import OnlineUsersWidget from "./OnlineUsersWidget";
import RecentActivityFeed from "./RecentActivityFeed";
import CollapsibleGuidelines from "./CollapsibleGuidelines";
import { getCategoryMeta, getEngagement } from "./forumHelpers";

// Lazy-load heavy feature islands (same as Forum.jsx) to avoid chunk conflicts
const StadiumSeatPlanner = lazy(() => import("@/components/forum/StadiumSeatPlanner"));
const ScorePredictor = lazy(() => import("@/components/forum/ScorePredictor"));
const SlotMachineBadgeUnlock = lazy(() => import("@/components/forum/SlotMachineBadgeUnlock"));

const SidebarSuspense = ({ children }) => (
  <Suspense fallback={<div className="h-24 bg-card/10 animate-pulse border border-border/10" />}>
    {children}
  </Suspense>
);

const categories = [
  { value: "All" },
  ...FORUM_CATEGORIES.map((value) => ({ value })),
];

export default function ComposeSidebar({ draft, setDraft, isAuthenticated, user, submittedForReview, onSubmit, isPending, allThreads, people = [], onFilterSearch, onClaimSeat, searchQuery, onSharePrediction }) {
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
                  <p className="text-xs font-bold text-emerald-400">Posted — you're live!</p>
                </div>
                <p className="text-[10px] text-emerald-400/60 mt-1">Your post is now visible to the community.</p>
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
              {isPending ? "Posting…" : "Post to Community"}
            </Button>
            <p className="text-[8px] text-center text-slate-400 font-bold">Posts appear instantly &amp; are public — please keep it civil</p>
          </form>
        </div>
      </div>

      {/* Stadium Seating Planner */}
      <SidebarSuspense>
        <StadiumSeatPlanner
          onFilterSearch={onFilterSearch}
          onClaimSeat={onClaimSeat}
          currentSearch={searchQuery}
        />
      </SidebarSuspense>

      {/* Score Predictor */}
      <SidebarSuspense>
        <ScorePredictor
          onSharePrediction={onSharePrediction}
        />
      </SidebarSuspense>

      {/* Vegas Takeover Slot Machine */}
      <SidebarSuspense>
        <SlotMachineBadgeUnlock />
      </SidebarSuspense>

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

      {/* Facebook Community */}
      <a
        href="https://www.facebook.com/groups/663237792349090"
        target="_blank"
        rel="noreferrer"
        className="block border border-border/50 bg-card/20 overflow-hidden group hover:border-[#1877F2]/30 transition-all duration-300"
      >
        <div className="h-[2px] w-full bg-[#1877F2]" />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1877F2]/10 border border-[#1877F2]/20 shrink-0">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#1877F2]" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground group-hover:text-[#1877F2] transition-colors">NRL Las Vegas</p>
              <p className="text-[9px] text-muted-foreground font-mono mt-0.5">16.8k members · Facebook Group</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-300 leading-relaxed mt-3">Join the conversation on Facebook — match day meetups, ticket alerts, travel tips and more from the community.</p>
          <div className="mt-3 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#1877F2] group-hover:translate-x-0.5 transition-transform">
            <span>Join Group</span>
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
          </div>
        </div>
      </a>

      {/* Collapsible Guidelines */}
      <CollapsibleGuidelines />
    </aside>
  );
}
