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

      {/* Site-wide footer (non-Home pages) */}
      <footer className="border-t border-border/50 bg-secondary/80 px-5 py-4 text-center backdrop-blur-sm">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
          Rugby League Takeover Las Vegas © 2026
        </p>
      </footer>

      {/* iOS-Style Public Mobile Bottom Tab Bar */}
      <nav className="ios-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-border/70 lg:hidden pointer-events-auto" aria-label="Main navigation">
        <div className="flex items-center justify-around px-2 py-1.5 w-full">
          <NavLink
            to="/"
            aria-label="Home"
            className={({ isActive }) =>
              `ios-tabbar-item flex flex-col items-center justify-center flex-1 gap-1 py-1 text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer ${
                isActive ? "text-primary" : "text-muted-foreground/80 hover:text-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Home className="h-5 w-5" />
                <span>Home</span>
                {isActive && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full bg-primary shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                )}
              </>
            )}
          </NavLink>

          <NavLink
            to="/store"
            aria-label="Shop"
            className={({ isActive }) =>
              `ios-tabbar-item flex flex-col items-center justify-center flex-1 gap-1 py-1 text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer ${
                isActive ? "text-primary" : "text-muted-foreground/80 hover:text-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <ShoppingBag className="h-5 w-5" />
                <span>Shop</span>
                {isActive && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full bg-primary shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                )}
              </>
            )}
          </NavLink>

          <NavLink
            to="/forum"
            aria-label="Forum"
            className={({ isActive }) =>
              `ios-tabbar-item flex flex-col items-center justify-center flex-1 gap-1 py-1 text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer ${
                isActive ? "text-primary" : "text-muted-foreground/80 hover:text-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <MessageSquare className="h-5 w-5" />
                <span>Forum</span>
                {isActive && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full bg-primary shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                )}
              </>
            )}
          </NavLink>

          <NavLink
            to="/account"
            aria-label="Account"
            className={({ isActive }) =>
              `ios-tabbar-item flex flex-col items-center justify-center flex-1 gap-1 py-1 text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer ${
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
                {isActive && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full bg-primary shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                )}
              </>
            )}
          </NavLink>

          {isAdmin && (
            <NavLink
              to="/admin"
              aria-label="Admin dashboard"
              className={({ isActive }) =>
                `ios-tabbar-item flex flex-col items-center justify-center flex-1 gap-1 py-1 text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  isActive ? "text-emerald-400" : "text-muted-foreground/80 hover:text-foreground"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <ShieldCheck className="h-5 w-5" />
                  <span>Admin</span>
                  {isActive && (
                    <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                  )}
                </>
              )}
            </NavLink>
          )}
        </div>
      </nav>
    </div>
  );
}