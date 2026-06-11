export const mobilePrimaryAdminTabs = [
  { kind: "route", label: "Overview", to: "/admin/overview", icon: "LayoutDashboard" },
  { kind: "route", label: "Content", to: "/admin/content", icon: "FileText" },
  { kind: "route", label: "Store", to: "/admin/store", icon: "ShoppingBag", badgeKey: "store" },
  { kind: "route", label: "Community", to: "/admin/community", icon: "MessagesSquare", badgeKey: "community" },
  { kind: "more", label: "More", icon: "MoreHorizontal" },
];

export const mobileMoreAdminItems = [
  { kind: "route", label: "Events", to: "/admin/events", icon: "CalendarDays" },
  { kind: "route", label: "People", to: "/admin/people", icon: "Users" },
  { kind: "route", label: "Ads", to: "/admin/ads", icon: "Megaphone" },
  { kind: "route", label: "Settings", to: "/admin/settings", icon: "Settings" },
  { kind: "link", label: "View Site", to: "/", icon: "ExternalLink" },
  { kind: "action", action: "export", label: "Export Data", icon: "Download" },
  { kind: "action", action: "refresh", label: "Refresh Data", icon: "RefreshCw" },
  { kind: "action", action: "logout", label: "Log Out", icon: "LogOut" },
];

const sectionLabels = [
  ...mobilePrimaryAdminTabs.filter((item) => item.to),
  ...mobileMoreAdminItems.filter((item) => item.to?.startsWith("/admin")),
];

export function getAdminSectionLabel(pathname) {
  return sectionLabels.find((item) => pathname.startsWith(item.to))?.label || "Dashboard";
}

export function getActiveMobileAdminTab(pathname) {
  const primary = mobilePrimaryAdminTabs.find((item) => item.to && pathname.startsWith(item.to));
  if (primary) return primary.label;

  const secondary = mobileMoreAdminItems.find((item) => item.to?.startsWith("/admin") && pathname.startsWith(item.to));
  return secondary ? "More" : "Overview";
}