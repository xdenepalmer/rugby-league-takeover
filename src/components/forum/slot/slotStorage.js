import { parseBadgeIds, SLOT_BADGES_KEY } from "@/lib/slot-badges";
import {
  VALID_BADGE_IDS,
  STORAGE_VERSION_KEY,
  CURRENT_STORAGE_VERSION,
  BADGE_WIN_TIMESTAMP_KEY,
  NEW_BADGE_WINDOW_MS,
  WIN_HISTORY_KEY,
  LAST_WIN_SPIN_KEY,
  MAX_HISTORY,
} from "./slotConstants";

/* ─── Safe localStorage helpers ─── */
export function safeGetItem(key, fallback = null) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : fallback;
  } catch {
    return fallback;
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch { /* quota exceeded or unavailable */ }
}

export function safeGetJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    // Corrupted JSON — clear it and return fallback
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return fallback;
  }
}

export function safeReadIds() {
  const raw = safeGetJSON(SLOT_BADGES_KEY, []);
  const ids = parseBadgeIds(raw);
  // Filter out IDs that don't exist in SLOT_BADGES (corruption recovery)
  const valid = ids.filter((id) => VALID_BADGE_IDS.has(id));
  if (valid.length !== ids.length) {
    // Had invalid entries — rewrite clean data
    safeSetItem(SLOT_BADGES_KEY, JSON.stringify(valid));
  }
  return valid;
}

export function migrateStorage() {
  try {
    const version = Number(safeGetItem(STORAGE_VERSION_KEY, "0"));
    if (version < CURRENT_STORAGE_VERSION) {
      // Re-validate badge IDs on migration
      const ids = safeReadIds();
      safeSetItem(SLOT_BADGES_KEY, JSON.stringify(ids));
      safeSetItem(STORAGE_VERSION_KEY, String(CURRENT_STORAGE_VERSION));
    }
  } catch { /* ignore */ }
}

export function safeGetNumber(key, fallback = 0) {
  const val = Number(safeGetItem(key, String(fallback)));
  return Number.isFinite(val) ? val : fallback;
}

export function getBadgeWinTimestamps() {
  return safeGetJSON(BADGE_WIN_TIMESTAMP_KEY, {});
}

export function setBadgeWinTimestamp(badgeId) {
  const ts = getBadgeWinTimestamps();
  ts[badgeId] = Date.now();
  safeSetItem(BADGE_WIN_TIMESTAMP_KEY, JSON.stringify(ts));
}

export function isBadgeNew(badgeId) {
  const ts = getBadgeWinTimestamps();
  const winTime = ts[badgeId];
  if (!winTime) return false;
  return Date.now() - winTime < NEW_BADGE_WINDOW_MS;
}

export function getWinHistory() {
  return safeGetJSON(WIN_HISTORY_KEY, []);
}
export function addWinHistory(badgeId) {
  const history = getWinHistory();
  history.unshift({ badge_id: badgeId, timestamp: Date.now() });
  safeSetItem(WIN_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}
export function getLastWinSpin() {
  return safeGetNumber(LAST_WIN_SPIN_KEY, 0);
}
export function setLastWinSpin(spinCount) {
  safeSetItem(LAST_WIN_SPIN_KEY, String(spinCount));
}
