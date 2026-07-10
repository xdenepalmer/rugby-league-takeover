import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import PublicOfflineBanner from "@/components/PublicOfflineBanner";
import { emitHaptic } from "@/lib/native/haptic-events";
import NativeTabBar from "./NativeTabBar.jsx";
import NativeMoreSheet from "./NativeMoreSheet.jsx";
import NativeScrollMemory from "../navigation/NativeScrollMemory.jsx";
import { isTabRootPath } from "./native-tabs.js";
import {
  loadTabMemory,
  saveTabMemory,
  rememberTabPath,
  resolveTabPress,
} from "../navigation/tab-history.js";

const MobileCommandSheet = lazy(() => import("@/components/public/MobileCommandSheet"));

/** Idle-prefetch the other tab chunks so first tab switches don't flash. */
function useIdleTabPrefetch() {
  useEffect(() => {
    const prefetch = () => {
      import("@/pages/Home").catch(() => {});
      import("@/pages/News").catch(() => {});
      import("@/pages/Forum").catch(() => {});
      import("@/pages/Store").catch(() => {});
      import("@/pages/Account").catch(() => {});
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 2500);
    return () => clearTimeout(id);
  }, []);
}

/**
 * Native fan shell: five-tab bar with per-tab route memory, the Takeover
 * (More) sheet, per-path scroll restoration, offline banner and trip-plan
 * sheet. Deliberately renders NONE of the web chrome (site header, website
 * footer, web ad banners, install/update prompts) so the WebView reads as
 * an app rather than the website.
 */
export default function NativePublicShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const memoryRef = useRef(null);
  if (memoryRef.current === null) memoryRef.current = loadTabMemory();

  const currentPath = `${location.pathname}${location.search}`;

  useIdleTabPrefetch();

  // Record every visited location against its owning tab.
  useEffect(() => {
    memoryRef.current = rememberTabPath(memoryRef.current, currentPath);
    saveTabMemory(memoryRef.current);
  }, [currentPath]);

  // Screens (e.g. native Home's travel CTA) open the plan sheet by event so
  // they don't need shell props threaded through the router.
  useEffect(() => {
    const openPlan = () => setPlanOpen(true);
    window.addEventListener("rlt_open_plan", openPlan);
    return () => window.removeEventListener("rlt_open_plan", openPlan);
  }, []);

  // Cart badge: same localStorage + event contract the web tab bar uses.
  useEffect(() => {
    const updateCartCount = () => {
      try {
        const items = JSON.parse(localStorage.getItem("rlt_cart") || "[]");
        setCartCount(items.reduce((sum, item) => sum + (item.quantity || 0), 0));
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

  const { data: settingsRecords = [] } = useQuery({
    queryKey: ["siteSettings"],
    queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1),
    enabled: appParams.hasBase44Config,
  });

  const handleTabPress = (tabId) => {
    emitHaptic("tab.select");
    const action = resolveTabPress({
      pressedTab: tabId,
      currentPath,
      memory: memoryRef.current,
    });
    if (action.type === "scroll-top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate(action.to);
    }
  };

  // The plan sheet's quick links are homepage anchors on the web; in the
  // shell, route home first, then let the anchor resolve.
  const handlePlanNavigate = (hash) => {
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" }), 300);
    } else {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const showMoreTrigger = isTabRootPath(location.pathname);

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <PublicOfflineBanner />

      {showMoreTrigger && (
        <button
          type="button"
          onClick={() => {
            emitHaptic("sheet.snap");
            setMoreOpen(true);
          }}
          aria-label="Open Takeover menu"
          className="ios-pressable fixed right-3 top-[calc(env(safe-area-inset-top,0px)+0.6rem)] z-40 flex h-11 items-center gap-2 border border-border/80 bg-background/85 px-3 text-[10px] font-black uppercase tracking-widest text-foreground backdrop-blur"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
          Takeover
        </button>
      )}

      <main id="main-content" className="flex-1 pb-[max(76px,calc(76px+var(--safe-bottom)))]">
        <Outlet />
      </main>

      <NativeTabBar onTabPress={handleTabPress} cartCount={cartCount} />

      <NativeMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onOpenPlan={() => setPlanOpen(true)}
      />

      {planOpen && (
        <Suspense fallback={null}>
          <MobileCommandSheet
            isOpen={planOpen}
            onClose={() => setPlanOpen(false)}
            onNavigate={handlePlanNavigate}
            cartCount={cartCount}
            settings={settingsRecords[0] || {}}
            context="home"
          />
        </Suspense>
      )}

      <NativeScrollMemory />
    </div>
  );
}
