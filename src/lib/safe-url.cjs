const SAFE_ABSOLUTE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Restrict user-authored links to browser-safe destinations.
 * Returns an empty string for executable, protocol-relative, malformed, or
 * otherwise unsupported URLs so callers can render plain text instead.
 */
function safeUserHref(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.includes("\\")) return "";

  if (raw.startsWith("#")) {
    return /^#[A-Za-z0-9_-]+$/.test(raw) ? raw : "";
  }

  if (raw.startsWith("/")) {
    return raw.startsWith("//") ? "" : raw;
  }

  try {
    const url = new URL(raw);
    return SAFE_ABSOLUTE_PROTOCOLS.has(url.protocol.toLowerCase()) ? url.href : "";
  } catch {
    return "";
  }
}

module.exports={safeUserHref};