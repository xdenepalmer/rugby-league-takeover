import React from "react";
import { Outlet, NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Home, ShoppingBag, MessageSquare, User, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import SiteNav from "./SiteNav";

export default function PublicLayout() {
  const { isAdmin, user } = useAuth();
  const { data: settingsRecords = [] } = useQuery({
    queryKey: ["siteSettings"],
    queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1),
    enabled: appParams.hasBase44Config,
  });

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* Skip to content — visible only when focused (keyboard users) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:border focus:border-primary focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-foreground"
      >
        Skip to content
      </a>

      {/* Top Site Navigation */}
      <SiteNav settings={settingsRecords[0] || {}} />

      {/* Content wrapper with padding at bottom on mobile to clear the tab bar */}
      <div id="main-content" className="flex-1 pb-[max(76px,calc(76px+var(--safe-bottom)))] lg:pb-0">
        <Outlet />
      </div>

      {/* iOS-Style Public Mobile Bottom Tab Bar */}
      <nav className="ios-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-border/70 lg:hidden pointer-events-auto">
        <div className="flex items-center justify-around px-2 py-1.5 w-full">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `ios-tabbar-item flex flex-col items-center justify-center flex-1 gap-1 py-1 text-[9px] font-bold uppercase tracking-wide transition-all ${
                isActive ? "text-primary" : "text-muted-foreground/80 hover:text-foreground"
              }`
            }
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/store"
            className={({ isActive }) =>
              `ios-tabbar-item flex flex-col items-center justify-center flex-1 gap-1 py-1 text-[9px] font-bold uppercase tracking-wide transition-all ${
                isActive ? "text-primary" : "text-muted-foreground/80 hover:text-foreground"
              }`
            }
          >
            <ShoppingBag className="h-5 w-5" />
            <span>Shop</span>
          </NavLink>

          <NavLink
            to="/forum"
            className={({ isActive }) =>
              `ios-tabbar-item flex flex-col items-center justify-center flex-1 gap-1 py-1 text-[9px] font-bold uppercase tracking-wide transition-all ${
                isActive ? "text-primary" : "text-muted-foreground/80 hover:text-foreground"
              }`
            }
          >
            <MessageSquare className="h-5 w-5" />
            <span>Forum</span>
          </NavLink>

          <NavLink
            to="/account"
            className={({ isActive }) =>
              `ios-tabbar-item flex flex-col items-center justify-center flex-1 gap-1 py-1 text-[9px] font-bold uppercase tracking-wide transition-all ${
                isActive ? "text-primary" : "text-muted-foreground/80 hover:text-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="Account"
                    className={`h-5 w-5 rounded-none object-cover border transition-all ${
                      isActive ? "border-primary" : "border-border/60"
                    }`}
                  />
                ) : (
                  <User className="h-5 w-5" />
                )}
                <span>Account</span>
              </>
            )}
          </NavLink>

          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `ios-tabbar-item flex flex-col items-center justify-center flex-1 gap-1 py-1 text-[9px] font-bold uppercase tracking-wide transition-all ${
                  isActive ? "text-emerald-400" : "text-muted-foreground/80 hover:text-foreground"
                }`
              }
            >
              <ShieldCheck className="h-5 w-5" />
              <span>Admin</span>
            </NavLink>
          )}
        </div>
      </nav>
    </div>
  );
}