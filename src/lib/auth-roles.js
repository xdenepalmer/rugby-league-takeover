const normalizeRole = (value) => String(value ?? "").trim().toLowerCase();

const roleValues = (user) => [
  user.role,
  user.app_role,
  ...(Array.isArray(user.roles) ? user.roles : []),
  ...(Array.isArray(user.permissions) ? user.permissions : []),
];

const hasRole = (user, role) => roleValues(user).some((value) => normalizeRole(value) === role);

export function hasAdminRole(user) {
  if (!user) return false;
  if (user.is_admin === true || user.isAdmin === true) return true;

  return hasRole(user, "admin");
}

export function hasModeratorRole(user) {
  if (!user) return false;
  if (hasAdminRole(user)) return true; // admins inherit moderator powers

  return hasRole(user, "moderator");
}
