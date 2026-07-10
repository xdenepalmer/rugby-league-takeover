/**
 * Per-path window-scroll memory for the native shell. The app keeps the
 * document-scroll model the web uses (pages scroll the window), so
 * restoring context on tab switches is a matter of remembering
 * window.scrollY per location and re-applying it before paint.
 * Session-persisted (best-effort) so positions survive WebView reloads
 * within a session; a fresh cold launch intentionally starts clean.
 */
export const SCROLL_MEMORY_STORAGE_KEY = "rlt_native_scroll_memory";
const MAX_ENTRIES = 80;

const positions = new Map(loadEntries());
let saveTimer = null;

function loadEntries(storage) {
  try {
    const raw = (storage || globalThis.sessionStorage)?.getItem(SCROLL_MEMORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((e) => Array.isArray(e) && typeof e[0] === "string" && typeof e[1] === "number") : [];
  } catch {
    return [];
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      globalThis.sessionStorage?.setItem(SCROLL_MEMORY_STORAGE_KEY, JSON.stringify([...positions.entries()]));
    } catch {
      // best-effort
    }
  }, 500);
}

export function saveScrollPosition(key, y) {
  if (typeof key !== "string" || typeof y !== "number" || Number.isNaN(y)) return;
  if (!positions.has(key) && positions.size >= MAX_ENTRIES) {
    const oldest = positions.keys().next().value;
    positions.delete(oldest);
  }
  positions.set(key, y);
  scheduleSave();
}

export function getScrollPosition(key) {
  return positions.has(key) ? positions.get(key) : null;
}

export function clearScrollMemory() {
  positions.clear();
  try {
    globalThis.sessionStorage?.removeItem(SCROLL_MEMORY_STORAGE_KEY);
  } catch {
    // best-effort
  }
}
