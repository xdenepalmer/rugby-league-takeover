import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Users,
  Crown,
  Shield,
  BadgeCheck,
  UserX,
  Calendar,
  Ban as BanIcon,
  RotateCcw,
  ShieldOff,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import AdminConfirmSheet from "@/components/admin/shared/AdminConfirmSheet";
import BanDialog from "@/components/admin/BanDialog";
import PullToRefresh from "@/components/PullToRefresh";
import { emitHaptic } from "@/lib/native/haptic-events";
import { useWindowedList } from "@/hooks/use-windowed-list";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  USER_ROLES,
  USER_ROLE_FILTERS,
  userRoleMeta,
  filterUsers,
  userCounts,
  userRoleFilterCounts,
  buildBanCommonFields,
  buildBanRecords,
  relatedActiveBans,
  isSelfUser,
} from "./users-helpers.js";

/*
 * Native User Accounts workflow — /admin/people/users. Every read and write
 * goes through the SAME authority the web UsersManager uses: the `adminUsers`
 * edge function for user reads/updates (never the User entity directly) and
 * the Ban entity for ban records. Payloads are field-for-field identical.
 * The web manager dispatches no rlt_admin_log events for user actions, so
 * (strict parity) neither does this workflow.
 */

// Sensitive account roster: fetched fresh via the edge function; the
// ["users"]/["bans"] keys are not on the query-persistence allowlist.
const useUsers = () =>
  useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await base44.functions.invoke("adminUsers", { action: "list" });
      return response?.data?.users || [];
    },
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

const useBans = () =>
  useQuery({
    queryKey: ["bans"],
    queryFn: () => base44.entities.Ban.list("-created_date", 500),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

const formatDate = (value) => {
  try {
    return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
};

function RoleBadge({ role }) {
  const meta = userRoleMeta(role);
  const Icon = role === "admin" ? Crown : role === "moderator" ? Shield : Users;
  return (
    <span className={`flex items-center gap-1 border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${meta.tone}`}>
      <Icon className="h-3 w-3" aria-hidden="true" /> {meta.label}
    </span>
  );
}

function StatusFlags({ user }) {
  return (
    <>
      {user.is_verified && (
        <span className="flex items-center gap-1 border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-300">
          <BadgeCheck className="h-3 w-3" aria-hidden="true" /> Verified
        </span>
      )}
      {user.disabled && (
        <span className="flex items-center gap-1 border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-red-300">
          <UserX className="h-3 w-3" aria-hidden="true" /> Disabled
        </span>
      )}
    </>
  );
}

/** The web isError note: users run through the adminUsers backend function. */
function UsersUnavailable() {
  return (
    <div className="border border-amber-500/40 bg-amber-500/10 p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Users unavailable</p>
      <p className="pt-1 text-xs leading-snug text-amber-200/90">
        User management runs through the <span className="font-mono">adminUsers</span> backend function.
        Deploy/publish it, then pull to refresh to manage roles, access and bans here.
      </p>
    </div>
  );
}

/** Native user list — /admin/people/users */
export default function NativeUsersList() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const { data: users = [], isLoading, isError } = useUsers();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");

  const visible = useMemo(() => filterUsers(users, { query, role }), [users, query, role]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, { initial: 20, step: 20, restoreKey: "admin-users" });
  const roleCounts = useMemo(() => userRoleFilterCounts(users), [users]);
  const stats = useMemo(() => userCounts(users), [users]);

  return (
    <div className="pb-8">
      <NativeTopBar title="User Accounts" fallback="/admin/people" />
      <PullToRefresh queryKeys={[["users"], ["bans"]]}>
        <div className="px-4 pt-3">
          {isError ? (
            <UsersUnavailable />
          ) : (
            <>
              <div className="flex items-center gap-2 border border-border bg-card/50 px-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or email"
                  aria-label="Search users"
                  className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </div>
              <div className="ios-scroll flex gap-2 overflow-x-auto py-2">
                {USER_ROLE_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={role === f.key}
                    onClick={() => {
                      emitHaptic("tab.select");
                      setRole(f.key);
                    }}
                    className={`ios-pressable min-h-9 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                      role === f.key ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
                    }`}
                  >
                    {f.label} ({roleCounts[f.key] ?? 0})
                  </button>
                ))}
              </div>
              <p className="pb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {stats.total} total · {stats.verified} verified{stats.disabled > 0 ? ` · ${stats.disabled} disabled` : ""}
              </p>
            </>
          )}
        </div>

        {isError ? null : isLoading && users.length === 0 ? (
          <div className="space-y-2 px-4 pt-1">
            <NativeSkeleton className="h-16 w-full" />
            <NativeSkeleton className="h-16 w-full" />
            <NativeSkeleton className="h-16 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState icon={Users} title="No users here" description="Nothing matches this search or role filter." />
          </div>
        ) : (
          windowed.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                emitHaptic("tab.select");
                navigate(`/admin/people/users/${encodeURIComponent(u.id)}`);
              }}
              className="ios-pressable flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-bold">{u.full_name || "Unnamed"}</span>
                  {isSelfUser(u, me) && (
                    <span className="border border-indigo-500/40 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-indigo-300">You</span>
                  )}
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">{u.email}</p>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <RoleBadge role={u.role || "user"} />
                  <StatusFlags user={u} />
                </div>
              </div>
            </button>
          ))
        )}
        {!isError && !done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
      </PullToRefresh>
    </div>
  );
}

