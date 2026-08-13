const VISITOR_KEY_STORAGE = "rlt_visitor_key";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const isVisitorKey = (value) => typeof value === "string" && UUID_RE.test(value);

const mint = () => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    // Older Safari: build a v4 UUID from getRandomValues.
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {
    /* fall through */
  }
  return null;
};

/**
 * A stable, meaningless identifier for this browser, used only so the server can
 * tell a returning device from a new one when counting unique visitors.
 *
 * It is random — not derived from an IP address, a fingerprint, or anything
 * about the person — so the stored keys carry no personal data. Clearing site
 * data mints a new one, which means unique visitors is an upper-bound estimate
 * of people, not an exact headcount. That is the honest trade for not
 * fingerprinting anybody.
 *
 * Returns null when storage is unavailable (private mode, storage blocked). The
 * caller still records the view; it just cannot contribute to the unique count,
 * which is better than minting a throwaway key on every page load and inflating
 * the figure.
 */
export function getVisitorKey() {
  let existing = null;
  try {
    existing = localStorage.getItem(VISITOR_KEY_STORAGE);
  } catch {
    return null;
  }
  if (isVisitorKey(existing)) return existing;

  const minted = mint();
  if (!minted) return null;
  try {
    localStorage.setItem(VISITOR_KEY_STORAGE, minted);
  } catch {
    return null;
  }
  return minted;
}

// Admin traffic is the team checking their own site; counting it would drown the
// real numbers, so these paths never record a view.
export const isUncountedPath = (pathname) =>
  typeof pathname === "string" && /^\/admin(\/|$)/.test(pathname);
