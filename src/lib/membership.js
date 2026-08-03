// RLT membership — shared client logic.
//
// Membership is a TIME-BOUNDED entitlement: the expiry timestamp is the truth
// and is evaluated whenever it's read. There is no nightly job flipping people
// to expired, so nothing here may cache an "is member" answer.

export const MEMBERSHIP_TERM_MONTHS = 12;

// Show the renewal nudge inside the last stretch of the term.
export const RENEWAL_WINDOW_DAYS = 30;

export function membershipExpiry(user) {
  const raw = user?.membership_expires_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isActiveMember(user, now = Date.now()) {
  const expiry = membershipExpiry(user);
  return !!expiry && expiry.getTime() > now;
}

// A lapsed member is someone who HAD a membership — worth a different message
// from someone who never joined.
export function hasLapsed(user, now = Date.now()) {
  const expiry = membershipExpiry(user);
  return !!expiry && expiry.getTime() <= now;
}

export function daysRemaining(user, now = Date.now()) {
  const expiry = membershipExpiry(user);
  if (!expiry) return null;
  return Math.ceil((expiry.getTime() - now) / 86400000);
}

export function isExpiringSoon(user, now = Date.now()) {
  const days = daysRemaining(user, now);
  return days != null && days > 0 && days <= RENEWAL_WINDOW_DAYS;
}

export function formatMembershipDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

// One sentence describing where the member stands, for the card and Account.
export function membershipStatusLine(user, now = Date.now()) {
  if (isActiveMember(user, now)) {
    const days = daysRemaining(user, now);
    if (days <= RENEWAL_WINDOW_DAYS) {
      return `Expires in ${days} day${days === 1 ? "" : "s"} — renew to keep your benefits`;
    }
    return `Valid until ${formatMembershipDate(user.membership_expires_at)}`;
  }
  if (hasLapsed(user, now)) {
    return `Expired ${formatMembershipDate(user.membership_expires_at)} — renew to reactivate`;
  }
  return "Not a member yet";
}
