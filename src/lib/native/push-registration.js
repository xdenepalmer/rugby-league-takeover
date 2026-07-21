/**
 * Bridges the pure push plumbing (push.js) to the data layer: persists native
 * push tokens into user_push_tokens (see supabase/migrations/0009) and
 * disables them when the user turns push off. Kept separate from push.js so
 * that module stays free of auth/data-layer concerns. The base44 client is
 * imported lazily so the token-reconciliation logic below can be unit-tested
 * without booting the Supabase runtime.
 */
import { getPlatform } from "./native-env.js";

/**
 * Decide whether a platform token is new (insert) or already known (update +
 * re-enable), given the rows currently matching that token. Pure so tests can
 * exercise it without the data layer. The unique index on `token` means there
 * is at most one match.
 */
export function resolveTokenUpsert(existingRows, { userId, token, platform, nowIso }) {
  const payload = {
    user_id: userId,
    token,
    platform,
    enabled: true,
    last_seen_date: nowIso,
  };
  const existing = Array.isArray(existingRows) ? existingRows[0] : null;
  if (existing?.id) {
    return { action: "update", id: existing.id, payload };
  }
  return { action: "create", payload };
}

/**
 * Store (or refresh) the device token for the signed-in user. Safe to call
 * repeatedly — the same physical token reconciles to a single row.
 */
export async function persistPushToken(userId, token) {
  if (!userId || !token) return;
  const { base44 } = await import("@/api/base44Client");
  const existing = await base44.entities.UserPushToken.filter({ token });
  const { action, id, payload } = resolveTokenUpsert(existing, {
    userId,
    token,
    platform: getPlatform(),
    nowIso: new Date().toISOString(),
  });
  if (action === "update") {
    await base44.entities.UserPushToken.update(id, payload);
  } else {
    await base44.entities.UserPushToken.create(payload);
  }
}

/**
 * Turn push off server-side. Mobile platforms do not provide a reliable way to
 * revoke OS permission from inside the app, so we instead disable the user's
 * stored tokens; the future send pipeline only targets enabled rows.
 */
export async function disableUserPushTokens(userId) {
  if (!userId) return;
  const { base44 } = await import("@/api/base44Client");
  const rows = await base44.entities.UserPushToken.filter({ user_id: userId, enabled: true });
  await Promise.all(
    (rows || []).map((row) => base44.entities.UserPushToken.update(row.id, { enabled: false }))
  );
}
