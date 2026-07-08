/**
 * NativeLayout — the iOS app's own shell. Replaces the web PublicLayout when
 * isNativeApp() is true (branched in App.jsx). No marketing SiteNav, no ad
 * slots, no web footer — just a native status-bar scrim, a tab-switched content
 * area with a native push transition, and a floating material tab bar that
 * respects the home-indicator safe area.
 *
 * Web is untouched: the web tree still renders PublicLayout verbatim.
 */
import React, { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { NavLink, useLocation, useOutlet, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Home, ShoppingBag, MessageSquare, User, Compass, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { selectionChanged } from "@/lib/native/haptics";

const MobileCommandSheet = lazy(() => import("@/components/public/MobileCommandSheet"));

// Ordered tab roots. Direction of the push transition is inferred from a tab's
// index so moving right in the bar slides content in from the right, etc.
const TAB_ORDER = ["/", "/store", "/forum", "/account", "/admin"];

function tabIndex(pathname) {
  if (pathname === "/") return 0;
  const root = "/" + (pathname.split("/")[1] || "");
  const i = TAB_ORDER.indexOf(root);
  return i === -1 ? 0 : i;
}

export default function NativeLayout() {
  const { isAdmin, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;
  const outlet = useOutlet();

  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  // Track travel direction so the content push slides the natural way.
  const prevIndex = useRef(tabIndex(pathname));
  const curIndex = tabIndex(pathname);
  const direction = curIndex >= prevIndex.current ? 1 : -1;
  useEffect(() => { prevIndex.current = curIndex; }, [curIndex]);

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

  const handleNavigate = (hash) => {
    if (pathname !== "/") {
      navigate("/");
      setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" }), 300);
    } else {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const planContext = pathname.startsWith("/store")
    ? "store"
    : pathname.startsWith("/forum")
      ? "forum"
      : pathname.startsWith("/account")
        ? "account"
        : "home";

  const tabs = useMemo(() => {
    const base = [
      { to: "/", label: "Home", icon: Home, end: true },
      { to: "/store", label: "Shop", icon: ShoppingBag, badge: cartCount },
      { plan: true, label: "Plan", icon: Compass },
      { to: "/forum", label: "Forum", icon: MessageSquare },
      { to: "/account", label: "You", icon: User, avatar: user?.avatar_url },
    ];
    if (isAdmin) base.push({ to: "/admin", label: "Admin", icon: ShieldCheck, admin: true });
    return base;
  }, [cartCount, user?.avatar_url, isAdmin]);

  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
      {/* Status-bar legibility scrim — sits behind content, never intercepts taps. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[calc(var(--safe-top)+0.5rem)] bg-gradient-to-b from-background/90 to-transparent"
      />

      {/* Content — each tab root gets a native horizontal push; deeper same-tab
          navigations (e.g. /forum/thread) share the key so they don't slide. */}
      <div id="main-content" className="relative flex-1 overflow-x-hidden">
        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
          <motion.div
            key={curIndex}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ type: "tween", duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
            className="min-h-dvh"
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating native tab bar */}
      <nav
        className="nt-material-bar fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06]"
        style={{ paddingBottom: "max(0.4rem, var(--safe-bottom))" }}
        aria-label="Main navigation"
      >
        <div className="mx-auto flex w-full max-w-md items-stretch justify-around px-2 pt-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            if (tab.plan) {
              return (
                <button
                  key="plan"
                  type="button"
                  onClick={() => { selectionChanged(); setIsPlanOpen(true); }}
                  aria-label="Plan trip"
                  aria-haspopup="dialog"
                  className="ios-pressable relative flex flex-1 flex-col items-center justify-center gap-1 py-1"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 text-accent shadow-[0_0_18px_rgba(217,119,6,0.22)]">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="text-2xs font-bold uppercase tracking-wide text-accent/90">{tab.label}</span>
                </button>
              );
            }
            const activeColor = tab.admin ? "text-emerald-300" : "text-primary";
            const dot = tab.admin ? "bg-emerald-400" : "bg-primary";
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                aria-label={tab.label}
                onClick={() => selectionChanged()}
                className="relative flex flex-1 flex-col items-center justify-center gap-1 py-1"
              >
                {({ isActive }) => (
                  <>
                    <span className="relative flex h-7 items-center justify-center">
                      {tab.avatar ? (
                        <img
                          src={tab.avatar}
                          alt=""
                          decoding="async"
                          className={`h-[22px] w-[22px] rounded-full object-cover ring-1 transition ${isActive ? "ring-primary" : "ring-white/15"}`}
                        />
                      ) : (
                        <Icon
                          className={`h-[22px] w-[22px] transition-colors ${isActive ? activeColor : "text-muted-foreground/75"}`}
                          strokeWidth={isActive ? 2.4 : 2}
                        />
                      )}
                      {tab.badge > 0 && (
                        <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-background bg-primary px-1 text-[9px] font-black leading-none text-primary-foreground">
                          {tab.badge > 9 ? "9+" : tab.badge}
                        </span>
                      )}
                    </span>
                    <span className={`text-2xs font-bold uppercase tracking-wide transition-colors ${isActive ? activeColor : "text-muted-foreground/70"}`}>
                      {tab.label}
                    </span>
                    {isActive && (
                      <motion.span
                        layoutId="nt-tab-dot"
                        className={`absolute -bottom-0.5 h-1 w-1 rounded-full ${dot}`}
                        transition={{ type: "spring", stiffness: 500, damping: 32 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {isPlanOpen && (
        <Suspense fallback={null}>
          <MobileCommandSheet
            isOpen={isPlanOpen}
            onClose={() => setIsPlanOpen(false)}
            onNavigate={handleNavigate}
            cartCount={cartCount}
            settings={{}}
            context={planContext}
          />
        </Suspense>
      )}
    </div>
  );
}
