import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Share2, Flag, MessageSquare, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import UserAvatar from "@/components/forum/feed/UserAvatar";
import ForumMedia from "@/components/forum/ForumMedia";
import ReactionPicker from "@/components/forum/ReactionPicker";
import MentionTextarea from "@/components/forum/MentionTextarea";
import { timeAgo } from "@/components/forum/feed/forumHelpers";
import { buildForumThreads, countReplies } from "@/lib/public-forms";
import { markThreadRead } from "@/lib/forum-read-tracker";
import { useAuth } from "@/lib/AuthContext";
import { useForumPosts, useForumAvatars } from "@/hooks/data/use-fan-data";
import { useSubmitForumPost, useForumReaction, useReportPost, recordThreadView } from "@/hooks/data/use-forum-actions";
import { shareThread } from "@/lib/native/share";
import { emitHaptic } from "@/lib/native/haptic-events";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";

export const nativeReplyDraftKey = (threadId) => `rlt_native_reply_draft_${threadId}`;

const REPORT_REASONS = ["Spam", "Harassment", "Off-topic", "Other"];

function ReplyNode({ post, depth, avatarFor, onReplyTo }) {
  return (
    <div className={depth > 0 ? "ml-3 border-l-2 border-primary/25 pl-3" : ""}>
      <div className="flex items-start gap-2 py-2">
        <UserAvatar name={post.author_name} size="sm" src={avatarFor(post)} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {post.author_name} · {timeAgo(post.created_date)}
          </p>
          <p className="whitespace-pre-wrap pt-0.5 text-sm leading-relaxed">{post.body}</p>
          {post.media_url && <ForumMedia url={post.media_url} type={post.media_type} className="mt-2 max-h-64" />}
          <button
            type="button"
            onClick={() => onReplyTo(post)}
            className="ios-pressable mt-1 min-h-9 text-[10px] font-bold uppercase tracking-widest text-primary"
          >
            Reply
          </button>
        </div>
      </div>
      {(post.replies || []).map((child) => (
        <ReplyNode key={child.id} post={child} depth={depth + 1} avatarFor={avatarFor} onReplyTo={onReplyTo} />
      ))}
    </div>
  );
}

/**
 * Native thread detail at /forum/thread/:id — the route notifications,
 * shares and universal links land on. Root post with reactions, nested
 * replies, report/share actions and a sticky keyboard-safe reply composer
 * with a per-thread draft.
 */
