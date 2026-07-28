/**
 * Post-auth redirect targets arrive in the `?next=` query string, i.e. from an
 * attacker-supplied link. Only same-origin paths may be followed — anything
 * else falls back.
 *
 * A leading-slash check on its own is not enough: browsers normalise a
 * backslash to a slash when resolving a URL, so "/\evil.com" (and "/\/evil.com")
 * resolve to https://evil.com, and "//evil.com" is protocol-relative. Tabs and
 * newlines are stripped during parsing, so "/\tevil.com" gets the same
 * treatment.
 */
const FALLBACK = "/account";

export function safeInternalPath(value, fallback = FALLBACK) {
  if (typeof value !== "string") return fallback;
  // Control characters (incl. \t \n \r) are dropped by the URL parser, so a
  // target containing them can change meaning after normalisation.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;

  const path = value.trim();
  if (!path.startsWith("/")) return fallback;
  // "//host" (protocol-relative) and "/\host" (backslash-normalised) both leave
  // the origin.
  if (path[1] === "/" || path[1] === "\\") return fallback;
  if (path.includes("\\")) return fallback;

  return path;
}
