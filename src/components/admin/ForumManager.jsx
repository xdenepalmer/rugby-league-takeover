import React, { useMemo, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  Trash2, Ban as BanIcon, Globe, MessageSquare, Pin, Eye, EyeOff, Shield,
  AlertTriangle, CheckCircle2, Mail, ExternalLink, RotateCcw, CheckSquare,
  Square, Flag, X
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import BanDialog from "./BanDialog";

/* ━━━ Filter Tabs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "reported", label: "Reported" },
  { key: "deleted", label: "Deleted" },
];

/* ━━━ AuthorHistory ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function AuthorHistory({ email, allPosts, bans }) {
  const [open, setOpen] = useState(false);
  if (!email) return null;

  const authorPosts = allPosts.filter((p) => p.user_email === email);
  const totalPosts = authorPosts.length;
  const deletedPosts = authorPosts.filter((p) => !!p.deleted_at).length;
  const activeBans = (bans || []).filter(
    (b) => b.is_active && (b.value === email.toLowerCase() || b.ban_type === "email") && b.value === email.toLowerCase()
  ).length;

  return (
    <div className="mt-2 border-t border-border/10 pt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 hover:text-muted-foreground transition-colors"
      >
        {open ? "▾" : "▸"} Author History
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-1 flex flex-wrap gap-3"
        >
          <span className="text-[9px] font-mono text-muted-foreground/50">
            {totalPosts} total posts
          </span>
          <span className={`text-[9px] font-mono ${deletedPosts > 0 ? "text-destructive/60" : "text-muted-foreground/50"}`}>
            {deletedPosts} soft-deleted
          </span>
          <span className={`text-[9px] font-mono ${activeBans > 0 ? "text-destructive/60" : "text-muted-foreground/50"}`}>
            {activeBans} active bans
          </span>
        </motion.div>
      )}
    </div>
  );
}

/* ━━━ ModerationReasonInput ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ModerationReasonInput({ onConfirm, onCancel, actionLabel = "Confirm" }) {
  const [reason, setReason] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-3 border border-border/30 bg-muted/5 p-3"
    >
      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
        Reason (optional)
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is this post being moderated?"
        rows={2}
        className="w-full bg-background/50 border border-border/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 resize-none"
      />
      <div className="flex items-center gap-2 mt-2">
        <Button
          variant="ghost"
          size="mobile"
          onClick={onCancel}
          className="rounded-none text-[9px] font-bold uppercase tracking-wider"
        >
          Cancel
        </Button>
        <Button
          size="mobile"
          onClick={() => onConfirm(reason)}
          className="rounded-none bg-destructive hover:bg-destructive/90 text-destructive-foreground text-[9px] font-bold uppercase tracking-wider"
        >
          {actionLabel}
        </Button>
      </div>
    </motion.div>
  );
}

/* ━━━ PostCard ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function PostCard({
  post, onTogglePublished, onTogglePin, onSoftDelete, onRestore,
  onBanEmail, onBanIP, banPending, index, selectMode, selected, onToggleSelect,
  allPosts, bans
}) {
  const [expanded, setExpanded] = useState(false);
  const [showReasonFor, setShowReasonFor] = useState(null); // 'delete' | 'reject' | null
  const isPending = post.is_published !== true && !post.deleted_at;
  const isPinned = post.is_pinned === true;
  const isDeleted = !!post.deleted_at;
  const isReported = (post.reported_count || 0) > 0 && !isDeleted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.3 }}
      className={`group relative overflow-hidden border transition-all duration-200 ${
        isDeleted
          ? "border-destructive/20 bg-destructive/[0.02] opacity-70"
          : isReported
            ? "border-rose-500/30 bg-rose-500/[0.03]"
            : isPending
              ? "border-amber-500/30 bg-amber-500/[0.03]"
              : isPinned
                ? "border-primary/30 bg-primary/[0.03]"
                : "border-border/60 bg-card/30 hover:border-border"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-primary/[0.02] via-white/[0.05] to-transparent" />
      {/* Top accent */}
      <div className={`h-[2px] w-full bg-gradient-to-r ${
        isDeleted ? "from-destructive/40 to-destructive/10"
          : isReported ? "from-rose-500/60 to-rose-500/20"
            : isPending ? "from-amber-500/60 to-amber-500/20"
              : isPinned ? "from-primary/60 to-primary/20"
                : "from-border to-border/30"
      }`} />

      <div className="p-4 md:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          {/* Checkbox for bulk select */}
          {selectMode && (
            <button
              type="button"
              onClick={() => onToggleSelect(post.id)}
              className="mt-1 shrink-0 p-1 text-muted-foreground hover:text-primary transition-colors"
            >
              {selected ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </button>
          )}

          <div className="min-w-0 flex-1">
            {/* Meta badges */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {isDeleted && (
                <span className="inline-flex items-center gap-1 bg-destructive/10 border border-destructive/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-destructive">
                  <Trash2 className="h-2.5 w-2.5" /> Deleted
                </span>
              )}
              {isReported && (
                <span className="inline-flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-rose-400">
                  <Flag className="h-2.5 w-2.5" /> {post.reported_count} Reports
                </span>
              )}
              {isPending && !isDeleted && (
                <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-400">
                  <AlertTriangle className="h-2.5 w-2.5" /> Pending Review
                </span>
              )}
              {isPinned && !isDeleted && (
                <span className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary">
                  <Pin className="h-2.5 w-2.5" /> Pinned
                </span>
              )}
              {!isPending && !isPinned && !isDeleted && !isReported && (
                <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Published
                </span>
              )}
              {post.category && (
                <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-muted-foreground border border-border/30 bg-muted/10">
                  {post.category}
                </span>
              )}
            </div>

            {/* Author + date */}
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70 mb-1">
              {post.author_name || "Anonymous"}
              <span className="text-muted-foreground/40"> · </span>
              <span className="text-muted-foreground/40 font-mono">
                {post.created_date ? format(new Date(post.created_date), "dd MMM yyyy 'at' HH:mm") : "Today"}
              </span>
            </p>

            {/* Title */}
            <h4 className="text-base font-bold text-foreground leading-tight">
              {post.title || "Reply"}
            </h4>

            {/* Body */}
            <p className={`mt-2 text-sm text-muted-foreground/70 leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
              {post.body}
            </p>
            {(post.body || "").length > 120 && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-[9px] font-bold uppercase tracking-wider text-primary/50 hover:text-primary mt-1 transition-colors"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}

            {/* Moderation reason display */}
            {post.moderation_reason && (
              <p className="mt-2 text-[9px] font-mono text-destructive/50 border-l-2 border-destructive/20 pl-2">
                Mod reason: {post.moderation_reason}
              </p>
            )}

            {/* Deleted by info */}
            {isDeleted && post.deleted_by && (
              <p className="mt-1 text-[9px] font-mono text-destructive/40">
                Deleted by {post.deleted_by} on {post.deleted_at ? format(new Date(post.deleted_at), "dd MMM yyyy") : "unknown"}
              </p>
            )}

            {/* Identity info */}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {post.user_email && (
                <span className="inline-flex items-center gap-1 text-[9px] font-mono text-muted-foreground/40">
                  <Mail className="h-3 w-3" /> {post.user_email}
                </span>
              )}
              {post.ip_address && (
                <span className="inline-flex items-center gap-1 text-[9px] font-mono text-muted-foreground/40">
                  <Globe className="h-3 w-3" /> {post.ip_address}
                </span>
              )}
            </div>

            {/* Author History */}
            <AuthorHistory email={post.user_email} allPosts={allPosts} bans={bans} />
          </div>
        </div>

        {/* Actions bar */}
        {!selectMode && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/20 pt-3">
            {isDeleted ? (
              /* Restore button for deleted posts */
              <Button
                variant="outline"
                size="mobile"
                className="rounded-none border-emerald-500/30 text-[9px] font-bold uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/10"
                onClick={onRestore}
              >
                <RotateCcw className="mr-1 h-3 w-3" /> Restore
              </Button>
            ) : (
              <>
                {/* Publish toggle */}
                <label className="touch-target inline-flex items-center gap-2 border border-border/30 bg-muted/5 px-3 py-2 transition-colors hover:bg-muted/10">
                  {post.is_published === true ? <Eye className="h-3 w-3 text-emerald-400" /> : <EyeOff className="h-3 w-3 text-muted-foreground/40" />}
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    {post.is_published === true ? "Live" : "Hidden"}
                  </span>
                  <Switch
                    checked={post.is_published === true}
                    onCheckedChange={(value) => {
                      if (!value) {
                        // Turning off → show reason input
                        setShowReasonFor("reject");
                      } else {
                        onTogglePublished(value, "");
                      }
                    }}
                  />
                </label>

                {/* Pin toggle */}
                <label className="touch-target inline-flex items-center gap-2 border border-border/30 bg-muted/5 px-3 py-2 transition-colors hover:bg-muted/10">
                  <Pin className={`h-3 w-3 ${isPinned ? "text-primary" : "text-muted-foreground/40"}`} />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Pin</span>
                  <Switch
                    checked={isPinned}
                    onCheckedChange={onTogglePin}
                  />
                </label>
              </>
            )}

            <div className="flex-1" />

            {/* View Public Thread */}
            <a
              href="/forum"
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target inline-flex items-center gap-1 border border-border/30 bg-muted/5 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> Forum
            </a>

            {/* Ban controls */}
            {!isDeleted && post.user_email && (
              <BanDialog
                title={`Ban ${post.author_name || post.user_email}`}
                description="Blocks this email and account from posting."
                confirmLabel="Ban author"
                pending={banPending}
                onConfirm={onBanEmail}
                trigger={
                  <Button variant="outline" size="mobile" className="rounded-none border-border/30 text-[9px] font-bold uppercase tracking-wider">
                    <BanIcon className="mr-1 h-3 w-3" /> Author
                  </Button>
                }
              />
            )}
            {!isDeleted && post.ip_address && (
              <BanDialog
                title={`Ban IP ${post.ip_address}`}
                description="Blocks this IP address from posting or registering."
                confirmLabel="Ban IP"
                pending={banPending}
                onConfirm={onBanIP}
                trigger={
                  <Button variant="outline" size="mobile" className="rounded-none border-border/30 text-[9px] font-bold uppercase tracking-wider">
                    <Globe className="mr-1 h-3 w-3" /> IP
                  </Button>
                }
              />
            )}

            {!isDeleted && (
              <Button
                variant="ghost"
                size="mobile"
                className="rounded-none text-[9px] font-bold uppercase tracking-wider text-destructive/60 hover:bg-destructive/5 hover:text-destructive"
                onClick={() => setShowReasonFor("delete")}
              >
                <Trash2 className="mr-1 h-3 w-3" /> Soft Delete
              </Button>
            )}
          </div>
        )}

        {/* Moderation reason input */}
        <AnimatePresence>
          {showReasonFor === "delete" && (
            <ModerationReasonInput
              actionLabel="Soft Delete"
              onCancel={() => setShowReasonFor(null)}
              onConfirm={(reason) => {
                onSoftDelete(reason);
                setShowReasonFor(null);
              }}
            />
          )}
          {showReasonFor === "reject" && (
            <ModerationReasonInput
              actionLabel="Reject & Hide"
              onCancel={() => setShowReasonFor(null)}
              onConfirm={(reason) => {
                onTogglePublished(false, reason);
                setShowReasonFor(null);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ━━━ BulkActionBar ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function BulkActionBar({ selectedCount, onApproveAll, onDeleteAll, onCancel, loading }) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 300 }}
          className="fixed bottom-0 inset-x-0 z-[100] border-t border-border bg-card/95 backdrop-blur-md pb-[var(--safe-bottom,0px)]"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 max-w-5xl mx-auto">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              {selectedCount} selected
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={onCancel}
                disabled={loading}
                className="min-h-[44px] rounded-none text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                onClick={onApproveAll}
                disabled={loading}
                className="min-h-[44px] rounded-none bg-emerald-600 hover:bg-emerald-600/90 text-xs font-bold uppercase tracking-widest"
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                {loading ? "Processing…" : "Approve All"}
              </Button>
              <Button
                onClick={onDeleteAll}
                disabled={loading}
                className="min-h-[44px] rounded-none bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold uppercase tracking-widest"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {loading ? "Processing…" : "Delete All"}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ━━━ ForumManager ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function ForumManager({ posts }) {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  /* ── Fetch bans for author history ── */
  const { data: bans = [] } = useQuery({
    queryKey: ["bans"],
    queryFn: () => base44.entities.Ban.list(),
    staleTime: 60_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["forumPosts"] });

  const updateMutation = useMutation({ 
    mutationFn: ({ id, data }) => base44.entities.ForumPost.update(id, data), 
    onSuccess: (savedData, variables) => {
      refresh();
      const keyChanged = Object.keys(variables.data)[0];
      const valChanged = String(variables.data[keyChanged]);
      window.dispatchEvent(new CustomEvent("rlt_admin_log", {
        detail: {
          type: "info",
          text: `[FORUM-MOD] Thread/Post ID ${variables.id} updated: ${keyChanged} set to ${valChanged}`
        }
      }));
    }
  });

  const createBan = useMutation({
    mutationFn: ({ ban_type, value, reason, expiresAt }) => base44.entities.Ban.create({
      ban_type,
      value: String(value).toLowerCase(),
      reason: reason || "Banned from forum moderation",
      banned_by: me?.email || "",
      expires_at: expiresAt || "",
      is_active: true,
    }),
    onSuccess: (data, variables) => { 
      queryClient.invalidateQueries({ queryKey: ["bans"] }); 
      toast({ title: "Ban applied" }); 
      window.dispatchEvent(new CustomEvent("rlt_admin_log", {
        detail: {
          type: "warn",
          text: `[BAN-ACTION] Forum mod block registered on ${variables.ban_type}: ${variables.value}`
        }
      }));
    },
  });

  /* ── Soft-delete handler ── */
  const handleSoftDelete = useCallback((postId, reason) => {
    updateMutation.mutate({
      id: postId,
      data: {
        deleted_at: new Date().toISOString(),
        deleted_by: me?.email || "",
        is_published: false,
        ...(reason ? { moderation_reason: reason } : {}),
      },
    });
    window.dispatchEvent(new CustomEvent("rlt_admin_log", {
      detail: {
        type: "warn",
        text: `[FORUM-MOD] Thread/Post ID ${postId} was SOFT-DELETED by ${me?.email || "unknown"}`
      }
    }));
  }, [updateMutation, me]);

  /* ── Restore handler ── */
  const handleRestore = useCallback((postId) => {
    updateMutation.mutate({
      id: postId,
      data: {
        deleted_at: "",
        deleted_by: "",
        is_published: false, // still needs approval
      },
    });
    toast({ title: "Post restored (awaiting approval)" });
    window.dispatchEvent(new CustomEvent("rlt_admin_log", {
      detail: {
        type: "info",
        text: `[FORUM-MOD] Thread/Post ID ${postId} was RESTORED by ${me?.email || "unknown"}`
      }
    }));
  }, [updateMutation, me]);

  /* ── Bulk actions ── */
  const handleBulkApprove = useCallback(async () => {
    setBulkLoading(true);
    for (const id of selectedIds) {
      try {
        await base44.entities.ForumPost.update(id, { is_published: true });
      } catch { /* continue */ }
    }
    window.dispatchEvent(new CustomEvent("rlt_admin_log", {
      detail: { type: "info", text: `[FORUM-MOD] Bulk approved ${selectedIds.size} posts by ${me?.email || "unknown"}` }
    }));
    setSelectedIds(new Set());
    setSelectMode(false);
    setBulkLoading(false);
    refresh();
    toast({ title: `${selectedIds.size} posts approved` });
  }, [selectedIds, me, refresh]);

  const handleBulkDelete = useCallback(async () => {
    setBulkLoading(true);
    const now = new Date().toISOString();
    for (const id of selectedIds) {
      try {
        await base44.entities.ForumPost.update(id, {
          deleted_at: now,
          deleted_by: me?.email || "",
          is_published: false,
        });
      } catch { /* continue */ }
    }
    window.dispatchEvent(new CustomEvent("rlt_admin_log", {
      detail: { type: "warn", text: `[FORUM-MOD] Bulk soft-deleted ${selectedIds.size} posts by ${me?.email || "unknown"}` }
    }));
    setSelectedIds(new Set());
    setSelectMode(false);
    setBulkLoading(false);
    refresh();
    toast({ title: `${selectedIds.size} posts soft-deleted` });
  }, [selectedIds, me, refresh]);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* ── Filtered posts by tab ── */
  const visiblePosts = useMemo(() => {
    let list;
    switch (activeTab) {
      case "pending":
        list = posts.filter((p) => p.is_published !== true && !p.deleted_at);
        break;
      case "reported":
        list = posts.filter((p) => (p.reported_count || 0) > 0 && !p.deleted_at);
        break;
      case "deleted":
        list = posts.filter((p) => !!p.deleted_at);
        break;
      case "all":
      default:
        list = posts.filter((p) => !p.deleted_at);
        break;
    }
    return [...list].sort((a, b) => Number(a.is_published === true) - Number(b.is_published === true));
  }, [posts, activeTab]);

  const pendingCount = posts.filter((p) => p.is_published !== true && !p.deleted_at).length;
  const publishedCount = posts.filter((p) => p.is_published === true && !p.deleted_at).length;
  const reportedCount = posts.filter((p) => (p.reported_count || 0) > 0 && !p.deleted_at).length;
  const deletedCount = posts.filter((p) => !!p.deleted_at).length;

  const tabCounts = { all: posts.filter((p) => !p.deleted_at).length, pending: pendingCount, reported: reportedCount, deleted: deletedCount };

  return (
    <div className="border border-border/60 bg-card/30 cmd-glass overflow-hidden">
      <div className="h-[2px] w-full bg-gradient-to-r from-violet-500 via-violet-400 to-violet-500" />

      <div className="p-5 md:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/10 border border-violet-500/20">
              <Shield className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <h2 className="font-display text-2xl uppercase tracking-wide">Forum Moderation</h2>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[9px] font-mono text-muted-foreground/40">{posts.length} total</span>
                <span className="text-[9px] font-mono text-emerald-400/60">{publishedCount} live</span>
                {pendingCount > 0 && (
                  <span className="text-[9px] font-mono text-amber-400">{pendingCount} pending</span>
                )}
                {reportedCount > 0 && (
                  <span className="text-[9px] font-mono text-rose-400">{reportedCount} reported</span>
                )}
              </div>
            </div>
          </div>

          {/* Select mode toggle */}
          <button
            type="button"
            onClick={() => {
              setSelectMode((v) => !v);
              setSelectedIds(new Set());
            }}
            className={`touch-target flex items-center gap-2 border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
              selectMode
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border/40 text-muted-foreground/50 hover:text-muted-foreground hover:border-border"
            }`}
          >
            <CheckSquare className="h-3 w-3" />
            Select
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-5 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`touch-target flex items-center gap-2 border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? tab.key === "deleted"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : tab.key === "reported"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                      : tab.key === "pending"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/40 text-muted-foreground/50 hover:text-muted-foreground hover:border-border"
              }`}
            >
              {tab.label}
              {tabCounts[tab.key] > 0 && (
                <span className={`px-1.5 py-0 text-[8px] font-mono ${
                  activeTab === tab.key ? "bg-white/10" : "bg-muted/20"
                }`}>
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Posts */}
        <div className="space-y-3">
          {visiblePosts.length === 0 && (
            <div className="border border-border/30 bg-muted/5 p-10 text-center">
              <MessageSquare className="h-6 w-6 mx-auto text-muted-foreground/15 mb-2" />
              <p className="text-sm text-muted-foreground/30">No forum posts to show.</p>
            </div>
          )}
          {visiblePosts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              index={index}
              selectMode={selectMode}
              selected={selectedIds.has(post.id)}
              onToggleSelect={toggleSelect}
              allPosts={posts}
              bans={bans}
              onTogglePublished={(value, reason) => {
                const data = { is_published: value };
                if (reason) data.moderation_reason = reason;
                updateMutation.mutate({ id: post.id, data });
              }}
              onTogglePin={(value) => updateMutation.mutate({ id: post.id, data: { is_pinned: value } })}
              onSoftDelete={(reason) => handleSoftDelete(post.id, reason)}
              onRestore={() => handleRestore(post.id)}
              banPending={createBan.isPending}
              onBanEmail={async ({ reason, expiresAt }) => {
                await createBan.mutateAsync({ ban_type: "email", value: post.user_email, reason, expiresAt });
                if (post.user_id) await createBan.mutateAsync({ ban_type: "user", value: post.user_id, reason, expiresAt });
              }}
              onBanIP={({ reason, expiresAt }) => createBan.mutateAsync({ ban_type: "ip", value: post.ip_address, reason, expiresAt })}
            />
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onApproveAll={handleBulkApprove}
        onDeleteAll={handleBulkDelete}
        onCancel={() => {
          setSelectedIds(new Set());
          setSelectMode(false);
        }}
        loading={bulkLoading}
      />
    </div>
  );
}
