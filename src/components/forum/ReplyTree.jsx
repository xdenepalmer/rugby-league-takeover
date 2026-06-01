import React from "react";
import { Reply, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MentionTextarea from "./MentionTextarea";
import MediaAttach from "./MediaAttach";
import ForumMedia from "./ForumMedia";

const HUES = [15, 45, 160, 220, 280, 330, 190, 30, 120, 350];
// Compact avatar for a reply: uploaded photo when available, else a colour monogram.
function ReplyAvatar({ name, src }) {
  const seed = [...String(name || "")].reduce((t, c) => t + c.charCodeAt(0), 0);
  const hue = HUES[seed % HUES.length];
  if (src) {
    return <img src={src} alt={name || "Member"} className="h-6 w-6 shrink-0 rounded-full object-cover" style={{ border: `1px solid hsl(${hue},70%,55%,0.4)` }} />;
  }
  const initial = String(name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold uppercase text-white" style={{ background: `linear-gradient(135deg, hsl(${hue},75%,45%), hsl(${(hue + 30) % 360},65%,35%))` }}>
      {initial}
    </span>
  );
}

// Recursive, nested reply renderer. Reuses the Forum's existing reply state
// (drafts keyed by node id, activeReplyId, handleReply) so a reply targets the
// exact comment it's under. Indents with a left border per depth.
export default function ReplyTree({
  replies = [],
  depth = 0,
  isAuthenticated,
  user,
  isSubmitting,
  activeReplyId,
  onToggleReply,
  getReplyDraft,
  onUpdateReply,
  onReply,
  onDelete,
  timeAgo,
  people = [],
  resolveAvatar,
  resolveMeta,
}) {
  if (!replies.length) return null;
  const indent = depth > 0 ? "ml-3 border-l border-border/40 pl-3 md:ml-5 md:pl-5" : "";

  return (
    <div className={`grid gap-3 ${indent}`}>
      {replies.map((reply) => {
        const draft = getReplyDraft(reply.id);
        const open = activeReplyId === reply.id;
        const canDelete = isAuthenticated && ((user?.id && String(reply.user_id) === String(user.id)) || user?.role === "admin");

        return (
          <div key={reply.id} className="grid gap-2">
            <div className="border border-border/40 bg-muted/[0.03] p-3 transition-colors hover:bg-muted/[0.06]">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <ReplyAvatar name={reply.author_name} src={resolveAvatar ? resolveAvatar(reply.user_id, reply.author_avatar) : reply.author_avatar} />
                <span className="text-xs font-bold text-foreground">{reply.author_name || "Member"}</span>
                {(() => {
                  const meta = resolveMeta ? resolveMeta(reply.user_id) : null;
                  if (!meta) return null;
                  return (
                    <>
                      {meta.location && <span className="text-[10px] text-slate-300 font-medium" title={meta.location}>📍 {meta.location}</span>}
                      {meta.team && <span className="text-[10px] text-slate-300 font-medium" title={`Supports ${meta.team}`}>🏉 {meta.team}</span>}
                    </>
                  );
                })()}
                <span className="font-mono text-[9px] text-slate-400 font-bold">{timeAgo ? timeAgo(reply.created_date) : ""}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{reply.body}</p>
              <ForumMedia url={reply.media_url} type={reply.media_type} />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onToggleReply(reply.id)} className="flex min-h-11 items-center gap-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition-colors hover:text-accent">
                  <Reply className="h-3.5 w-3.5" /> Reply
                </button>
                {canDelete && (
                  <button type="button" onClick={() => onDelete(reply)} className="flex min-h-11 items-center gap-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition-colors hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
              </div>

              {open && (
                <form onSubmit={(e) => onReply(reply, e)} className="mt-3 grid gap-2 border-t border-border/40 pt-3">
                  {!isAuthenticated && (
                    <Input required placeholder="Your name" value={draft.author_name} onChange={(e) => onUpdateReply(reply.id, { author_name: e.target.value })} className="h-11 rounded-none text-sm" />
                  )}
                  <MentionTextarea required people={people} placeholder={`Reply to ${reply.author_name || "this comment"}… use @ to mention`} value={draft.body} onChange={(val) => onUpdateReply(reply.id, { body: val })} className="min-h-16 rounded-none text-sm" />
                  <MediaAttach value={draft.media_url} onChange={(url) => onUpdateReply(reply.id, { media_url: url })} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="mobile" className="rounded-none text-[10px] uppercase tracking-wider" onClick={() => onToggleReply(reply.id)}>Cancel</Button>
                    <Button type="submit" size="mobile" disabled={isSubmitting || !draft.body} className="rounded-none bg-primary text-[10px] uppercase tracking-wider text-white shadow-[0_0_10px_rgba(249,115,22,0.15)] transition-all hover:bg-primary/95 hover:shadow-[0_0_15px_rgba(249,115,22,0.4)]">
                      <Send className="mr-1 h-3.5 w-3.5" /> Reply
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {reply.replies?.length > 0 && (
              <ReplyTree
                replies={reply.replies}
                depth={depth + 1}
                isAuthenticated={isAuthenticated}
                user={user}
                isSubmitting={isSubmitting}
                activeReplyId={activeReplyId}
                onToggleReply={onToggleReply}
                getReplyDraft={getReplyDraft}
                onUpdateReply={onUpdateReply}
                onReply={onReply}
                onDelete={onDelete}
                timeAgo={timeAgo}
                people={people}
                resolveAvatar={resolveAvatar}
                resolveMeta={resolveMeta}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
