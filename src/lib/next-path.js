// Post-auth redirect targets. Only same-origin paths are honoured: a value like
// "//evil.example" or "https://evil.example" would otherwise send a freshly
// signed-in user off-site.
export function isInternalPath(target) {
  return typeof target === "string" && target.startsWith("/") && !target.startsWith("//");
}

export function safeInternalPath(target, fallback = "/") {
  return isInternalPath(target) ? target : fallback;
}

export function loginPathWithNext(location) {
  const next = encodeURIComponent(`${location.pathname}${location.search}`);
  return `/login?next=${next}`;
}
