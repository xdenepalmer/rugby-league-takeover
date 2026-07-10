/**
 * Canonical-path aliases for the native tree. Web URLs that encode state in
 * query params (legacy share links, notification links, auth-email links)
 * are normalized onto the native stack's real routes so back/tab behavior
 * stays sane. Pure so tests can assert the table.
 */
export const ACCOUNT_TAB_ROUTES = {
  fanhub: "/account",
  achievements: "/account/achievements",
  leaderboard: "/account/leaderboard",
  profile: "/account/profile",
  orders: "/account/orders",
  posts: "/account/posts",
  interest: "/account/interest",
  security: "/account/security",
};

/**
 * Returns the native route for a location ({ pathname, search }) when an
 * alias applies, else null (meaning: render the location as-is). Resolved
 * centrally by NativePublicShell — the single live implementation for every
 * legacy query-param URL (share links, notifications, web deep links).
 */
export function nativeAliasFor({ pathname, search }) {
  const params = new URLSearchParams(search || "");
  if (pathname === "/forum") {
    const thread = params.get("thread");
    if (thread) return `/forum/thread/${encodeURIComponent(thread)}`;
  }
  if (pathname === "/store") {
    const product = params.get("product");
    if (product) return `/store/product/${encodeURIComponent(product)}`;
  }
  if (pathname === "/account") {
    const tab = params.get("tab");
    if (tab && ACCOUNT_TAB_ROUTES[tab] && ACCOUNT_TAB_ROUTES[tab] !== "/account") {
      return ACCOUNT_TAB_ROUTES[tab];
    }
  }
  return null;
}
