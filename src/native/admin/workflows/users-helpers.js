/**
 * Pure logic for the native User Accounts workflow. Mirrors the web
 * UsersManager's rules — role filtering, search, stats, and the exact Ban
 * payload fields the web writes — so the native screens have payload parity
 * with the web panel. All access control stays server-side: every user write
 * goes through the `adminUsers` edge function, never the User entity.
 */

export const USER_ROLES = ["admin", "moderator", "user"];

export const USER_ROLE_FILTERS = [
  { key: "all", label: "All" },
  { key: "admin", label: "Admins" },
  { key: "moderator", label: "Mods" },
  { key: "user", label: "Users" },
];

export const USER_ROLE_META = {
  admin: { label: "Admin", tone: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300" },
  moderator: { label: "Moderator", tone: "border-violet-500/40 bg-violet-500/10 text-violet-300" },
  user: { label: "User", tone: "border-border bg-muted/20 text-muted-foreground" },
};

export const userRoleMeta = (role) => USER_ROLE_META[role] || USER_ROLE_META.user;

/** Web parity (UsersManager `filtered`): role filter treats a missing role
 *  as "user"; search matches the combined "full_name email" string. */
export function filterUsers(users, { query = "", role = "all" } = {}) {
  const term = query.toLowerCase();
  return (users || []).filter((u) => {
    if (role !== "all" && (u.role || "user") !== role) return false;
    return `${u.full_name || ""} ${u.email || ""}`.toLowerCase().includes(term);
  });
}

/** The same stat counts the web header badges show. */
export function userCounts(users) {
  const list = users || [];
  return {
    total: list.length,
    admin: list.filter((u) => u.role === "admin").length,
    moderator: list.filter((u) => u.role === "moderator").length,
    verified: list.filter((u) => u.is_verified).length,
    disabled: list.filter((u) => u.disabled).length,
  };
}

/** Per-role counts for the filter chips (missing role counts as "user"). */
export function userRoleFilterCounts(users) {
  return Object.fromEntries(
    USER_ROLE_FILTERS.map((f) => [f.key, filterUsers(users, { role: f.key }).length])
  );
}

/**
 * Exact common Ban fields the web banUser mutation spreads into every
 * Ban.create record (UsersManager `common`).
 */
export function buildBanCommonFields({ actorEmail, reason, expiresAt } = {}) {
  return {
    reason: reason || "Banned by admin",
    banned_by: actorEmail || "",
    expires_at: expiresAt || "",
    is_active: true,
  };
}

/**
 * The email + user ban records the web always creates for a banned account
 * (the best-effort IP record needs an async ForumPost lookup and is built at
 * the call site). Values are lowercased exactly like the web writes them.
 */
export function buildBanRecords(targetUser) {
  return [
    { ban_type: "email", value: String(targetUser?.email || "").toLowerCase() },
    { ban_type: "user", value: String(targetUser?.id).toLowerCase() },
  ];
}

/**
 * Web parity (UsersManager unbanUser): the active email/user bans that get
 * deactivated when an account is reinstated. IP bans are deliberately left
 * untouched — the web doesn't lift them either.
 */
export function relatedActiveBans(bans, targetUser) {
  const email = String(targetUser?.email || "").toLowerCase();
  const id = String(targetUser?.id).toLowerCase();
  return (bans || []).filter(
    (b) =>
      b.is_active &&
      ((b.ban_type === "email" && b.value === email) || (b.ban_type === "user" && b.value === id))
  );
}

/** You can't change your own role, disable yourself, or ban yourself. */
export function isSelfUser(user, me) {
  return !!user && !!me && user.id === me.id;
}
