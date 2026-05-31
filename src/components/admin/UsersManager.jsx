import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, ShieldCheck, ShieldOff, BadgeCheck, Ban as BanIcon, RotateCcw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BanDialog from "./BanDialog";

export default function UsersManager() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const { data: users = [], isLoading, isError } = useQuery({ queryKey: ["users"], queryFn: () => base44.entities.User.list("-created_date", 200), retry: false, meta: { silent: true } });
  const { data: bans = [] } = useQuery({ queryKey: ["bans"], queryFn: () => base44.entities.Ban.list("-created_date", 500), retry: false, meta: { silent: true } });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["bans"] });
  };

  const updateUser = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const banUser = useMutation({
    mutationFn: async ({ targetUser, reason, expiresAt }) => {
      const common = { reason: reason || "Banned by admin", banned_by: me?.email || "", expires_at: expiresAt || "", is_active: true };
      await base44.entities.User.update(targetUser.id, { disabled: true });
      await base44.entities.Ban.create({ ban_type: "email", value: String(targetUser.email || "").toLowerCase(), ...common });
      await base44.entities.Ban.create({ ban_type: "user", value: String(targetUser.id).toLowerCase(), ...common });
      // Best-effort IP ban from the user's most recent forum post.
      const recent = await base44.entities.ForumPost.filter({ user_email: targetUser.email }, "-created_date", 1);
      const ip = recent?.[0]?.ip_address;
      if (ip) await base44.entities.Ban.create({ ban_type: "ip", value: String(ip).toLowerCase(), ...common });
    },
    onSuccess: () => { refresh(); toast({ title: "User banned", description: "Login disabled and ban rules created." }); },
  });

  const unbanUser = useMutation({
    mutationFn: async (targetUser) => {
      await base44.entities.User.update(targetUser.id, { disabled: false });
      const related = bans.filter((b) => b.is_active && ((b.ban_type === "email" && b.value === String(targetUser.email || "").toLowerCase()) || (b.ban_type === "user" && b.value === String(targetUser.id).toLowerCase())));
      for (const ban of related) await base44.entities.Ban.update(ban.id, { is_active: false });
    },
    onSuccess: () => { refresh(); toast({ title: "User reinstated", description: "Login restored and email/account bans lifted." }); },
  });

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && (u.role || "user") !== roleFilter) return false;
      return `${u.full_name || ""} ${u.email || ""}`.toLowerCase().includes(term);
    });
  }, [users, search, roleFilter]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading users…</p>;

  if (isError) {
    return (
      <section className="border border-border bg-card p-6">
        <h2 className="font-display text-3xl uppercase">Users</h2>
        <p className="mt-4 border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
          User management needs the <span className="font-mono">User</span> entity to allow admin read/update. Deploy the updated <span className="font-mono">User</span> permissions (RLS) and refresh to manage roles, access and bans here.
        </p>
      </section>
    );
  }

  return (
    <section className="border border-border bg-card p-6">
      <h2 className="font-display text-3xl uppercase">Users</h2>
      <p className="mt-2 text-sm text-muted-foreground">Manage roles, access and bans. You can't change your own role or ban yourself.</p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-none pl-10" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="rounded-none sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
            <SelectItem value="user">Users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 grid gap-3">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No users match your filter.</p>}
        {filtered.map((u) => {
          const isSelf = u.id === me?.id;
          return (
            <div key={u.id} className="grid gap-4 border border-border p-4 lg:grid-cols-[1fr_160px_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{u.full_name || "Unnamed"}</p>
                  {u.is_verified && <BadgeCheck className="h-4 w-4 text-emerald-400" title="Email verified" />}
                  {u.disabled && <Badge variant="outline" className="rounded-none border-destructive/40 text-destructive">Disabled</Badge>}
                  {isSelf && <Badge variant="outline" className="rounded-none">You</Badge>}
                </div>
                <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Joined {u.created_date ? format(new Date(u.created_date), "dd MMM yyyy") : "—"}</p>
              </div>

              <Select value={u.role || "user"} disabled={isSelf || updateUser.isPending} onValueChange={(role) => updateUser.mutate({ id: u.id, data: { role } })}>
                <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                {u.disabled ? (
                  <Button variant="outline" size="sm" className="rounded-none" disabled={isSelf || unbanUser.isPending} onClick={() => unbanUser.mutate(u)}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Reinstate
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" className="rounded-none" disabled={isSelf || updateUser.isPending} onClick={() => updateUser.mutate({ id: u.id, data: { disabled: true } })}>
                      {u.role === "admin" ? <ShieldOff className="mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />} Disable
                    </Button>
                    {!isSelf && (
                      <BanDialog
                        title={`Ban ${u.full_name || u.email}`}
                        description="Disables login and blocks this email, account and last-known IP from posting."
                        confirmLabel="Ban user"
                        pending={banUser.isPending}
                        onConfirm={({ reason, expiresAt }) => banUser.mutateAsync({ targetUser: u, reason, expiresAt })}
                        trigger={<Button variant="destructive" size="sm" className="rounded-none"><BanIcon className="mr-2 h-4 w-4" /> Ban</Button>}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
