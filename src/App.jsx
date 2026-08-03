import React, { useEffect, useState, lazy, Suspense } from "react";
import { LoadingFallback } from "@/components/ui/LoadingFallback";
import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import PublicLayout from '@/components/public/PublicLayout';

import { AuthProvider, useAuth } from '@/lib/AuthContext';

import ScrollToTop from './components/ScrollToTop';
import RequireAuth from '@/components/RequireAuth';
import RequireAdmin from '@/components/RequireAdmin';
import NativeAppBootstrap from '@/components/NativeAppBootstrap';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

// Lazy-loaded pages
const PageNotFound = lazy(() => import('./lib/PageNotFound'));
const UserNotRegisteredError = lazy(() => import('@/components/UserNotRegisteredError'));
// lazyWithRetry (not bare lazy): on launch night's repeated deploys, an open tab
// navigating to a cold route after a deploy would fetch an old-hash chunk that
// now 404s and white-screen into RootErrorBoundary. This reloads once instead.
const Home = lazyWithRetry(() => import("./pages/Home"), "home");
const Admin = lazyWithRetry(() => import("./pages/Admin"), "admin");
const Account = lazyWithRetry(() => import("./pages/Account"), "account");
const Store = lazyWithRetry(() => import("./pages/Store"), "store");
const Forum = lazyWithRetry(() => import("./pages/Forum"), "forum");
const News = lazyWithRetry(() => import("./pages/News"), "news");
const Faq = lazyWithRetry(() => import("./pages/Faq"), "faq");
const Gallery = lazyWithRetry(() => import("./pages/Gallery"), "gallery");
const Terms = lazyWithRetry(() => import("./pages/Terms"), "terms");
const Privacy = lazyWithRetry(() => import("./pages/Privacy"), "privacy");
const DeleteAccount = lazyWithRetry(() => import("./pages/DeleteAccount"), "delete-account");
// Standalone (no site chrome): staff open this from a phone camera scan at the bar.
const VerifyMember = lazyWithRetry(() => import("./pages/VerifyMember"), "verify-member");
const Login = lazyWithRetry(() => import("./pages/Login"), "login");
const Register = lazyWithRetry(() => import("./pages/Register"), "register");
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"), "forgot-password");
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"), "reset-password");
const DeferredToaster = lazy(() => import("@/components/ui/toaster").then((module) => ({ default: module.Toaster })));
const InstallAppPrompt = lazy(() => import("@/components/InstallAppPrompt"));
const PwaUpdatePrompt = lazy(() => import("@/components/PwaUpdatePrompt"));
const AppStoreReviewPrompt = lazy(() => import("@/components/AppStoreReviewPrompt"));

// Sleek, theme-responsive loading spinner for route chunk loading
/* replaced */ const OLD_LoadingFallback = () => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background text-foreground">
    <div className="relative flex items-center justify-center mb-4">
      {/* Outer pulsing neon circle */}
      <div className="absolute h-12 w-12 rounded-full border-2 border-primary/20 animate-ping" />
      {/* Inner spinning loader */}
      <div className="h-10 w-10 rounded-full border-t-2 border-r-2 border-primary animate-spin" />
    </div>
    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-primary animate-pulse">
      Loading Module... */
    </span>
  </div>
);

const DeepLinkHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let listener = null;

    const setupListener = async () => {
      try {
        // Lazy-load so the web build never statically pulls in @capacitor/app.
        const { App: CapApp } = await import('@capacitor/app');
        listener = await CapApp.addListener('appUrlOpen', (event) => {
          try {
            const url = new URL(event.url);
            navigate(url.pathname + url.search + url.hash);
          } catch (err) {
            console.error('Error handling deep link URL:', err);
          }
        });
      } catch (err) {
        console.error('Error setting up deep link listener:', err);
      }
    };

    setupListener();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, [navigate]);

  return null;
};

