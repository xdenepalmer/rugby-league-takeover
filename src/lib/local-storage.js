// JSON-safe localStorage access. Reads never throw (private mode, quota,
// corrupted value) — they fall back to the caller's default instead.
export function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the UI keeps its in-memory copy */
  }
}
