const normalizeRole = (value) => String(value ?? "").trim().toLowerCase();

export function hasAdminRole(user) {
  if (!user) return false;
  if (user.is_admin === true || user.isAdmin === true) return true;

  const roleValues = [
    user.role,
    user.app_role,
    ...(Array.isArray(user.roles) ? user.roles : []),
    ...(Array.isArray(user.permissions) ? user.permissions : []),
  ];

  return roleValues.some((role) => normalizeRole(role) === "admin");
}
