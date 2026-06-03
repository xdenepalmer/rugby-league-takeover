import React, { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Trash2, Ban as BanIcon, Globe, Filter, MessageSquare, Pin, Eye, EyeOff, Shield, AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import BanDialog from "./BanDialog";

function PostCard({ post, onTogglePublished, onTogglePin, onDelete, onBanEmail, onBanIP, banPending, index }) {
  const [expanded, setExpanded] = useState(false);
  const isPending = post.is_published !== true;
  const isPinned = post.is_pinned === true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.3 }}
      className={`group relative overflow-hidden border transition-all duration-200 ${
        isPending
          ? "border-amber-500/30 bg-amber-500/[0.03]"
          : isPinned
            ? "border-primary/30 bg-primary/[0.03]"
            : "border-border/60 bg-card/30 hover:border-border"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-primary/[0.02] via-white/[0.05] to-transparent" />
      {/* Top accent */}
      <div className={`h-[2px] w-full bg-gradient-to-r ${
        isPending ? "from-amber-500/60 to-amber-500/20" : isPinned ? "from-primary/60 to-primary/20" : "from-border to-border/30"
      }`} />

      <div className="p-4 md:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Meta badges */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {isPending && (
                <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-400">
                  <AlertTriangle className="h-2.5 w-2.5" /> Pending Review
                </span>
              )}
              {isPinned && (
                <span className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary">
                  <Pin className="h-2.5 w-2.5" /> Pinned
                </span>
              )}
              {!isPending && !isPinned && (
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
          </div>
        </div>

        {/* Actions bar */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/20 pt-3">
          {/* Publish toggle */}
          <label className="touch-target inline-flex items-center gap-2 border border-border/30 bg-muted/5 px-3 py-2 transition-colors hover:bg-muted/10">
            {post.is_published === true ? <Eye className="h-3 w-3 text-emerald-400" /> : <EyeOff className="h-3 w-3 text-muted-foreground/40" />}
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {post.is_published === true ? "Live" : "Hidden"}
            </span>
            <Switch
              checked={post.is_published === true}
              onCheckedChange={onTogglePublished}
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

          <div className="flex-1" />

          {/* Ban controls */}
          {post.user_email && (
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
          {post.ip_address && (
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

          <Button
            variant="ghost"
            size="mobile"
            className="rounded-none text-[9px] font-bold uppercase tracking-wider text-destructive/60 hover:bg-destructive/5 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="mr-1 h-3 w-3" /> Delete
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function ForumManager({ posts }) {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [pendingOnly, setPendingOnly] = useState(false);

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

  const deleteMutation = useMutation({ 
    mutationFn: (id) => base44.entities.ForumPost.delete(id), 
    onSuccess: (savedData, id) => {
      refresh();
      window.dispatchEvent(new CustomEvent("rlt_admin_log", {
        detail: {
          type: "warn",
          text: `[FORUM-MOD] Thread/Post ID ${id} was permanently DELETED`
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

  const visiblePosts = useMemo(() => {
    const list = pendingOnly ? posts.filter((p) => p.is_published !== true) : posts;
    return [...list].sort((a, b) => Number(a.is_published === true) - Number(b.is_published === true));
  }, [posts, pendingOnly]);

  const pendingCount = posts.filter((p) => p.is_published !== true).length;
  const publishedCount = posts.filter((p) => p.is_published === true).length;

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
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPendingOnly((v) => !v)}
            className={`touch-target flex items-center gap-2 border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
              pendingOnly
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-border/40 text-muted-foreground/50 hover:text-muted-foreground hover:border-border"
            }`}
          >
            <Filter className="h-3 w-3" />
            Pending only
            {pendingCount > 0 && (
              <span className={`px-1.5 py-0 text-[8px] font-mono ${pendingOnly ? "bg-amber-500/20" : "bg-muted/20"}`}>
                {pendingCount}
              </span>
            )}
          </button>
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
              onTogglePublished={(value) => updateMutation.mutate({ id: post.id, data: { is_published: value } })}
              onTogglePin={(value) => updateMutation.mutate({ id: post.id, data: { is_pinned: value } })}
              onDelete={() => deleteMutation.mutate(post.id)}
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
    </div>
  );
}
