import React, { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Trash2, Ban as BanIcon, Globe, Filter } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import BanDialog from "./BanDialog";

export default function ForumManager({ posts }) {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [pendingOnly, setPendingOnly] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["forumPosts"] });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.ForumPost.update(id, data), onSuccess: refresh });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.ForumPost.delete(id), onSuccess: refresh });

  const createBan = useMutation({
    mutationFn: ({ ban_type, value, reason, expiresAt }) => base44.entities.Ban.create({
      ban_type,
      value: String(value).toLowerCase(),
      reason: reason || "Banned from forum moderation",
      banned_by: me?.email || "",
      expires_at: expiresAt || "",
      is_active: true,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bans"] }); toast({ title: "Ban applied" }); },
  });

  const visiblePosts = useMemo(() => {
    const list = pendingOnly ? posts.filter((p) => p.is_published !== true) : posts;
    return [...list].sort((a, b) => Number(a.is_published === true) - Number(b.is_published === true));
  }, [posts, pendingOnly]);

  const pendingCount = posts.filter((p) => p.is_published !== true).length;

  return (
    <section id="forum-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-4xl uppercase">Forum Moderation</h2>
        <button
          type="button"
          onClick={() => setPendingOnly((v) => !v)}
          className={`flex items-center gap-2 border px-3 py-2 text-xs font-bold uppercase tracking-wider ${pendingOnly ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
        >
          <Filter className="h-4 w-4" /> Pending only {pendingCount > 0 && <Badge variant="outline" className="rounded-none">{pendingCount}</Badge>}
        </button>
      </div>

      <div className="mt-6 grid gap-4">
        {visiblePosts.length === 0 && <p className="text-sm text-muted-foreground">No forum posts to show.</p>}
        {visiblePosts.map((post) => (
          <div key={post.id} className="grid gap-4 border border-border p-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs uppercase tracking-[0.25em] text-primary">{post.author_name} · {post.created_date ? format(new Date(post.created_date), "dd MMM yyyy") : "Today"}</p>
                {post.is_published !== true && <Badge variant="outline" className="rounded-none border-amber-500/40 text-amber-400">Pending</Badge>}
              </div>
              <h3 className="mt-2 text-lg font-semibold">{post.title || "Reply"}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.body}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {post.user_email ? `Account: ${post.user_email}` : "Anonymous"}{post.ip_address ? ` · IP: ${post.ip_address}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Live <Switch checked={post.is_published === true} onCheckedChange={(value) => updateMutation.mutate({ id: post.id, data: { is_published: value } })} />
              Pin <Switch checked={post.is_pinned === true} onCheckedChange={(value) => updateMutation.mutate({ id: post.id, data: { is_pinned: value } })} />
              {post.user_email && (
                <BanDialog
                  title={`Ban ${post.author_name || post.user_email}`}
                  description="Blocks this email and account from posting."
                  confirmLabel="Ban author"
                  pending={createBan.isPending}
                  onConfirm={async ({ reason, expiresAt }) => {
                    await createBan.mutateAsync({ ban_type: "email", value: post.user_email, reason, expiresAt });
                    if (post.user_id) await createBan.mutateAsync({ ban_type: "user", value: post.user_id, reason, expiresAt });
                  }}
                  trigger={<Button variant="outline" size="sm" className="rounded-none"><BanIcon className="mr-1 h-4 w-4" /> Author</Button>}
                />
              )}
              {post.ip_address && (
                <BanDialog
                  title={`Ban IP ${post.ip_address}`}
                  description="Blocks this IP address from posting or registering. Best-effort — VPNs and shared connections can evade it."
                  confirmLabel="Ban IP"
                  pending={createBan.isPending}
                  onConfirm={({ reason, expiresAt }) => createBan.mutateAsync({ ban_type: "ip", value: post.ip_address, reason, expiresAt })}
                  trigger={<Button variant="outline" size="sm" className="rounded-none"><Globe className="mr-1 h-4 w-4" /> IP</Button>}
                />
              )}
              <Button variant="destructive" size="icon" className="rounded-none" onClick={() => deleteMutation.mutate(post.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
