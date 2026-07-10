import { lazy, Suspense, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, PenSquare, Search, Dice5, ChevronDown } from "lucide-react";
import PullToRefresh from "@/components/PullToRefresh";
import UserAvatar from "@/components/forum/feed/UserAvatar";
import { timeAgo, getEngagement, getRecencyScore, getCategoryMeta } from "@/components/forum/feed/forumHelpers";
import { buildForumThreads, countReplies, FORUM_CATEGORIES } from "@/lib/public-forms";
import { hasUnreadReplies } from "@/lib/forum-read-tracker";
import { useWindowedList } from "@/hooks/use-windowed-list";
import { useForumPosts, useForumAvatars } from "@/hooks/data/use-fan-data";
import { emitHaptic } from "@/lib/native/haptic-events";
import { NativeSkeleton, NativeEmptyState, NativeSponsorCard } from "../../components/NativePrimitives.jsx";
import NativeComposerSheet from "./NativeComposerSheet.jsx";

const ScorePredictor = lazy(() => import("@/components/forum/ScorePredictor"));
const SlotMachineBadgeUnlock = lazy(() => import("@/components/forum/SlotMachineBadgeUnlock"));

const SORTS = [
  { id: "hot", label: "Hot" },
  { id: "new", label: "New" },
  { id: "top", label: "Top" },
];

function sortThreads(threads, sort) {
  const list = [...threads];
  if (sort === "new") return list; // buildForumThreads is already pinned+date sorted
  if (sort === "top") {
    return list.sort(
      (a, b) =>
        Number(b.is_pinned === true) - Number(a.is_pinned === true) ||
        getEngagement(b) - getEngagement(a)
    );
  }
  // hot: engagement weighted by recency
  return list.sort(
    (a, b) =>
      Number(b.is_pinned === true) - Number(a.is_pinned === true) ||
      getEngagement(b) * getRecencyScore(b.created_date) - getEngagement(a) * getRecencyScore(a.created_date)
  );
}