export default function NativeThreadScreen() {
  const { id } = useParams();
  const { isAuthenticated, user } = useAuth();
  const { data: posts = [], isLoading } = useForumPosts();
  const { avatars } = useForumAvatars();

  const thread = useMemo(() => {
    const threads = buildForumThreads(posts);
    return threads.find((t) => String(t.id) === String(id)) || null;
  }, [posts, id]);

  const avatarByUser = useMemo(
    () => new Map((avatars || []).map((a) => [String(a.id), a.avatar_url || ""])),
    [avatars]
  );
  const avatarFor = (post) => avatarByUser.get(String(post.user_id)) || post.author_avatar || "";

  const [replyTo, setReplyTo] = useState(null);
  const [body, setBody] = useState("");
  const [guestName, setGuestName] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const draftTimer = useRef(null);

  // Per-thread draft persistence.
  useEffect(() => {
    try {
      setBody(localStorage.getItem(nativeReplyDraftKey(id)) || "");
    } catch {
      setBody("");
    }
  }, [id]);
  useEffect(() => {
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try {
        if (body) localStorage.setItem(nativeReplyDraftKey(id), body);
        else localStorage.removeItem(nativeReplyDraftKey(id));
      } catch {
        // best-effort
      }
    }, 800);
    return () => clearTimeout(draftTimer.current);
  }, [body, id]);

  // Mark read + count the view once the thread is on screen.
  useEffect(() => {
    if (!thread) return;
    markThreadRead(thread.id);
    recordThreadView(thread.id);
  }, [thread]);

  const submitMutation = useSubmitForumPost({
    onSuccess: () => {
      setBody("");
      setReplyTo(null);
      try {
        localStorage.removeItem(nativeReplyDraftKey(id));
      } catch {
        // best-effort
      }
    },
  });
  const reactionMutation = useForumReaction(thread?.id);
  const reportMutation = useReportPost();

  const canSend = body.trim() && (isAuthenticated || guestName.trim());
  const replies = thread ? countReplies(thread) - 1 : 0;

  const handleSend = () => {
    emitHaptic("action.primary");
    submitMutation.mutate({
      body,
      author_name: guestName,
      category: thread.category || "General",
      parent_id: replyTo?.id || thread.id,
      title: "Reply",
    });
  };

  const topActions = thread ? (
    <div className="flex items-center">
      <button
        type="button"
        aria-label="Report thread"
        onClick={() => setReportOpen(true)}
        className="ios-pressable flex h-11 w-11 items-center justify-center text-muted-foreground"
      >
        <Flag className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Share thread"
        onClick={() => {
          emitHaptic("action.primary");
          shareThread(thread);
        }}
        className="ios-pressable flex h-11 w-11 items-center justify-center text-muted-foreground"
      >
        <Share2 className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  ) : null;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <NativeTopBar title="Thread" fallback="/forum" right={topActions} />

      {isLoading && !thread && (
        <div className="space-y-3 px-4 pt-4">
          <NativeSkeleton className="h-24 w-full" />
          <NativeSkeleton className="h-40 w-full" />
          <NativeSkeleton className="h-20 w-full" />
        </div>
      )}

      {!isLoading && !thread && (
        <div className="px-4 pt-8">
          <NativeEmptyState
            icon={MessageSquare}
            title="Thread unavailable"
            description="It may have been removed, or you're offline."
          />
        </div>
      )}

      {thread && (
        <div className="mx-auto w-full max-w-2xl px-4 pb-40">
          <div className="border-b border-border/50 py-4">
            <div className="flex items-center gap-2">
              <UserAvatar name={thread.author_name} size="md" src={avatarFor(thread)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold uppercase tracking-widest">{thread.author_name}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {timeAgo(thread.created_date)} · {thread.category}
                </p>
              </div>
              {thread.is_pinned && (
                <span className="bg-primary/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-primary">Pinned</span>
              )}
            </div>
            <h1 className="pt-3 font-display text-xl font-bold uppercase leading-tight tracking-wide">{thread.title}</h1>
            <p className="whitespace-pre-wrap pt-2 text-[15px] leading-relaxed">{thread.body}</p>
            {thread.media_url && <ForumMedia url={thread.media_url} type={thread.media_type} className="mt-3" />}
            <div className="pt-3">
              <ReactionPicker
                reactions={thread.reactions}
                legacyLikes={thread.likes || 0}
                currentUserId={user?.id}
                isAuthenticated={isAuthenticated}
                onReact={(emoji) => reactionMutation.mutate(emoji)}
                isPending={reactionMutation.isPending}
              />
            </div>
          </div>

          <p className="pt-4 text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
            {replies > 0 ? `${replies} repl${replies === 1 ? "y" : "ies"}` : "Be the first to reply"}
          </p>
          <div className="pt-1">
            {(thread.replies || []).map((reply) => (
              <ReplyNode key={reply.id} post={reply} depth={0} avatarFor={avatarFor} onReplyTo={setReplyTo} />
            ))}
          </div>
        </div>
      )}

      {thread && (
        <div className="ios-keyboard-spacer fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-3 pb-[max(0.75rem,var(--safe-bottom))] pt-2 backdrop-blur">
          <div className="mx-auto w-full max-w-2xl">
            {replyTo && (
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="mb-1 flex items-center gap-1 bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-primary"
              >
                Replying to {replyTo.author_name} <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
            {!isAuthenticated && (
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Your name"
                aria-label="Your name"
                className="mb-1 h-10 rounded-none border-border bg-card/60"
              />
            )}
            <div className="flex items-end gap-2">
              <MentionTextarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Add to the conversation…"
                aria-label="Reply"
                rows={1}
                maxLength={2000}
                className="max-h-32 min-h-11 w-full resize-none border border-border bg-card/60 px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={!canSend || submitMutation.isPending}
                onClick={handleSend}
                className="ios-pressable min-h-11 shrink-0 bg-primary px-4 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
              >
                {submitMutation.isPending ? "…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reportOpen && thread && (
        <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label="Report thread">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/60" onClick={() => setReportOpen(false)} />
          <div className="ios-sheet relative w-full border-t border-border bg-card p-4 pb-[max(1rem,var(--safe-bottom))]">
            <p className="pb-2 font-display text-sm font-bold uppercase tracking-widest">Report this thread</p>
            {REPORT_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => {
                  reportMutation.mutate({ postId: thread.id, reason });
                  setReportOpen(false);
                }}
                className="ios-pressable flex min-h-12 w-full items-center border-b border-border/40 px-2 text-left text-sm font-bold uppercase tracking-wide"
              >
                {reason}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