/** Native user detail: role, access and bans — /admin/people/users/:userId */
export function NativeUserDetail() {
  const { userId } = useParams();
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const { data: users = [], isLoading, isError } = useUsers();
  const { data: bans = [] } = useBans();
  const u = useMemo(() => users.find((x) => String(x.id) === String(userId)) || null, [users, userId]);
  const isSelf = isSelfUser(u, me);
  const [confirm, setConfirm] = useState(null); // { kind: "role"|"disable"|"reinstate", role? }

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["bans"] });
  };

  // Web parity (UsersManager.updateUser): role/access changes go through the
  // adminUsers edge function — server-side authority, never the User entity.
  const updateUser = useMutation({
    mutationFn: ({ id, data }) => base44.functions.invoke("adminUsers", { action: "update", userId: id, data }),
    onSuccess: () => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "User update failed", description: error.message, variant: "destructive" });
    },
  });

  // Web parity (UsersManager.banUser): disable login, then create email +
  // user ban records, then a best-effort IP ban from the most recent forum
  // post — same fields, same lowercasing, same order.
  const banUser = useMutation({
    mutationFn: async ({ targetUser, reason, expiresAt }) => {
      const common = buildBanCommonFields({ actorEmail: me?.email, reason, expiresAt });
      await base44.functions.invoke("adminUsers", { action: "update", userId: targetUser.id, data: { disabled: true } });
      for (const record of buildBanRecords(targetUser)) {
        await base44.entities.Ban.create({ ...record, ...common });
      }
      const recent = await base44.entities.ForumPost.filter({ user_email: targetUser.email }, "-created_date", 1);
      const ip = recent?.[0]?.ip_address;
      if (ip) await base44.entities.Ban.create({ ban_type: "ip", value: String(ip).toLowerCase(), ...common });
    },
    onSuccess: () => {
      emitHaptic("mutation.warning");
      refresh();
      toast({ title: "User banned", description: "Login disabled and ban rules created." });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Ban failed", description: error.message, variant: "destructive" });
    },
  });

  // Web parity (UsersManager.unbanUser): re-enable login and deactivate the
  // matching active email/user bans. IP bans stay, exactly like the web.
  const unbanUser = useMutation({
    mutationFn: async (targetUser) => {
      await base44.functions.invoke("adminUsers", { action: "update", userId: targetUser.id, data: { disabled: false } });
      const related = relatedActiveBans(bans, targetUser);
      await Promise.allSettled(related.map((ban) => base44.entities.Ban.update(ban.id, { is_active: false })));
    },
    onSuccess: () => {
      emitHaptic("save.success");
      refresh();
      toast({ title: "User reinstated", description: "Login restored and email/account bans lifted." });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Reinstate failed", description: error.message, variant: "destructive" });
    },
  });

  const runConfirm = async () => {
    if (!confirm || !u) return;
    try {
      if (confirm.kind === "role") await updateUser.mutateAsync({ id: u.id, data: { role: confirm.role } });
      if (confirm.kind === "disable") await updateUser.mutateAsync({ id: u.id, data: { disabled: true } });
      if (confirm.kind === "reinstate") await unbanUser.mutateAsync(u);
    } finally {
      setConfirm(null);
    }
  };

  if (!u) {
    return (
      <div>
        <NativeTopBar title="User" fallback="/admin/people/users" />
        <div className="px-4 pt-4">
          {isError ? (
            <UsersUnavailable />
          ) : isLoading ? (
            <NativeSkeleton className="h-40 w-full" />
          ) : (
            <NativeEmptyState icon={Users} title="User not found" description="This account may have been removed, or you're offline." />
          )}
        </div>
      </div>
    );
  }

  const role = u.role || "user";
  const pending = updateUser.isPending || banUser.isPending || unbanUser.isPending;

  return (
    <div className="pb-10">
      <NativeTopBar title={u.full_name || "User"} fallback="/admin/people/users" />
      <div className="space-y-4 px-4 pt-3">
        {/* Identity */}
        <div className="border border-border/60 bg-card/50 p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Account</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <h1 className="font-display text-lg font-bold uppercase tracking-wide">{u.full_name || "Unnamed"}</h1>
            {isSelf && (
              <span className="border border-indigo-500/40 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-indigo-300">You</span>
            )}
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">{u.email}</p>
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            <RoleBadge role={role} />
            <StatusFlags user={u} />
            <span className="flex items-center gap-1 border border-border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
              <Calendar className="h-3 w-3" aria-hidden="true" /> {u.created_date ? formatDate(u.created_date) : "—"}
            </span>
          </div>
          {isSelf && (
            <p className="pt-2 text-[10px] uppercase tracking-widest text-amber-300">
              You can't change your own role or ban yourself
            </p>
          )}
        </div>

        {/* Role — same { role } payload the web Select writes */}
        <div className="border border-border/60 bg-card/50 p-3">
          <p className="pb-2 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Role</p>
          <div className="grid grid-cols-3 gap-2">
            {USER_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={role === r}
                disabled={isSelf || pending || role === r}
                onClick={() => {
                  emitHaptic("action.primary");
                  setConfirm({ kind: "role", role: r });
                }}
                className={`ios-pressable flex min-h-11 items-center justify-center border text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 ${
                  role === r ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
                }`}
              >
                {userRoleMeta(r).label}
              </button>
            ))}
          </div>
        </div>

        {/* Access */}
        <div className="border border-border/60 bg-card/50 p-3">
          <p className="pb-2 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Access</p>
          {u.disabled ? (
            <button
              type="button"
              disabled={isSelf || pending}
              onClick={() => {
                emitHaptic("action.primary");
                setConfirm({ kind: "reinstate" });
              }}
              className="ios-pressable flex min-h-11 w-full items-center justify-center gap-1.5 border border-emerald-500/50 bg-emerald-500/10 text-xs font-bold uppercase tracking-widest text-emerald-300 disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reinstate
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isSelf || pending}
                onClick={() => {
                  emitHaptic("mutation.warning");
                  setConfirm({ kind: "disable" });
                }}
                className="ios-pressable flex min-h-11 items-center justify-center gap-1.5 border border-border text-xs font-bold uppercase tracking-widest disabled:opacity-40"
              >
                <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" /> Disable
              </button>
              {!isSelf && (
                <BanDialog
                  title={`Ban ${u.full_name || u.email}`}
                  description="Disables login and blocks this email, account and last-known IP from posting."
                  confirmLabel="Ban user"
                  pending={banUser.isPending}
                  onConfirm={({ reason, expiresAt }) => banUser.mutateAsync({ targetUser: u, reason, expiresAt })}
                  trigger={
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => emitHaptic("mutation.warning")}
                      className="ios-pressable flex min-h-11 items-center justify-center gap-1.5 border border-red-500/60 bg-red-500/15 text-xs font-bold uppercase tracking-widest text-red-300 disabled:opacity-40"
                    >
                      <BanIcon className="h-3.5 w-3.5" aria-hidden="true" /> Ban
                    </button>
                  }
                />
              )}
            </div>
          )}
        </div>
      </div>

      <AdminConfirmSheet
        open={!!confirm}
        title={
          confirm?.kind === "role"
            ? `Make ${u.full_name || u.email} a${confirm.role === "admin" ? "n" : ""} ${userRoleMeta(confirm.role).label.toLowerCase()}?`
            : confirm?.kind === "disable"
              ? `Disable ${u.full_name || u.email}?`
              : `Reinstate ${u.full_name || u.email}?`
        }
        description={
          confirm?.kind === "role"
            ? "Role changes apply immediately across the whole app."
            : confirm?.kind === "disable"
              ? "The account keeps its data but can no longer sign in."
              : "Login is restored and this account's email/account bans are lifted."
        }
        confirmLabel={confirm?.kind === "role" ? "Change role" : confirm?.kind === "disable" ? "Disable account" : "Reinstate"}
        variant={confirm?.kind === "disable" ? "destructive" : "default"}
        loading={pending}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
