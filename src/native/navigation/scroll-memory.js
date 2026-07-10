/**
 * Per-path window-scroll memory for the native shell. The app keeps the
 * document-scroll model the web uses (pages scroll the window), so restoring
 * context on tab switches is a matter of remembering window.scrollY per
 * location and re-applying it before paint. Module-scope store: survives
 * route changes within a session; 003D persists it across launches.
 */
const positions = new Map();
const MAX_ENTRIES = 80;

export function saveScrollPosition(key, y) {
  if (typeof key !== "string" || typeof y !== "number" || Number.isNaN(y)) return;
  if (!positions.has(key) && positions.size >= MAX_ENTRIES) {
    const oldest = positions.keys().next().value;
    positions.delete(oldest);
  }
  positions.set(key, y);
}

export function getScrollPosition(key) {
  return positions.has(key) ? positions.get(key) : null;
}

export function clearScrollMemory() {
  positions.clear();
}
