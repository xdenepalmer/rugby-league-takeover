import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ShieldCheck, ShieldOff, BadgeCheck, Ban as BanIcon, RotateCcw,
  Users, Crown, Shield, UserX, CheckCircle2, Calendar, ChevronDown,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BanDialog from "./BanDialog";

/* ─── Avatar gradient palettes ────────────────────────────── */
const avatarGradients = [
  "from-indigo-500 to-violet-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
  "from-lime-500 to-green-600",
  "from-sky-500 to-indigo-600",
];

function getAvatarGradient(id) {
  const hash = String(id).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return avatarGradients[hash % avatarGradients.length];
}

/* ─── Stat badge ──────────────────────────────────────────── */
function StatBadge({ icon: Icon, label, value, color = "text-primary", bg = "bg-primary/5", border = "border-primary/10" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${bg} border ${border} text-[10px] font-bold uppercase tracking-wider ${color}`}>
      <Icon className="h-3 w-3" />
      {value} {label}
    </span>
  );
}

/* ─── Single user card ────────────────────────────────────── */
function UserCard({ u, isSelf, index, updateUser, banUser, unbanUser }) {
  const initial = (u.full_name || u.email || "?").charAt(0).toUpperCase();
  const gradient = getAvatarGradient(u.id);
  const role = u.role || "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: "easeOut" }}
      layout
      className="group relative overflow-hidden border border-border bg-card/60 cmd-glass hover:border-indigo-500/20 transition-all duration-300"
    >
      {/* Top accent — indigo for admin, violet for moderator, subtle for user */}
      <div className={`h-[2px] w-full ${role === "admin"
        ? "bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500"
        : role === "moderator"
          ? "bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500"
          : "bg-gradient-to-r from-border/60 via-muted-foreground/20 to-border/60"
      }`} />

      {/* Hover scan line */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent cmd-scan-line" />
      </div>

      <div className="p-5">
        {/* ── Header: Avatar + Name + Badges ── */}
        <div className="flex items-start gap-4">
          {/* Avatar circle */}
          <div className={`relative shrink-0 h-12 w-12 bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
            <span className="text-lg font-bold text-white leading-none">{initial}</span>
            {u.disabled && (
              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-destructive border-2 border-card flex items-center justify-center rounded-full">
                <UserX className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg uppercase leading-tight truncate">
                {u.full_name || "Unnamed"}
              </h3>
              {u.is_verified && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
                  <BadgeCheck className="h-3 w-3" /> Verified
                </span>
              )}
              {isSelf && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-[8px] font-bold uppercase tracking-wider text-indigo-400">
                  You
                </span>
              )}
            </div>

            <p className="mt-0.5 truncate text-sm text-muted-foreground font-mono">{u.email}</p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {/* Role badge */}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider border ${
                role === "admin"
                  ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
                  : role === "moderator"
                    ? "text-violet-400 bg-violet-500/10 border-violet-500/30"
                    : "text-muted-foreground bg-muted/20 border-border/40"
              }`}>
                {role === "admin" ? <Crown className="h-2.5 w-2.5" /> : role === "moderator" ? <Shield className="h-2.5 w-2.5" /> : <Users className="h-2.5 w-2.5" />}
                {role}
              </span>

              {/* Disabled / Banned indicator */}
              {u.disabled && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 border border-destructive/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive cmd-blink" />
                  Disabled
                </span>
              )}

              {/* Join date */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono text-muted-foreground bg-muted/20 border border-border/40">
                <Calendar className="h-2.5 w-2.5" />
                {u.created_date ? format(new Date(u.created_date), "dd MMM yyyy") : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Action bar ── */}
        <div className="mt-4 flex flex-col gap-2 border-t border-border/30 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={role} disabled={isSelf || updateUser.isPending} onValueChange={(newRole) => updateUser.mutate({ id: u.id, data: { role: newRole } })}>
            <SelectTrigger className="h-11 w-full rounded-none text-xs sm:w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="moderator">Moderator</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>

          <div className="hidden flex-1 sm:block" />

          {u.disabled ? (
            <Button
              variant="outline"
              size="mobile"
              className="w-full rounded-none text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 sm:w-auto"
              disabled={isSelf || unbanUser.isPending}
              onClick={() => unbanUser.mutate(u)}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reinstate
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="mobile"
                className="w-full rounded-none text-xs sm:w-auto"
                disabled={isSelf || updateUser.isPending}
                onClick={() => updateUser.mutate({ id: u.id, data: { disabled: true } })}
              >
                {role === "admin" ? <ShieldOff className="mr-1.5 h-3.5 w-3.5" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
                Disable
              </Button>
              {!isSelf && (
                <BanDialog
                  title={`Ban ${u.full_name || u.email}`}
                  description="Disables login and blocks this email, account and last-known IP from posting."
                  confirmLabel="Ban user"
                  pending={banUser.isPending}
                  onConfirm={({ reason, expiresAt }) => banUser.mutateAsync({ targetUser: u, reason, expiresAt })}
                  trigger={
                    <Button variant="destructive" size="mobile" className="w-full rounded-none text-xs sm:w-auto">
                      <BanIcon className="mr-1.5 h-3.5 w-3.5" /> Ban
                    </Button>
                  }
                />
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main UsersManager ───────────────────────────────────── */
export default function UsersManager() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(true);

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await base44.functions.invoke("adminUsers", { action: "list" });
      return response?.data?.users || [];
    },
    retry: false,
    meta: { silent: true },
  });
  const { data: bans = [] } = useQuery({ queryKey: ["bans"], queryFn: () => base44.entities.Ban.list("-created_date", 500), retry: false, meta: { silent: true } });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["bans"] });
  };

  const updateUser = useMutation({
    mutationFn: ({ id, data }) => base44.functions.invoke("adminUsers", { action: "update", userId: id, data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const banUser = useMutation({
    mutationFn: async ({ targetUser, reason, expiresAt }) => {
      const common = { reason: reason || "Banned by admin", banned_by: me?.email || "", expires_at: expiresAt || "", is_active: true };
      await base44.functions.invoke("adminUsers", { action: "update", userId: targetUser.id, data: { disabled: true } });
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
      await base44.functions.invoke("adminUsers", { action: "update", userId: targetUser.id, data: { disabled: false } });
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

  /* Stats */
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const moderatorCount = users.filter((u) => u.role === "moderator").length;
  const disabledCount = users.filter((u) => u.disabled).length;
  const verifiedCount = users.filter((u) => u.is_verified).length;

  if (isLoading) {
    return (
      <section className="border border-border bg-card/60 cmd-glass overflow-hidden">
        <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 bg-[length:200%_100%] animate-[cmd-data-stream_3s_linear_infinite]" />
        <div className="p-6 flex items-center gap-3">
          <div className="h-5 w-5 border-2 border-indigo-500/40 border-t-indigo-400 rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading users…</p>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="border border-border bg-card/60 cmd-glass overflow-hidden">
        <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500" />
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-indigo-400" />
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-indigo-400 font-mono">User Management</p>
          </div>
          <h2 className="font-display text-3xl uppercase">Users</h2>
          <p className="mt-4 border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
            User management runs through the <span className="font-mono">adminUsers</span> backend function. Deploy/publish it, then refresh to manage roles, access and bans here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      {/* ── Section Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden border border-border bg-card/60 cmd-glass"
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 bg-[length:200%_100%] animate-[cmd-data-stream_3s_linear_infinite]" />
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 border border-indigo-500/30 bg-indigo-500/10">
              <Users className="h-3.5 w-3.5 text-indigo-400" />
            </div>
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-indigo-400 font-mono">
              User Management
            </p>
            <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-500/5 border border-indigo-500/10">
              <span className="h-1 w-1 rounded-full bg-indigo-400 cmd-blink" />
              <span className="text-[7px] font-bold uppercase tracking-wider text-indigo-400/70">Active</span>
            </span>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl md:text-4xl uppercase leading-none tracking-wide">Users</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Manage roles, access and bans. You can't change your own role or ban yourself.
              </p>
            </div>

            {/* Stats badges */}
            <div className="flex flex-wrap items-center gap-2">
              <StatBadge icon={Users} label="Total" value={totalUsers} color="text-indigo-400" bg="bg-indigo-500/5" border="border-indigo-500/10" />
              <StatBadge icon={Crown} label="Admins" value={adminCount} color="text-violet-400" bg="bg-violet-500/5" border="border-violet-500/10" />
              <StatBadge icon={Shield} label="Mods" value={moderatorCount} color="text-purple-400" bg="bg-purple-500/5" border="border-purple-500/10" />
              <StatBadge icon={CheckCircle2} label="Verified" value={verifiedCount} color="text-emerald-400" bg="bg-emerald-500/5" border="border-emerald-500/10" />
              {disabledCount > 0 && (
                <StatBadge icon={UserX} label="Disabled" value={disabledCount} color="text-destructive" bg="bg-destructive/5" border="border-destructive/10" />
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Search & Filters ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.35 }}
        className="overflow-hidden border border-border bg-card/60 cmd-glass"
      >
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/10 transition-colors group/toggle"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 border border-border/50 bg-muted/20">
              <Search className="h-3.5 w-3.5 text-indigo-400" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">Search & Filter</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {filtered.length} of {totalUsers} users shown
              </p>
            </div>
          </div>
          <motion.div animate={{ rotate: filtersOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronDown className="h-4 w-4 text-muted-foreground group-hover/toggle:text-foreground transition-colors" />
          </motion.div>
        </button>

        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="border-t border-border/50 px-5 py-4 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-11 rounded-none pl-10 bg-background/40 border-border/60"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-11 rounded-none sm:w-44 bg-background/40 border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="admin">Admins</SelectItem>
                    <SelectItem value="moderator">Moderators</SelectItem>
                    <SelectItem value="user">Users</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── User Cards ── */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="border border-border/60 bg-card/30 cmd-glass py-16 flex flex-col items-center justify-center text-center"
        >
          <div className="p-4 border border-border/30 bg-muted/10 mb-4">
            <Users className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <p className="text-sm font-bold text-muted-foreground mb-1">No users match your filter</p>
          <p className="text-xs text-muted-foreground/60 max-w-xs">
            Try adjusting your search term or role filter above.
          </p>
        </motion.div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <AnimatePresence>
            {filtered.map((u, i) => (
              <UserCard
                key={u.id}
                u={u}
                isSelf={u.id === me?.id}
                index={i}
                updateUser={updateUser}
                banUser={banUser}
                unbanUser={unbanUser}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
