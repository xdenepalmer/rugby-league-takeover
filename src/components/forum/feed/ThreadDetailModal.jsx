/* ━━━ Thread Detail Modal ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import React, { useState, useRef, useEffect, memo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Send, MessageCircle, X, Eye, Pencil, Flag } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import ReplyTree from "@/components/forum/ReplyTree";
import ReactionPicker from "@/components/forum/ReactionPicker";
import ForumMedia from "@/components/forum/ForumMedia";
import MentionTextarea from "@/components/forum/MentionTextarea";
import { MarkdownBody } from "@/lib/markdown";
import UserAvatar from "./UserAvatar";
import UserProfileHoverCard from "./UserProfileHoverCard";
import AuthorBadge from "./AuthorBadge";
import AuthorMeta from "./AuthorMeta";
import UserAchievements from "./UserAchievements";
import { ShareButton, SaveButton } from "./ShareSaveButtons";
import { getCategoryMeta, getEngagement, timeAgo } from "./forumHelpers";

const ThreadDetailModal = memo(function ThreadDetailModal({ post, onClose, isAuthenticated, user, isModerator, appReady, isSubmitting, replyDraft, onUpdateReply, onReply, onEditPost, replyApi, activeReplyDraft, authorPostCounts, authorReplyCounts, resolveAvatar, resolveMeta, reactionProfiles }) {
  const meta = getCategoryMeta(post.category);
  const MetaIcon = meta.icon;
  const engagement = getEngagement(post);
  const replies = post.replies || [];
  const queryClient = useQueryClient();
  const reactMutation = useMutation({
    mutationFn: (emoji) => base44.functions.invoke("forumAction", { action: "react", postId: post.id, emoji }),
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ["forumPosts"] }); queryClient.invalidateQueries({ queryKey: ["forumAvatars"] }); if (res?.data?.reward) toast({ title: `+${res.data.reward.xp} XP · +${res.data.reward.chips} chips`, description: res.data.reward.rank }); },
  });
  const onReact = (emoji) => { if (!reactMutation.isPending) reactMutation.mutate(emoji); };
  const isOwner = isAuthenticated && user?.id && String(post.user_id) === String(user.id);
  const isEdited = post.updated_date && post.updated_date !== post.created_date;
  const [reportOpen, setReportOpen] = useState(false);
  const reportRef = useRef(null);
  useEffect(() => {
    if (!reportOpen) return;
    const handler = (e) => { if (reportRef.current && !reportRef.current.contains(e.target)) setReportOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [reportOpen]);

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
        transition={{ duration: 0.2, ease: "linear" }}
        style={{ willChange: "opacity" }}
        className="fixed inset-0 z-[80] bg-black/65"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 60, scale: 0.96 }}
        transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.3 }}
        style={{ willChange: "transform, opacity" }}
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
                  {isEdited && <span className="text-[10px] italic text-muted-foreground">(edited)</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-300 font-semibold">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-primary" /> {engagement.views} views</span>
                  <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-accent" /> {replies.length} replies</span>
                </div>
              </div>
            </div>

            {/* Full body */}
            <div className="prose prose-invert max-w-none">
              <MarkdownBody text={post.body} className="break-words" />
              <ForumMedia url={post.media_url} type={post.media_type} />
            </div>

            {/* Engagement */}
            <div className="mt-6 flex flex-wrap items-center gap-1 border-t border-border/20 pt-4">
              <ReactionPicker reactions={post.reactions} legacyLikes={engagement.likes} currentUserId={user?.id} isAuthenticated={isAuthenticated} onReact={onReact} isPending={reactMutation.isPending} reactionProfiles={reactionProfiles} />

              {isOwner && onEditPost && (
                <button
                  type="button"
                  onClick={() => { onClose(); onEditPost(post); }}
                  className="forum-action-button flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 text-xs text-slate-300 hover:text-primary transition-colors border border-transparent"
                  title="Edit this post"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-[10px] uppercase tracking-wider">Edit</span>
                </button>
              )}

              <div className="relative" ref={reportRef}>
                <button
                  type="button"
                  onClick={() => setReportOpen(!reportOpen)}
                  className="forum-action-button flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 text-xs text-slate-300 hover:text-amber-400 transition-colors border border-transparent"
                  title="Report this post"
                >
                  <Flag className="h-3.5 w-3.5" />
                </button>
                {reportOpen && (
                  <div className="absolute bottom-full left-0 mb-1 z-20 w-40 border border-border/60 bg-card shadow-xl py-1">
                    {["Spam", "Harassment", "Off-topic", "Other"].map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-muted/20 hover:text-foreground transition-colors"
                        onClick={() => {
                          setReportOpen(false);
                          toast({ title: "Report submitted", description: `Reason: ${reason}` });
                        }}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                )}
              </div>

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
                <ReplyTree replies={replies} activeReplyDraft={activeReplyDraft} {...replyApi} />
              </div>
            )}
          </div>
        </div>

        {/* Sticky reply form at bottom */}
        <div className="ios-keyboard-spacer shrink-0 border-t border-border/30 bg-card/80 p-4 backdrop-blur-sm md:p-6">
          <form onSubmit={(e) => onReply(post, e)} className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-300">
              Write a Reply
            </p>
            <div className="flex gap-3">
              <div className="shrink-0 hidden sm:block">
                <UserAvatar name={isAuthenticated ? (user?.full_name || user?.email) : replyDraft.author_name} size="sm" src={isAuthenticated ? user?.avatar_url : ""} />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {!isAuthenticated && (
                  <>
                    <label htmlFor="modal-reply-name" className="sr-only">Your name</label>
                    <Input
                      id="modal-reply-name"
                      required placeholder="Your name"
                      value={replyDraft.author_name}
                      onChange={(e) => onUpdateReply(post.id, { author_name: e.target.value })}
                      className="h-11 rounded-none border-border bg-background text-sm"
                    />
                  </>
                )}
                <MentionTextarea
                  required
                  people={replyApi?.people}
                  placeholder={`Reply to ${post.author_name || "this thread"}… use @ to mention`}
                  value={replyDraft.body}
                  onChange={(val) => onUpdateReply(post.id, { body: val })}
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
});

export default ThreadDetailModal;