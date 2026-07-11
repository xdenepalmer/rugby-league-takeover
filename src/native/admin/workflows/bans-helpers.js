/**
 * Pure logic for the native Bans workflow — mirrors the web BansManager's
 * rules exactly (status derivation, search, create/lift payloads and the
 * rlt_admin_log audit strings) so the native screens write payload-parity
 * mutations through the same Ban entity.
 */

/** Same ban-type set the web BansManager offers, with the same labels. */
export const BAN_TYPES = [
  { key: "ip", label: "IP Address", placeholder: "e.g. 192.168.1.1" },
  { key: "email", label: "Email", placeholder: "e.g. spammer@example.com" },
  { key: "user", label: "User ID", placeholder: "User ID" },
];

export const banTypeMeta = (banType) => BAN_TYPES.find((t) => t.key === banType) || BAN_TYPES[0];

/** Web parity (BansManager.isExpired): still-active bans past expires_at. */
export function isBanExpired(ban, now = Date.now()) {
  return !!(ban?.expires_at && new Date(ban.expires_at).getTime() <= now);
}

/**
 * The web card's status derivation: lifted (is_active false) wins, then
 * expired, otherwise active.
 */
export function banStatus(ban, now = Date.now()) {
  if (!ban?.is_active) return "lifted";
  if (isBanExpired(ban, now)) return "expired";
  return "active";
}

export const BAN_STATUS_META = {
  active: { label: "Active", tone: "border-red-500/40 bg-red-500/10 text-red-300" },
  expired: { label: "Expired", tone: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  lifted: { label: "Lifted", tone: "border-border bg-muted/20 text-muted-foreground" },
};

export const banStatusMeta = (status) => BAN_STATUS_META[status] || BAN_STATUS_META.active;

/** Status chips shown on the native list — the web's stat-badge groups. */
export const BAN_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "expired", label: "Expired" },
  { key: "lifted", label: "Lifted" },
];

/**
 * Search matches the web filter exactly — one lowercase haystack of
 * `value reason ban_type` — plus the native status chip.
 */
export function filterBans(bans, { query = "", status = "all" } = {}, now = Date.now()) {
  const term = String(query || "").toLowerCase();
  return (bans || []).filter((b) => {
    if (status !== "all" && banStatus(b, now) !== status) return false;
    return `${b.value || ""} ${b.reason || ""} ${b.ban_type || ""}`.toLowerCase().includes(term);
  });
}

/** Counts behind the chips — same buckets as the web StatBadges. */
export function banCounts(bans, now = Date.now()) {
  const list = bans || [];
  return {
    all: list.length,
    active: list.filter((b) => banStatus(b, now) === "active").length,
    expired: list.filter((b) => banStatus(b, now) === "expired").length,
    lifted: list.filter((b) => banStatus(b, now) === "lifted").length,
  };
}

/** Web rule: the Add Ban button only needs a non-empty value. */
export function canSubmitBan(value) {
  return !!String(value || "").trim();
}

/**
 * Exact Ban.create payload the web BansManager.addBan sends — value trimmed
 * and lowercased, reason defaulted to "Added by admin", banned_by from the
 * signed-in admin, is_active true. No expires_at: the web form doesn't set
 * one, so neither do we.
 */
export function buildCreateBanPayload({ banType, value, reason, actorEmail } = {}) {
  return {
    ban_type: banType,
    value: String(value || "").trim().toLowerCase(),
    reason: String(reason || "").trim() || "Added by admin",
    banned_by: actorEmail || "",
    is_active: true,
  };
}

/** Exact Ban.update payload the web liftBan sends. */
export function buildLiftBanPayload() {
  return { is_active: false };
}

/** The web addBan onSuccess audit string, built from the created payload. */
export function banCreateLogText(payload) {
  return `[BAN-ACTION] Blocklist target registered: ${payload.value} (Reason: ${payload.reason})`;
}

/** The web liftBan onSuccess audit string. */
export function banLiftLogText(banId) {
  return `[BAN-ACTION] Blocklist rules lifted for target ID: ${banId}`;
}