function ThreadCard({ thread, avatarUrl, onOpen }) {
  const replies = countReplies(thread) - 1;
  const unread = hasUnreadReplies(thread.id, thread.replies);
  const meta = getCategoryMeta(thread.category);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="ios-pressable block w-full border-b border-border/40 bg-transparent px-4 py-3 text-left"
    >
      <div className="flex items-center gap-2">
        <UserAvatar name={thread.author_name} size="sm" src={avatarUrl} />
        <span className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {thread.author_name} · {timeAgo(thread.created_date)}
        </span>
        {thread.is_pinned && (
          <span className="bg-primary/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-primary">Pinned</span>
        )}
        <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${meta.accent || "text-muted-foreground"} bg-card/80`}>
          {thread.category}
        </span>
      </div>
      <h3 className="flex items-start gap-2 pt-2 text-[15px] font-bold leading-snug">
        {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread replies" />}
        <span className="line-clamp-2">{thread.title}</span>
      </h3>
      {thread.body && <p className="line-clamp-2 pt-1 text-sm text-muted-foreground">{thread.body}</p>}
      <p className="pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {replies > 0 ? `${replies} repl${replies === 1 ? "y" : "ies"}` : "No replies yet"} · {getEngagement(thread)} engagement
      </p>
    </button>
  );
}

/**
 * Native Forum tab: scannable thread feed with sort/category/search, unread
 * markers from the shared read-tracker, the casino fan tools (score
 * predictor + badge slots) in a collapsible section, and a composer FAB.
 * Threads open the real /forum/thread/:id route.
 */
export default function NativeForumScreen() {
  const navigate = useNavigate();
  // Legacy /forum?thread= links are normalized by NativePublicShell via
  // nativeAliasFor — no per-screen alias handling here.

  const { data: posts = [], isLoading } = useForumPosts();
  const { avatars } = useForumAvatars();
  const [sort, setSort] = useState("hot");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerPrefill, setComposerPrefill] = useState(null);
  const [toolsOpen, setToolsOpen] = useState(false);

  // Score-predictor share → open the composer prefilled (same behavior the
  // web forum offers from its sidebar).
  const handleSharePrediction = (matchup, homeScore, awayScore) => {
    setComposerPrefill({
      title: `My tip: ${matchup.home_team} v ${matchup.away_team}`,
      body: `Calling it now — ${matchup.home_team} ${homeScore} : ${awayScore} ${matchup.away_team}. ${matchup.label || "NRL Las Vegas"} 🎲`,
      category: "MatchDay",
    });
    setComposerOpen(true);
  };

  const avatarByUser = useMemo(
    () => new Map((avatars || []).map((a) => [String(a.id), a.avatar_url || ""])),
    [avatars]
  );

  const threads = useMemo(() => buildForumThreads(posts), [posts]);
  const visible = useMemo(() => {
    let list = threads;
    if (category !== "All") list = list.filter((t) => t.category === category);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.body?.toLowerCase().includes(q) ||
          t.author_name?.toLowerCase().includes(q)
      );
    }
    return sortThreads(list, sort);
  }, [threads, category, search, sort]);

  // Feeds can hold 100+ threads — render progressively instead of all at
  // once. restoreKey re-seeds the window after a remount so scroll
  // restoration has enough rendered rows to land on.
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, { initial: 12, step: 12, restoreKey: "forum-feed" });

  return (
    <PullToRefresh queryKeys={[["forumPosts"], ["forumAvatars"]]}>
      <div className="mx-auto w-full max-w-2xl pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <header className="px-4 pb-2">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary">Fan zone</p>
          <h1 className="font-display text-2xl font-bold uppercase tracking-widest">Forum</h1>
        </header>

        <div className="flex items-center gap-2 px-4">
          <div className="flex flex-1 items-center gap-2 border border-border bg-card/50 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search threads"
              aria-label="Search threads"
              className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="flex border border-border" role="radiogroup" aria-label="Sort threads">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={sort === s.id}
                onClick={() => {
                  emitHaptic("sheet.snap");
                  setSort(s.id);
                }}
                className={`ios-pressable min-h-11 px-2.5 text-[10px] font-bold uppercase tracking-widest ${
                  sort === s.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ios-scroll flex gap-2 overflow-x-auto px-4 py-2">
          {["All", ...FORUM_CATEGORIES].map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={category === cat}
              onClick={() => setCategory(cat)}
              className={`ios-pressable min-h-9 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                category === cat ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Casino fan tools — collapsed by default to keep the feed first. */}
        <div className="px-4 pb-1">
          <button
            type="button"
            onClick={() => {
              emitHaptic("sheet.snap");
              setToolsOpen((v) => !v);
            }}
            aria-expanded={toolsOpen}
            className="ios-pressable flex min-h-12 w-full items-center justify-between border border-primary/40 bg-primary/10 px-4"
          >
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
              <Dice5 className="h-4 w-4" aria-hidden="true" /> Casino fan tools
            </span>
            <ChevronDown className={`h-4 w-4 text-primary transition-transform ${toolsOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {toolsOpen && (
            <div className="space-y-3 border border-t-0 border-border/60 p-3">
              <Suspense fallback={<NativeSkeleton className="h-64 w-full" />}>
                <ScorePredictor onSharePrediction={handleSharePrediction} />
              </Suspense>
              <Suspense fallback={<NativeSkeleton className="h-28 w-full" />}>
                <SlotMachineBadgeUnlock />
              </Suspense>
            </div>
          )}
        </div>

        {isLoading && threads.length === 0 ? (
          <div className="space-y-3 px-4 pt-2">
            <NativeSkeleton className="h-28 w-full" />
            <NativeSkeleton className="h-28 w-full" />
            <NativeSkeleton className="h-28 w-full" />
          </div>
        ) : visible.length === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState
              icon={MessageSquare}
              title="No threads here yet"
              description="Kick one off — the takeover crew is listening."
              action={
                <button
                  type="button"
                  onClick={() => setComposerOpen(true)}
                  className="ios-pressable mt-1 min-h-11 bg-primary px-4 text-xs font-bold uppercase tracking-widest text-primary-foreground"
                >
                  Start a discussion
                </button>
              }
            />
          </div>
        ) : (
          <div className="pt-1">
            {windowed.slice(0, 6).map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                avatarUrl={avatarByUser.get(String(thread.user_id)) || thread.author_avatar || ""}
                onOpen={() => navigate(`/forum/thread/${encodeURIComponent(thread.id)}`)}
              />
            ))}
            {windowed.length > 6 && (
              <div className="px-4 py-2">
                <NativeSponsorCard />
              </div>
            )}
            {windowed.slice(6).map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                avatarUrl={avatarByUser.get(String(thread.user_id)) || thread.author_avatar || ""}
                onOpen={() => navigate(`/forum/thread/${encodeURIComponent(thread.id)}`)}
              />
            ))}
            {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          emitHaptic("action.primary");
          setComposerOpen(true);
        }}
        aria-label="Start a new discussion"
        className="ios-pressable fixed bottom-[calc(88px+var(--safe-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center bg-primary text-primary-foreground shadow-[0_0_25px_hsl(var(--primary)/0.45)]"
      >
        <PenSquare className="h-6 w-6" aria-hidden="true" />
      </button>

      <NativeComposerSheet
        open={composerOpen}
        onClose={() => {
          setComposerOpen(false);
          setComposerPrefill(null);
        }}
        prefill={composerPrefill}
      />
    </PullToRefresh>
  );
}
