// ── Safe localStorage with corruption detection ─────────────────────
export const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    const parsed = JSON.parse(raw);
    if (typeof fallback === 'object' && !Array.isArray(fallback) && (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null)) {
      console.warn(`[RLT] Corrupted data for ${key}, resetting`);
      localStorage.removeItem(key);
      return fallback;
    }
    return parsed;
  } catch (e) {
    console.warn(`[RLT] Failed to parse ${key}, resetting:`, e);
    try { localStorage.removeItem(key); } catch { /* noop */ }
    return fallback;
  }
};
export const writeJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
};
