const PREVIEW_HOST_PATTERNS = [
  /(^|\.)base44\.app$/i,
  /preview/i,
  /^localhost$/i,
  /^127\.0\.0\.1$/i,
  /^\[?::1\]?$/i,
];

export function isPreviewLikeUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (url.searchParams.has("app_id") || url.searchParams.has("access_token")) return true;
    return PREVIEW_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname));
  } catch {
    return true;
  }
}

export function shouldEnablePwaForEnvironment({ href, mode, hasServiceWorker }) {
  return mode === "production" && hasServiceWorker && !isPreviewLikeUrl(href);
}

export function shouldEnablePwa() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return shouldEnablePwaForEnvironment({
    href: window.location.href,
    mode: import.meta.env.MODE,
    hasServiceWorker: "serviceWorker" in navigator,
  });
}
