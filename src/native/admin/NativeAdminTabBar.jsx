import { useNavigate } from "react-router-dom";
import { Gauge, FileText, ShoppingBag, MessageSquare, LayoutGrid } from "lucide-react";
import { emitHaptic } from "@/lib/native/haptic-events";
import { NATIVE_ADMIN_TABS, adminTabForPath } from "./admin-nav.js";

const ICONS = {
  gauge: Gauge,
  "file-text": FileText,
  "shopping-bag": ShoppingBag,
  "message-square": MessageSquare,
  "layout-grid": LayoutGrid,
};

export default function NativeAdminTabBar({ attention = {}, currentPath = "" }) {
  const navigate = useNavigate();
  const active = adminTabForPath(currentPath);

  return (
    <nav
      aria-label="Admin navigation"
      className="ios-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-emerald-500/25 bg-background/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-1 pt-1.5">
        {NATIVE_ADMIN_TABS.map((tab) => {
          const Icon = ICONS[tab.icon] || Gauge;
          const isActive = active === tab.id;
          const badge = tab.id === "store" ? attention.store : tab.id === "community" ? attention.community : 0;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                emitHaptic("tab.select");
                if (isActive && currentPath !== tab.to) navigate(tab.to);
                else if (isActive) window.scrollTo({ top: 0, behavior: "smooth" });
                else navigate(tab.to);
              }}
              className={`ios-tabbar-item relative mx-0.5 flex min-h-11 flex-1 flex-col items-center justify-center gap-1 px-1 py-1 text-[9px] font-extrabold uppercase tracking-wide transition-colors ${
                isActive ? "text-emerald-300" : "text-muted-foreground"
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {badge > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-black text-black">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
