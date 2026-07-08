/**
 * Native iOS Forum — "The Terrace". A purpose-built native community surface for
 * the Capacitor shell, NOT the web forum. Reached via the isNativeApp() branch in
 * src/pages/Forum.jsx; the web Forum is untouched. Reuses the exact same React
 * Query keys (["forumPosts"], ["forumAvatars"], ["teams"]) and the same
 * submitForumPost create mutation + forumAction react mutation as the web, so the
 * cache is shared and posting behaves identically. Shared feature islands
 * (score predictor, slot machine, fan rank) and feed atoms (avatar, reactions,
 * markdown, media) are reused rather than forked.
 */
import React, { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Send, X, Flame, Trophy, Dice5, Users, MessageCircle, Eye, Plus, Radio,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import {
  FORUM_CATEGORIES, buildForumThreads, buildPendingForumPost,
} from "@/lib/public-forms";
import { parseBadgeIds, topBadge } from "@/lib/slot-badges";
import { successImpact, errorImpact, lightImpact, selectionChanged } from "@/lib/native/haptics";
import PullToRefresh from "@/components/PullToRefresh";
import UserAvatar from "@/components/forum/feed/UserAvatar";
import ReactionPicker from "@/components/forum/ReactionPicker";
import ForumMedia from "@/components/forum/ForumMedia";
import MentionTextarea from "@/components/forum/MentionTextarea";
import MediaAttach from "@/components/forum/MediaAttach";
import { MarkdownBody } from "@/lib/markdown";
import { getCategoryMeta, getEngagement, timeAgo } from "@/components/forum/feed/forumHelpers";

// Lazy feature islands — the same components the web forum hosts. Kept out of the
// initial native chunk so the feed paints first.
const ScorePredictor = lazy(() => import("@/components/forum/ScorePredictor"));
const SlotMachineBadgeUnlock = lazy(() => import("@/components/forum/SlotMachineBadgeUnlock"));
const FanRankCard = lazy(() => import("@/components/forum/feed/FanRankCard"));

const emptyPost = { author_name: "", title: "", body: "", category: "General", media_url: "" };

function Eyebrow({ children, tone = "text-primary" }) {
  return (
    <p className={`nt-caption font-bold uppercase tracking-[0.22em] ${tone}`}>{children}</p>
  );
}

/* ── One post in the native feed ─────────────────────────────────── */
function NativePostCard({ post, isAuthenticated, user, resolveAvatar, reactionProfiles }) {
  const queryClient = useQueryClient();
  const meta = getCategoryMeta(post.category);
  const MetaIcon = meta.icon;
  const engagement = getEngagement(post);
  const replies = post.replies || [];
  const [expanded, setExpanded] = useState(false);

  const reactMutation = useMutation({
    mutationFn: (emoji) => base44.functions.invoke("forumAction", { action: "react", postId: post.id, emoji }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["forumPosts"] });
      queryClient.invalidateQueries({ queryKey: ["forumAvatars"] });
      if (res?.data?.reward) toast({ title: `+${res.data.reward.xp} XP · +${res.data.reward.chips} chips`, description: res.data.reward.rank });
    },
  });
  const onReact = (emoji) => { if (!reactMutation.isPending) { lightImpact(); reactMutation.mutate(emoji); } };

  const body = post.body || "";
  const shouldTruncate = body.length > 240;
  const displayBody = shouldTruncate && !expanded ? body.slice(0, 240) + "…" : body;

  return (
    <article className="nt-raised nt-e2 overflow-hidden border border-border/50">
      <div className={`h-[2px] w-full bg-gradient-to-r ${meta.gradient}`} />
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <UserAvatar name={post.author_name} src={resolveAvatar ? resolveAvatar(post.user_id, post.author_avatar) : post.author_avatar} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="min-w-0 truncate nt-subhead font-bold text-foreground">{post.author_name || "Anonymous"}</span>
              {engagement.hot && <Flame className="h-3 w-3 shrink-0 text-orange-400" />}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 nt-caption font-bold uppercase tracking-wider ${meta.accent}`}>
                <MetaIcon className="h-3 w-3" />{meta.label}
              </span>
              <span className="nt-caption text-muted-foreground">·</span>
              <span className="nt-caption font-mono tabular-nums text-muted-foreground">{timeAgo(post.created_date)}</span>
            </div>
          </div>
        </div>

        {/* Title + body */}
        {post.title && (
          <h3 className="nt-title mt-3 break-words uppercase tracking-wide text-foreground">{post.title}</h3>
        )}
        {body && (
          <div className="mt-2">
            <MarkdownBody text={displayBody} className="break-words nt-body text-slate-200" />
            {shouldTruncate && (
              <button
                type="button"
                onClick={() => { selectionChanged(); setExpanded((v) => !v); }}
                className="ios-pressable mt-1 nt-caption font-bold uppercase tracking-wider text-primary"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}
        <ForumMedia url={post.media_url} type={post.media_type} className="mt-3" />

        {/* Reactions + stats */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/30 pt-3">
          <ReactionPicker
            reactions={post.reactions}
            legacyLikes={engagement.likes}
            currentUserId={user?.id}
            isAuthenticated={isAuthenticated}
            onReact={onReact}
            isPending={reactMutation.isPending}
            reactionProfiles={reactionProfiles}
          />
          <div className="ml-auto flex items-center gap-3 nt-caption font-bold tabular-nums text-muted-foreground">
            {replies.length > 0 && (
              <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3 text-accent" />{replies.length}</span>
            )}
            <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3 text-primary" />{engagement.views}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ── Bottom-sheet composer (same create mutation as web) ─────────── */
function ComposerSheet({ open, onClose, draft, setDraft, people, onSubmit, isPending }) {
  const { isAuthenticated, user } = useAuth();
  const canSubmit = appParams.hasBase44Config && (isAuthenticated || draft.author_name) && draft.title && draft.body && !isPending;
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/65"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.3 }}
            className="nt-material fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto border-t border-white/[0.06] pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
            role="dialog" aria-modal="true" aria-labelledby="native-forum-compose-title"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-9 rounded-full bg-white/20" />
            </div>
            <div className="nt-gutter-x pt-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 id="native-forum-compose-title" className="nt-title uppercase tracking-wide text-foreground">New post</h2>
                <button
                  type="button" onClick={onClose} aria-label="Close composer"
                  className="ios-pressable flex h-9 w-9 items-center justify-center border border-border/50 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={onSubmit} className="nt-stack">
                {isAuthenticated ? (
                  <div className="flex items-center gap-2 border border-border/40 bg-muted/[0.04] px-3 py-2">
                    <UserAvatar name={user?.full_name || user?.email} size="sm" src={user?.avatar_url} />
                    <span className="nt-footnote text-muted-foreground">Posting as <span className="font-bold text-foreground">{user?.full_name || user?.email}</span></span>
                  </div>
                ) : (
                  <input
                    required placeholder="Your name" value={draft.author_name}
                    onChange={(e) => setDraft({ ...draft, author_name: e.target.value })}
                    className="min-h-11 w-full border border-border bg-background px-3 nt-body text-foreground"
                  />
                )}
                {/* Category chips */}
                <div className="flex flex-wrap gap-2">
                  {FORUM_CATEGORIES.map((cat) => {
                    const m = getCategoryMeta(cat);
                    const active = draft.category === cat;
                    return (
                      <button
                        key={cat} type="button"
                        onClick={() => { selectionChanged(); setDraft({ ...draft, category: cat }); }}
                        className={`ios-pressable inline-flex items-center gap-1 border px-2.5 py-1.5 nt-caption font-bold uppercase tracking-wider ${active ? `border-primary/50 bg-primary/10 ${m.accent}` : "border-border/40 text-muted-foreground"}`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  required placeholder="Topic title" value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="min-h-11 w-full border border-border bg-background px-3 nt-body text-foreground"
                />
                <MentionTextarea
                  required people={people}
                  placeholder="What's on your mind? Use @ to mention"
                  value={draft.body}
                  onChange={(val) => setDraft({ ...draft, body: val })}
                  className="min-h-24 border-border bg-background nt-body text-foreground resize-none"
                />
                <MediaAttach value={draft.media_url} onChange={(url) => setDraft({ ...draft, media_url: url })} />
                <button
                  type="submit" disabled={!canSubmit}
                  className="ios-pressable flex min-h-12 w-full items-center justify-center gap-2 bg-primary nt-footnote font-bold uppercase tracking-[0.2em] text-white disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />{isPending ? "Posting…" : "Post to forum"}
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function NativeForum() {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const enabled = appParams.hasBase44Config;

  const [tab, setTab] = useState("feed"); // "feed" | "games"
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState(emptyPost);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["forumPosts"],
    queryFn: () => base44.entities.ForumPost.list("-created_date", 100),
    enabled,
    refetchInterval: 30000,
  });
  const { data: avatarData } = useQuery({
    queryKey: ["forumAvatars"],
    queryFn: () => base44.functions.invoke("forumAvatars", {}),
    enabled,
    retry: false,
    meta: { silent: true },
    staleTime: 60000,
  });

  // Live avatars + reaction profiles by user id (same shape the web forum builds).
  const profileById = useMemo(() => {
    const map = new Map((avatarData?.data?.avatars || []).map((a) => [String(a.id), {
      display_name: a.display_name || "Member", avatar_url: a.avatar_url || "",
      location: a.location || "", team: a.team || "", badges: parseBadgeIds(a.badges),
      casino_rank: a.casino_rank || "Rookie Punter", casino_xp: Number(a.casino_xp || 0),
      casino_chips: Number(a.casino_chips || 0), casino_streak: Number(a.casino_streak || 0),
    }]));
    if (isAuthenticated && user?.id) {
      map.set(String(user.id), {
        display_name: user.full_name || user.email || "You",
        avatar_url: user.avatar_url || "",
        location: "", team: "", badges: parseBadgeIds(user.badges), badge: topBadge(parseBadgeIds(user.badges)),
        casino_rank: user.casino_rank || "Rookie Punter", casino_xp: Number(user.casino_xp || 0),
        casino_chips: Number(user.casino_chips || 0), casino_streak: Number(user.casino_streak || 0),
      });
    }
    return map;
  }, [avatarData, isAuthenticated, user]);
  const avatarFor = useCallback((userId, snapshot) => (userId && profileById.get(String(userId))?.avatar_url) || snapshot || "", [profileById]);

  const threads = useMemo(() => buildForumThreads(posts), [posts]);
  const totalReplies = useMemo(() => threads.reduce((s, t) => s + (t.replies || []).length, 0), [threads]);
  const uniqueMembers = useMemo(() => new Set(threads.map((t) => t.author_name)).size, [threads]);

  const mentionPeople = useMemo(() => {
    const names = new Set();
    threads.forEach((t) => {
      if (t.author_name) names.add(t.author_name);
      (t.replies || []).forEach((r) => { if (r.author_name) names.add(r.author_name); });
    });
    if (isAuthenticated && (user?.full_name || user?.email)) names.add(user.full_name || user.email);
    return [...names].map((name) => ({ name }));
  }, [threads, isAuthenticated, user]);

  // Same create mutation contract as the web forum (submitForumPost function).
  const createMutation = useMutation({
    meta: { silent: true },
    mutationFn: async (data) => {
      const authorName = isAuthenticated ? (user?.full_name || "Member") : data.author_name;
      const post = buildPendingForumPost({ ...data, author_name: authorName });
      const response = await base44.functions.invoke("submitForumPost", {
        author_name: post.author_name, title: post.title, body: post.body,
        category: post.category, parent_id: post.parent_id, media_url: data.media_url || "",
      });
      return { ...response.data, parent_id: post.parent_id };
    },
    onSuccess: (data) => {
      successImpact();
      queryClient.invalidateQueries({ queryKey: ["forumPosts"] });
      queryClient.invalidateQueries({ queryKey: ["forumAvatars"] });
      setDraft(emptyPost);
      setComposeOpen(false);
      toast({ title: data?.id ? "Post published" : "Post submitted", description: "Your discussion is now visible in the forum." });
      if (data?.reward) {
        const streakNote = data.reward.streak ? " · " + data.reward.streak + " day streak" : "";
        toast({ title: `+${data.reward.xp} XP · +${data.reward.chips} chips`, description: data.reward.rank + streakNote });
      }
    },
    onError: (error) => {
      errorImpact();
      toast({ title: "Post failed", description: error?.response?.data?.error || error?.message || "Please try again." });
    },
  });

  const handlePost = (e) => {
    e.preventDefault();
    if ((!isAuthenticated && !draft.author_name) || !draft.title || !draft.body) return;
    createMutation.mutate(draft);
  };

  // Prefill + open the composer from a shared game (score predictor).
  const composeFromPrediction = useCallback((matchup, homeScore, awayScore) => {
    const home = matchup.home_team;
    const away = matchup.away_team;
    const label = matchup.label || "NRL Fixture";
    setDraft((d) => ({
      ...d,
      title: `[Tip] ${home} ${homeScore} - ${awayScore} ${away}`,
      body: `My footy tip for ${label}: ${home} ${homeScore} - ${awayScore} ${away}. Who are you backing?`,
      category: "MatchDay",
    }));
    setComposeOpen(true);
    setTab("feed");
  }, []);

  const openComposer = () => { lightImpact(); setDraft(emptyPost); setComposeOpen(true); };

  return (
    <PullToRefresh queryKeys={[["forumPosts"], ["forumAvatars"]]}>
      <main className="min-h-dvh bg-background text-foreground nt-legible-floor pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto w-full max-w-xl nt-gutter-x nt-stack">
          {/* ① Large-title header */}
          <div className="pb-1">
            <div className="flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-primary" />
              <Eyebrow>Fan discussion board</Eyebrow>
              <span className="inline-flex items-center gap-1 border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 nt-caption font-bold uppercase tracking-wider text-emerald-400">Live</span>
            </div>
            <h1 className="nt-large-title mt-0.5 text-foreground">Forum</h1>
            <div className="mt-2 flex items-center gap-4 nt-footnote text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5 text-primary" />{threads.length} threads</span>
              <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5 text-accent" />{totalReplies} replies</span>
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-primary" />{uniqueMembers} members</span>
            </div>
          </div>

          {/* ② Segmented control: Feed / Games */}
          <div className="nt-group grid grid-cols-2 gap-1 border border-border/50 p-1">
            {[
              { id: "feed", label: "Feed", icon: MessageSquare },
              { id: "games", label: "Play & Predict", icon: Dice5 },
            ].map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id} type="button"
                  onClick={() => { selectionChanged(); setTab(t.id); }}
                  className={`ios-pressable relative flex min-h-11 items-center justify-center gap-1.5 nt-footnote font-bold uppercase tracking-wider ${active ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {active && (
                    <motion.span layoutId="nt-forum-seg" className="absolute inset-0 border border-border/50 bg-muted/30" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
                  )}
                  <span className="relative flex items-center gap-1.5"><Icon className={`h-3.5 w-3.5 ${active ? "text-primary" : ""}`} />{t.label}</span>
                </button>
              );
            })}
          </div>

          {tab === "games" ? (
            /* ③ Games surface — the same feature islands the web forum hosts */
            <div className="nt-stack">
              <Suspense fallback={<div className="nt-raised nt-e1 h-24 animate-pulse border border-border/40" />}>
                <FanRankCard />
              </Suspense>
              <Suspense fallback={<div className="nt-raised nt-e1 h-64 animate-pulse border border-border/40" />}>
                <ScorePredictor onSharePrediction={composeFromPrediction} />
              </Suspense>
              <Suspense fallback={<div className="nt-raised nt-e1 h-28 animate-pulse border border-border/40" />}>
                <SlotMachineBadgeUnlock />
              </Suspense>
            </div>
          ) : (
            /* ③ Feed */
            <div className="nt-stack">
              {/* Prominent games entry from the feed */}
              <button
                type="button"
                onClick={() => { selectionChanged(); setTab("games"); }}
                className="ios-pressable nt-raised nt-e2 flex items-center gap-3 border border-accent/30 p-4 text-left"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-accent/30 bg-accent/10 text-accent"><Trophy className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="nt-subhead font-bold text-foreground">Play &amp; Predict</p>
                  <p className="nt-footnote text-muted-foreground">Spin the badge slot, tip the footy & climb the ranks.</p>
                </div>
                <Dice5 className="h-5 w-5 shrink-0 text-accent" />
              </button>

              {isLoading && posts.length === 0 && [1, 2, 3].map((i) => (
                <div key={i} className="nt-raised nt-e1 border border-border/40 p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted/30" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-28 animate-pulse bg-muted/30" />
                      <div className="h-5 w-3/4 animate-pulse bg-muted/20" />
                    </div>
                  </div>
                </div>
              ))}

              {threads.map((post) => (
                <NativePostCard
                  key={post.id}
                  post={post}
                  isAuthenticated={isAuthenticated}
                  user={user}
                  resolveAvatar={avatarFor}
                  reactionProfiles={profileById}
                />
              ))}

              {!isLoading && threads.length === 0 && (
                <div className="nt-raised nt-e1 flex flex-col items-center gap-2 border border-border/40 py-14 text-center">
                  <MessageSquare className="h-9 w-9 text-muted-foreground/30" />
                  <p className="nt-subhead font-bold text-foreground">No discussions yet</p>
                  <p className="nt-footnote text-muted-foreground">Be the first to start the conversation.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating "New post" action — sits above the native tab bar */}
        {tab === "feed" && (
          <button
            type="button"
            onClick={openComposer}
            aria-label="New post"
            className="ios-pressable nt-material fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-primary/40 text-primary shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
            style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom,0px))" }}
          >
            <Plus className="h-6 w-6" />
          </button>
        )}
      </main>

      <ComposerSheet
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        draft={draft}
        setDraft={setDraft}
        people={mentionPeople}
        onSubmit={handlePost}
        isPending={createMutation.isPending}
      />
    </PullToRefresh>
  );
}
