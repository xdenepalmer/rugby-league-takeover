/**
 * Pure logic for the native Invites workflow. Mirrors the web
 * UserInviteManager exactly: ONE capability — invite a user by email with a
 * role — sent through base44.users.inviteUser(email, role), which invokes
 * the `inviteUser` edge function. The web manager reads no entities, uses no
 * query keys, dispatches no rlt_admin_log events and has no revoke path, so
 * the native workflow adds none of those either (payload parity: the edge
 * function receives the same { email, role } body from both surfaces).
 */

/** The web manager's <Select> options, byte-for-byte roles and copy intent. */
export const INVITE_ROLES = [
  { key: "admin", label: "Admin", detail: "Full access — admins can manage all settings" },
  { key: "user", label: "User", detail: "Limited access" },
];

/** Web parity: UserInviteManager's role state initialises to "admin". */
export const DEFAULT_INVITE_ROLE = "admin";

export function isValidInviteRole(role) {
  return INVITE_ROLES.some((r) => r.key === role);
}

export function inviteRoleMeta(role) {
  return INVITE_ROLES.find((r) => r.key === role) || INVITE_ROLES[0];
}

/**
 * Client-side email check before the confirm sheet. The web manager only
 * requires a non-empty value (the edge function is the real authority); we
 * add a minimal shape check so an obvious typo fails fast on device instead
 * of after a network round trip. Never looser than the web: empty still
 * blocks, and the trimmed value is what gets sent.
 */
export function validateInviteEmail(raw) {
  const email = String(raw || "").trim();
  if (!email) return { ok: false, email: null, error: "Enter the recipient's email address." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, email: null, error: "That doesn't look like a valid email address." };
  }
  return { ok: true, email, error: null };
}

/**
 * The exact arguments handed to base44.users.inviteUser — same trimmed email
 * and one of the two web roles (unknown values fall back to the web default).
 */
export function buildInviteArgs(rawEmail, role) {
  return {
    email: String(rawEmail || "").trim(),
    role: isValidInviteRole(role) ? role : DEFAULT_INVITE_ROLE,
  };
}

/** Web parity: the success banner reads `Invite sent to ${email}`. */
export function inviteSuccessMessage(email) {
  return `Invite sent to ${email}`;
}

/** Web parity: the error banner shows error.message with the same fallback. */
export function inviteErrorMessage(error) {
  return error?.message || "Invite could not be sent";
}