const AuthenticatedApp = () => {
  const { isLoadingPublicSettings, authError } = useAuth();
  const { pathname } = useLocation();
  // Account-optional: only /account and /admin require a session. Their own
  // guards (RequireAuth/RequireAdmin) handle redirects, so an expired token must
  // never bounce an anonymous visitor off a public page.
  const isProtectedRoute = pathname.startsWith('/account') || pathname.startsWith('/admin');

  // Block only on the initial app/public-settings load.
  if (isLoadingPublicSettings) {
    return <LoadingFallback />;
  }

  // Hide the native splash screen once the critical blocking data has loaded
  if (typeof window !== "undefined") {
    import("@capacitor/splash-screen")
      .then(({ SplashScreen }) => SplashScreen.hide())
      .catch(() => {});
  }

  // A gated-app "not registered" error only matters on protected routes.
  if (authError?.type === 'user_not_registered' && isProtectedRoute) {
    return <UserNotRegisteredError />;
  }

  // Render the main app with route code-splitting suspense
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Add your page Route elements here */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/store" element={<Store />} />
          <Route path="/forum" element={<Forum />} />
          <Route path="/news" element={<News />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/delete-account" element={<DeleteAccount />} />
        </Route>
        {/* Auth screens render standalone (full-screen AuthLayout) — no site
            nav, ads, footer, or bottom tab bar overlaying the form. */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-member" element={<VerifyMember />} />
        <Route path="/admin/*" element={<RequireAdmin><Admin /></RequireAdmin>} />
        <Route path="/account/*" element={<RequireAuth><Account /></RequireAuth>} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};


const themeConfigs = {
  sincity: { primary: "15 95% 55%", foreground: "0 0% 100%" },
  flamingo: { primary: "330 95% 60%", foreground: "0 0% 100%" },
  highroller: { primary: "280 80% 55%", foreground: "0 0% 100%" },
  emerald: { primary: "140 75% 45%", foreground: "0 0% 100%" },
  jackpot: { primary: "45 93% 47%", foreground: "0 0% 0%" },
};

function App() {
  const [showDeferredUi, setShowDeferredUi] = useState(false);

  useEffect(() => {
    const applyTheme = (themeKey) => {
      const config = themeConfigs[themeKey] || themeConfigs.sincity;
      document.documentElement.style.setProperty("--primary", config.primary);
      document.documentElement.style.setProperty("--primary-foreground", config.foreground);
    };

    const stored = localStorage.getItem("rlt_theme_accent") || "sincity";
    applyTheme(stored);

    const handleThemeChange = (e) => {
      const themeKey = e.detail?.theme;
      if (themeKey && themeConfigs[themeKey]) {
        localStorage.setItem("rlt_theme_accent", themeKey);
        applyTheme(themeKey);
      }
    };

    window.addEventListener("rlt_theme_change", handleThemeChange);

    // Defer non-critical helpers until after page load/idle so the route can
    // paint before toast/PWA dialog code is requested.
    const handleDefer = () => {
      if (typeof window !== "undefined") {
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(() => setShowDeferredUi(true), { timeout: 2500 });
        } else {
          setTimeout(() => setShowDeferredUi(true), 2000);
        }
      }
    };

    if (document.readyState === "complete") {
      handleDefer();
    } else {
      window.addEventListener("load", handleDefer, { once: true });
    }

    return () => {
      window.removeEventListener("rlt_theme_change", handleThemeChange);
      window.removeEventListener("load", handleDefer);
    };
  }, []);

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        {/* reducedMotion="user" makes every framer-motion component honour the
            OS "Reduce Motion" setting — framer animates via inline transforms
            that bypass the CSS reduced-motion reset, so this is required. */}
        <MotionConfig reducedMotion="user">
          <Router>
            <ScrollToTop />
            <NativeAppBootstrap />
            <AuthenticatedApp />
            {showDeferredUi && (
              <Suspense fallback={null}>
                <InstallAppPrompt />
                <PwaUpdatePrompt />
                <AppStoreReviewPrompt />
                <DeferredToaster />
              </Suspense>
            )}
          </Router>
        </MotionConfig>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
