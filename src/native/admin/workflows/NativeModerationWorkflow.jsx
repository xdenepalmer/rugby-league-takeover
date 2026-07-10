import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, MessageSquare, Pin, Eye, EyeOff, Trash2, RotateCcw, Flag, ExternalLink, Ban as BanIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import BanDialog from "@/components/admin/BanDialog";
import MobileActionDrawer from "@/components/admin/MobileActionDrawer";
import PullToRefresh from "@/components/PullToRefresh";
import UserAvatar from "@/components/forum/feed/UserAvatar";
import { timeAgo } from "@/components/forum/feed/forumHelpers";
import { emitHaptic } from "@/lib/native/haptic-events";
import { useWindowedList } from "@/hooks/use-windowed-list";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  MOD_QUEUES,
  moderationQueue,
  moderationCounts,
  buildSoftDeletePayload,
  buildRestorePayload,
  fanThreadPath,
  emitAdminLog,
} from "./workflow-helpers.js";

/**
 * Native forum moderation queue — /admin/community/forum. Every action
 * writes the exact payloads the web ForumManager writes (ForumPost.update /
 * Ban.create); server RLS stays the authority.
 */
export default function NativeModerationQueue() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState("pending");
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState(null); // { post, action: "hide" | "remove" }
  const [reason, setReason] = useState(""); // optional moderation_reason for the open sheet

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["forumPosts"],
    queryFn: () => base44.entities.ForumPost.list("-created_date", 200),
    enabled: appParams.hasBase44Config,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ForumPost.update(id, data),
    onSuccess: (savedData, variables) => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["forumPosts"] });
      queryClient.invalidateQueries({ queryKey: ["adminAttention"] });
      // Same audit trail the web ForumManager dispatches.
      const keyChanged = Object.keys(variables.data)[0];
      emitAdminLog("info", `[FORUM-MOD] Thread/Post ID ${variables.id} updated: ${keyChanged} set to ${String(variables.data[keyChanged])}`);
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Moderation action failed", description: error.message, variant: "destructive" });
    },
  });

  const banMutation = useMutation({
    mutationFn: ({ ban_type, value, reason: banReason, expiresAt }) =>
      base44.entities.Ban.create({
        ban_type,
        value: String(value).toLowerCase(),
        reason: banReason || "Banned from forum moderation",
        banned_by: user?.email || "",
        expires_at: expiresAt || "",
        is_active: true,
      }),
    onSuccess: (data, variables) => {
      emitHaptic("mutation.warning");
      queryClient.invalidateQueries({ queryKey: ["bans"] });
      toast({ title: "Ban applied" });
      emitAdminLog("warn", `[BAN-ACTION] Forum mod block registered on ${variables.ban_type}: ${variables.value}`);
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Ban failed", description: error.message, variant: "destructive" });
    },
  });

  const counts = useMemo(() => moderationCounts(posts), [posts]);
  const visible = useMemo(() => {
    let list = moderationQueue(posts, queue);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.body?.toLowerCase().includes(q) ||
          p.author_name?.toLowerCase().includes(q) ||
          p.user_email?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [posts, queue, query]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, { initial: 12, step: 12 });

  const act = (post, action) => {
    if (action === "publish") updateMutation.mutate({ id: post.id, data: { is_published: true } });
    if (action === "pin") updateMutation.mutate({ id: post.id, data: { is_pinned: post.is_pinned !== true } });
    if (action === "restore") {
      updateMutation.mutate({ id: post.id, data: buildRestorePayload() });
      emitAdminLog("info", `[FORUM-MOD] Thread/Post ID ${post.id} was RESTORED by ${user?.email || "unknown"}`);
    }
  };

  // Hide/remove capture an optional moderation_reason (web parity: the
  // ForumManager prompts for a reason and writes it with the update).
  const openReasonSheet = (post, action) => {
    setReason("");
    setConfirm({ post, action });
  };

  const confirmReasonAction = () => {
    if (!confirm) return;
    const trimmed = reason.trim();
    if (confirm.action === "hide") {
      updateMutation.mutate({
        id: confirm.post.id,
        data: { is_published: false, ...(trimmed ? { moderation_reason: trimmed } : {}) },
      });
    } else {
      updateMutation.mutate({ id: confirm.post.id, data: buildSoftDeletePayload(user?.email, trimmed || undefined) });
      emitAdminLog("warn", `[FORUM-MOD] Thread/Post ID ${confirm.post.id} was SOFT-DELETED by ${user?.email || "unknown"}`);
    }
    setConfirm(null);
  };

  return (
    <div className="pb-8">
      <NativeTopBar title="Moderation" fallback="/admin/community" />
      <PullToRefresh queryKeys={[["forumPosts"]]}>
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 border border-border bg-card/50 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, body, author, email"
              aria-label="Search posts"
              className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="ios-scroll flex gap-2 overflow-x-auto py-2">
            {MOD_QUEUES.map((q) => (
              <button
                key={q.key}
                type="button"
                aria-pressed={queue === q.key}
                onClick={() => setQueue(q.key)}
                className={`ios-pressable min-h-9 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                  queue === q.key ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
                }`}
              >
                {q.label} ({counts[q.key] ?? 0})
              </button>
            ))}
          </div>
        </div>

        {isLoading && posts.length === 0 ? (
          <div className="space-y-2 px-4">
            <NativeSkeleton className="h-28 w-full" />
            <NativeSkeleton className="h-28 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState icon={MessageSquare} title="Queue clear" description="Nothing needs moderation here." />
          </div>
        ) : (
          windowed.map((post) => {
            const removed = !!post.deleted_at;
            return (
              <article key={post.id} className="border-b border-border/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <UserAvatar name={post.author_name} size="sm" src={post.author_avatar} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{post.author_name || post.user_email || "Member"}</p>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                      {timeAgo(post.created_date)} · {post.category || "General"} {post.parent_id ? "· reply" : ""}
                    </p>
                  </div>
                  {(post.reported_count || 0) > 0 && (
                    <span className="flex items-center gap-1 border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-red-300">
                      <Flag className="h-3 w-3" aria-hidden="true" /> {post.reported_count}
                    </span>
                  )}
                  {post.is_pinned === true && <Pin className="h-3.5 w-3.5 text-primary" aria-label="Pinned" />}
                </div>
                {post.title && !/^(Reply$|Re: )/.test(post.title) && <p className="pt-2 text-sm font-bold leading-snug">{post.title}</p>}
                <p className="line-clamp-3 pt-1 text-sm text-muted-foreground">{post.body}</p>
                {removed && (
                  <p className="pt-1 text-[10px] uppercase tracking-widest text-red-300">
                    Removed {post.deleted_by ? `by ${post.deleted_by}` : ""} {post.moderation_reason ? `· ${post.moderation_reason}` : ""}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {!removed && post.is_published !== true && (
                    <button type="button" disabled={updateMutation.isPending} onClick={() => act(post, "publish")} className="ios-pressable flex min-h-10 items-center gap-1.5 border border-emerald-500/50 bg-emerald-500/10 px-3 text-[10px] font-bold uppercase tracking-widest text-emerald-300 disabled:opacity-40">
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Publish
                    </button>
                  )}
                  {!removed && post.is_published === true && (
                    <button type="button" disabled={updateMutation.isPending} onClick={() => openReasonSheet(post, "hide")} className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Hide
                    </button>
                  )}
                  {!removed && !post.parent_id && (
                    <button type="button" disabled={updateMutation.isPending} onClick={() => act(post, "pin")} className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">
                      <Pin className="h-3.5 w-3.5" aria-hidden="true" /> {post.is_pinned === true ? "Unpin" : "Pin"}
                    </button>
                  )}
                  {!removed ? (
                    <button type="button" onClick={() => { emitHaptic("mutation.warning"); openReasonSheet(post, "remove"); }} className="ios-pressable flex min-h-10 items-center gap-1.5 border border-red-500/40 px-3 text-[10px] font-bold uppercase tracking-widest text-red-400">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                    </button>
                  ) : (
                    <button type="button" disabled={updateMutation.isPending} onClick={() => act(post, "restore")} className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Restore
                    </button>
                  )}
                  <button type="button" onClick={() => { emitHaptic("tab.select"); navigate(fanThreadPath(post)); }} className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> View thread
                  </button>
                  {!removed && post.user_email && (
                    <BanDialog
                      title={`Ban ${post.author_name || post.user_email}`}
                      description="Blocks this author from posting. Applies immediately."
                      confirmLabel="Ban author"
                      pending={banMutation.isPending}
                      onConfirm={async ({ reason: banReason, expiresAt }) => {
                        // Web parity (ForumManager.onBanEmail): ban the email
                        // AND, when known, the user id — an email change must
                        // not evade the ban.
                        await banMutation.mutateAsync({ ban_type: "email", value: post.user_email, reason: banReason, expiresAt });
                        if (post.user_id) {
                          await banMutation.mutateAsync({ ban_type: "user", value: post.user_id, reason: banReason, expiresAt });
                        }
                      }}
                      trigger={
                        <button type="button" className="ios-pressable flex min-h-10 items-center gap-1.5 border border-red-500/40 px-3 text-[10px] font-bold uppercase tracking-widest text-red-400">
                          <BanIcon className="h-3.5 w-3.5" aria-hidden="true" /> Ban author
                        </button>
                      }
                    />
                  )}
                  {!removed && post.ip_address && (
                    <BanDialog
                      title={`Ban IP ${post.ip_address}`}
                      description="Blocks this IP address from posting."
                      confirmLabel="Ban IP"
                      pending={banMutation.isPending}
                      onConfirm={({ reason: banReason, expiresAt }) =>
                        banMutation.mutateAsync({ ban_type: "ip", value: post.ip_address, reason: banReason, expiresAt })
                      }
                      trigger={
                        <button type="button" className="ios-pressable flex min-h-10 items-center gap-1.5 border border-red-500/40 px-3 text-[10px] font-bold uppercase tracking-widest text-red-400">
                          <BanIcon className="h-3.5 w-3.5" aria-hidden="true" /> Ban IP
                        </button>
                      }
                    />
                  )}
                </div>
              </article>
            );
          })
        )}
        {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
      </PullToRefresh>

      <MobileActionDrawer
        open={!!confirm}
        onOpenChange={(open) => { if (!open) setConfirm(null); }}
        title={confirm?.action === "hide" ? "Hide this post?" : "Remove this post?"}
        description={
          confirm?.action === "hide"
            ? "Unpublishes the post (it returns to the Pending queue)."
            : "Soft-removes the post from the forum (restorable from the Removed queue). The author is recorded."
        }
      >
        <div className="grid gap-2 py-2">
          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-moderation-reason">
            Reason (optional)
          </label>
          <Input
            id="native-moderation-reason"
            placeholder="e.g. Spam, abuse, off-topic"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-11 rounded-none border-border bg-background"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-3">
          <button type="button" disabled={updateMutation.isPending} onClick={() => setConfirm(null)} className="ios-pressable flex min-h-11 items-center justify-center border border-border text-xs font-bold uppercase tracking-widest disabled:opacity-40">
            Cancel
          </button>
          <button type="button" disabled={updateMutation.isPending} onClick={confirmReasonAction} className="ios-pressable flex min-h-11 items-center justify-center border border-red-500/60 bg-red-500/15 text-xs font-bold uppercase tracking-widest text-red-300 disabled:opacity-40">
            {confirm?.action === "hide" ? "Hide post" : "Remove post"}
          </button>
        </div>
      </MobileActionDrawer>
    </div>
  );
}
