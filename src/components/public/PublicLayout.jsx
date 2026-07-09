import React, { lazy, Suspense, useEffect, useState } from "react";
import { NavLink, Link, useLocation, useOutlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Home, ShoppingBag, MessageSquare, User, ShieldCheck, Compass } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import SiteNav from "./SiteNav";
import ScrollProgressBar from "./ScrollProgressBar";
import AdSlot from "@/components/ads/AdSlot";
import PublicOfflineBanner from "@/components/PublicOfflineBanner";
import { selectionChanged } from "@/lib/native/haptics";

const MobileCommandSheet = lazy(() => import("./MobileCommandSheet"));

export default function PublicLayout() {
  const { isAdmin, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;
  const isHome = pathname === "/";
  const outlet = useOutlet();
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const handleNavigate = (hash) => {
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        const element = document.querySelector(hash);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 300);
    } else {
      const element = document.querySelector(hash);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };
  
  const { data: settingsRecords = [], isLoading: isLoadingSettings } = useQuery({
    queryKey: ["siteSettings"],
    queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1),
    enabled: appParams.hasBase44Config,
  });

  const prefetchRoute = (href) => {
    try {
      if (href === "/") import("@/pages/Home");
      else if (href === "/store") import("@/pages/Store");
      else if (href === "/forum") import("@/pages/Forum");
      else if (href === "/admin") import("@/pages/Admin");
      else if (href === "/account") import("@/pages/Account");
    } catch {}
  };

  const bottomTabBase = "ios-tabbar-item mx-0.5 flex flex-1 flex-col items-center justify-center gap-1 border px-1 py-1 text-[9px] font-extrabold uppercase tracking-wide transition-all cursor-pointer min-w-0";
  const bottomTabClass = (isActive) =>
    `${bottomTabBase} ${
      isActive
        ? "border-primary/25 bg-primary/10 text-foreground shadow-[0_0_18px_rgba(249,115,22,0.16)]"
        : "border-transparent text-muted-foreground/80 hover:border-border/50 hover:bg-muted/20 hover:text-foreground"
    }`;
  const adminBottomTabClass = (isActive) =>
    `${bottomTabBase} ${
      isActive
        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.14)]"
        : "border-transparent text-muted-foreground/80 hover:border-border/50 hover:bg-muted/20 hover:text-foreground"
    }`;

  useEffect(() => {
    const updateCartCount = () => {
      try {
        const items = JSON.parse(localStorage.getItem("rlt_cart") || "[]");
        setCartCount(items.reduce((sum, item) => sum + Number(item.quantity || 0), 0));
      } catch {
        setCartCount(0);
      }
    };

    updateCartCount();
    window.addEventListener("rlt_cart_changed", updateCartCount);
    window.addEventListener("storage", updateCartCount);
    return () => {
      window.removeEventListener("rlt_cart_changed", updateCartCount);
      window.removeEventListener("storage", updateCartCount);
    };
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* Skip to content — visible only when focused (keyboard users) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:border focus:border-primary focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-foreground"
      >
        Skip to content
      </a>

      {/* Desktop neon scroll progress indicator */}
      <ScrollProgressBar />

      {/* Top Site Navigation */}
      <SiteNav settings={settingsRecords[0] || {}} settingsLoading={isLoadingSettings} />

      {/* Offline indicator — sticky, renders nothing while online */}
      <PublicOfflineBanner />

      {/* Sponsored Ad Slot — banner top, above content, all pages. The wrapper
          collapses (empty:hidden) when there's no ad so it never leaves a gap;
          nav clearance lives on the ad itself so it sits below the fixed header. */}
      <div className="empty:hidden w-full border-b border-border/30">
        <AdSlot
          position="banner-top"
          size="leaderboard"
          className="mx-auto block w-full max-w-5xl px-4 pt-[calc(4.5rem+env(safe-area-inset-top,0px))] pb-4"
        />
      </div>

      {/* Content wrapper with page transition animation */}
      <div id="main-content" className="flex-1 pb-[max(76px,calc(76px+var(--safe-bottom)))] xl:pb-0">
        {/* Instant native-style tab switching: new page mounts immediately with a
            quick fade-in — no exit-animation wait between routes. */}
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
          {outlet}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sponsored Ad Slot — above footer, all pages */}
      <div className="w-full border-t border-border/30">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <AdSlot position="footer" size="leaderboard" className="w-full" />
        </div>
      </div>

      {/* Site-wide footer (non-Home pages — Home renders its own rich footer) */}
      {!isHome && (
        <footer className="border-t border-border/50 bg-secondary/80 px-5 py-4 text-center backdrop-blur-sm">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
            Rugby League Takeover Las Vegas © 2026
          </p>
          <div className="mt-2 flex items-center justify-center gap-4">
            <Link to="/terms" className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 hover:text-foreground transition-colors">Terms &amp; Conditions</Link>
            <span className="text-muted-foreground/30">·</span>
            <Link to="/privacy" className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 hover:text-foreground transition-colors">Privacy Policy</Link>
          </div>
        </footer>
      )}

      {/* iOS-Style Public Mobile Bottom Tab Bar */}
      <nav className="ios-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-border/70 xl:hidden pointer-events-auto" aria-label="Main navigation">
        <div className="mx-auto flex w-full max-w-md items-center justify-around px-1.5 pt-1.5">
          <NavLink
            to="/"
            aria-label="Home"
            onMouseEnter={() => prefetchRoute("/")}
            onTouchStart={() => prefetchRoute("/")}
            onClick={() => selectionChanged()}
            className={({ isActive }) => bottomTabClass(isActive)}
          >
            {({ isActive }) => (
              <>
                <Home className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                <span className="max-w-full truncate">Home</span>
                {isActive && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full bg-primary shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                )}
              </>
            )}
          </NavLink>

          <button
            type="button"
            onClick={() => { selectionChanged(); setIsPlanOpen(true); }}
            aria-label="Plan Trip"
            aria-haspopup="dialog"
            className={`${bottomTabBase} border-accent/20 bg-accent/10 text-accent shadow-[0_0_16px_rgba(217,119,6,0.14)] hover:bg-accent/15`}
          >
            <Compass className="h-5 w-5" />
            <span className="max-w-full truncate">Plan</span>
          </button>

          <NavLink
            to="/store"
            aria-label="Shop"
            onMouseEnter={() => prefetchRoute("/store")}
            onTouchStart={() => prefetchRoute("/store")}
            onClick={() => selectionChanged()}
            className={({ isActive }) => bottomTabClass(isActive)}
          >
            {({ isActive }) => (
              <>
                <ShoppingBag className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                <span className="max-w-full truncate">Shop</span>
                {cartCount > 0 && (
                  <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center border border-primary/40 bg-primary px-1 text-[9px] font-black leading-none text-primary-foreground shadow-[0_0_10px_rgba(249,115,22,0.35)]">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full bg-primary shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                )}
              </>
            )}
          </NavLink>

          <NavLink
            to="/forum"
            aria-label="Forum"
            onMouseEnter={() => prefetchRoute("/forum")}
            onTouchStart={() => prefetchRoute("/forum")}
            onClick={() => selectionChanged()}
            className={({ isActive }) => bottomTabClass(isActive)}
          >
            {({ isActive }) => (
              <>
                <MessageSquare className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                <span className="max-w-full truncate">Forum</span>
                {isActive && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full bg-primary shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                )}
              </>
            )}
          </NavLink>

          <NavLink
            to="/account"
            aria-label="Account"
            onMouseEnter={() => prefetchRoute("/account")}
            onTouchStart={() => prefetchRoute("/account")}
            onClick={() => selectionChanged()}
            className={({ isActive }) => bottomTabClass(isActive)}
          >
            {({ isActive }) => (
              <>
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="Account"
                    decoding="async"
                    className={`h-5 w-5 rounded-none object-cover border transition-all ${
                      isActive ? "border-primary" : "border-border/60"
                    }`}
                  />
                ) : (
                  <User className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                )}
                <span className="max-w-full truncate">Account</span>
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
              onMouseEnter={() => prefetchRoute("/admin")}
              onTouchStart={() => prefetchRoute("/admin")}
              onClick={() => selectionChanged()}
              className={({ isActive }) => adminBottomTabClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  <ShieldCheck className="h-5 w-5" />
                  <span className="max-w-full truncate">Admin</span>
                  {isActive && (
                    <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                  )}
                </>
              )}
            </NavLink>
          )}
        </div>
      </nav>

      {isPlanOpen && (
        <Suspense fallback={null}>
          <MobileCommandSheet
            isOpen={isPlanOpen}
            onClose={() => setIsPlanOpen(false)}
            onNavigate={handleNavigate}
            cartCount={cartCount}
            settings={settingsRecords[0] || {}}
            context={pathname.startsWith("/store") ? "store" : pathname.startsWith("/forum") ? "forum" : pathname.startsWith("/account") ? "account" : "home"}
          />
        </Suspense>
      )}
    </div>
  );
}