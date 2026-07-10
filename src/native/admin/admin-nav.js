/**
 * Native admin navigation contract. Pure data so tests can assert that the
 * shell keeps every existing admin capability reachable: five admin tabs
 * (Overview / Content / Store / Community / More) and a module registry
 * covering all eight web sections. Sub-modules get REAL routes
 * (/admin/store/orders) — deeper than the web's section-level URLs, native
 * only, web admin untouched.
 */
export const NATIVE_ADMIN_TABS = [
  { id: "overview", label: "Overview", to: "/admin", icon: "gauge" },
  { id: "content", label: "Content", to: "/admin/content", icon: "file-text" },
  { id: "store", label: "Store", to: "/admin/store", icon: "shopping-bag" },
  { id: "community", label: "Community", to: "/admin/community", icon: "message-square" },
  { id: "more", label: "More", to: "/admin/more", icon: "layout-grid" },
];

/** Section hubs → their module ids (registry keys in admin-modules.jsx). */
export const ADMIN_SECTION_MODULES = {
  content: ["news", "travel", "gallery", "faqs", "partners", "testimonials"],
  store: ["products", "orders"],
  community: ["forum", "bans"],
  events: ["events", "teams", "matchups"],
  people: ["users", "registrations", "invites", "bans"],
  ads: ["ads", "sponsors", "calendar", "revenue"],
  settings: ["settings"],
  export: ["export"],
};

/** The More screen's contents — secondary sections + app-level actions. */
export const NATIVE_ADMIN_MORE_ITEMS = [
  { id: "events", label: "Events", detail: "Events, teams and matchups", to: "/admin/events", icon: "calendar-days" },
  { id: "people", label: "People", detail: "Users, registrations, invites, bans", to: "/admin/people", icon: "users" },
  { id: "ads", label: "Ads & Sponsors", detail: "Inventory, campaigns, revenue", to: "/admin/ads", icon: "megaphone" },
  { id: "settings", label: "Site Settings", detail: "Brand, hero, countdown, shipping", to: "/admin/settings/settings", icon: "settings" },
  { id: "export", label: "Export Data", detail: "CSV downloads", to: "/admin/more/export", icon: "download" },
  { id: "return", label: "Back to Fan App", detail: "Leave admin mode", action: "return", icon: "undo-2" },
  { id: "signout", label: "Sign Out", action: "signout", icon: "log-out" },
];

export function adminTabForPath(pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/admin")) return null;
  if (pathname === "/admin" || pathname === "/admin/" || pathname.startsWith("/admin/overview")) return "overview";
  if (pathname.startsWith("/admin/content")) return "content";
  if (pathname.startsWith("/admin/store")) return "store";
  if (pathname.startsWith("/admin/community")) return "community";
  // events/people/ads/settings/export all live under More
  return "more";
}
