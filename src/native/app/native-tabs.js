/**
 * Native fan-shell navigation contract. Pure data + helpers (no React, no
 * icon imports) so node tests can assert the tab architecture directly:
 * exactly five primary tabs, Admin never among them, and every secondary
 * destination reachable through the Takeover (More) sheet.
 *
 * Icon values are string keys resolved to lucide components inside
 * NativeTabBar/NativeMoreSheet — keeping this module dependency-free.
 */
export const NATIVE_FAN_TABS = [
  { id: "home", label: "Home", to: "/", icon: "home" },
  { id: "news", label: "News", to: "/news", icon: "newspaper" },
  { id: "forum", label: "Forum", to: "/forum", icon: "message-square" },
  { id: "store", label: "Store", to: "/store", icon: "shopping-bag" },
  { id: "account", label: "Account", to: "/account", icon: "user" },
];

/**
 * Secondary destinations in the Takeover sheet. `to` items navigate;
 * `action` items are handled by the shell ("plan" opens the trip-planning
 * sheet). `requiresAdmin` gates the Admin entry to authorized users —
 * Admin must never be a sixth public tab.
 */
export const NATIVE_MORE_ITEMS = [
  { id: "plan", label: "Plan the Trip", icon: "compass", action: "plan" },
  { id: "gallery", label: "Gallery", icon: "image", to: "/gallery" },
  { id: "faq", label: "FAQ", icon: "help-circle", to: "/faq" },
  { id: "terms", label: "Terms", icon: "file-text", to: "/terms" },
  { id: "privacy", label: "Privacy", icon: "shield", to: "/privacy" },
  { id: "admin", label: "Admin", icon: "shield-check", to: "/admin", requiresAdmin: true },
];

/** Longest-prefix owner tab for a pathname ("/" matches only exactly). */
export function tabForPath(pathname) {
  if (typeof pathname !== "string" || !pathname) return null;
  if (pathname === "/") return "home";
  for (const tab of NATIVE_FAN_TABS) {
    if (tab.to === "/") continue;
    if (pathname === tab.to || pathname.startsWith(`${tab.to}/`)) return tab.id;
  }
  return null;
}

export function tabRoot(tabId) {
  return NATIVE_FAN_TABS.find((tab) => tab.id === tabId)?.to || "/";
}

export function isTabRootPath(pathname) {
  return NATIVE_FAN_TABS.some((tab) => tab.to === pathname);
}
