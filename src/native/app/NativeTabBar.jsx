import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import { NATIVE_FAN_TABS, tabForPath } from "./native-tabs.js";
import { nativeIcon } from "../components/native-icons.js";

function TabBadge({ count }) {
  if (!count) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-black text-primary-foreground">
      {count > 9 ? "9+" : count}
    </span>
  );
}

/**
 * The five-tab native bar. Presentation reuses the existing .ios-tabbar
 * primitives (safe-area padding, tap-highlight reset); behavior is the
 * shell's: onTabPress runs the tab-history state machine (restore /
 * pop-to-root / scroll-top) and the tab.select haptic.
 */
export default function NativeTabBar({ onTabPress, cartCount = 0 }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const activeTab = tabForPath(pathname);

  // Same query key + fetch as NotificationBell so the cache is shared and
  // whichever surface is mounted keeps it warm.
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => base44.entities.Notification.filter({ recipient_id: user.id }, "-created_date", 30),
    enabled: appParams.hasBase44Config && !!user?.id,
    refetchInterval: 60000,
    meta: { silent: true },
  });
  const unread = notifications.filter((n) => n.is_read !== true).length;

  const badgeFor = (tabId) => {
    if (tabId === "store") return cartCount;
    if (tabId === "account") return unread;
    return 0;
  };

  return (
    <nav
      aria-label="App navigation"
      className="ios-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-1 pt-1.5">
        {NATIVE_FAN_TABS.map((tab) => {
          const Icon = nativeIcon(tab.icon);
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabPress(tab.id)}
              aria-current={active ? "page" : undefined}
              className={`ios-tabbar-item relative mx-0.5 flex min-h-11 flex-1 flex-col items-center justify-center gap-1 px-1 py-1 text-[9px] font-extrabold uppercase tracking-wide transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                <TabBadge count={badgeFor(tab.id)} />
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
