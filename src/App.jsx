import React, { useEffect, useState, lazy, Suspense } from "react";
import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PublicLayout from '@/components/public/PublicLayout';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import RequireAuth from '@/components/RequireAuth';
import RequireAdmin from '@/components/RequireAdmin';
import NativeAppBootstrap from '@/components/NativeAppBootstrap';
import { isNativeApp } from '@/lib/native/native-env';
import { THEME_ACCENTS } from '@/lib/theme-accents';

// Lazy-loaded pages
const Home = lazy(() => import("./pages/Home"));
const Admin = lazy(() => import("./pages/Admin"));
const Account = lazy(() => import("./pages/Account"));
const Store = lazy(() => import("./pages/Store"));
const Forum = lazy(() => import("./pages/Forum"));
const News = lazy(() => import("./pages/News"));
const Faq = lazy(() => import("./pages/Faq"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const DeferredToaster = lazy(() => import("@/components/ui/toaster").then((module) => ({ default: module.Toaster })));
const InstallAppPrompt = lazy(() => import("@/components/InstallAppPrompt"));
const PwaUpdatePrompt = lazy(() => import("@/components/PwaUpdatePrompt"));
// The native iOS shell renders its own route tree (five-tab app shell,
// native screens). Lazy so the web bundle never fetches native-only chunks —
// the element only renders when Capacitor injected isNativePlatform().
const NativeAppRoutes = lazy(() => import("@/native/app/NativeAppRoutes.jsx"));

// Sleek, theme-responsive loading spinner for route chunk loading
const LoadingFallback = () => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background text-foreground">
    <div className="relative flex items-center justify-center mb-4">
      {/* Outer pulsing neon circle */}
      <div className="absolute h-12 w-12 rounded-full border-2 border-primary/20 animate-ping" />
      {/* Inner spinning loader */}
      <div className="h-10 w-10 rounded-full border-t-2 border-r-2 border-primary animate-spin" />
    </div>
    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-primary animate-pulse">
      Loading Module...
    </span>
  </div>
);

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

  // A gated-app "not registered" error only matters on protected routes.
  if (authError?.type === 'user_not_registered' && isProtectedRoute) {
    return <UserNotRegisteredError />;
  }

  // Platform presentation split: same backend, auth and query cache — the
  // native shell gets an app-grade route tree, the web keeps this one
  // byte-for-byte. isNativeApp() is stable for the app's lifetime (the
  // Capacitor bridge is injected before any script runs).
  if (isNativeApp()) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <NativeAppRoutes />
      </Suspense>
    );
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
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>
        <Route path="/admin/*" element={<RequireAdmin><Admin /></RequireAdmin>} />
        <Route path="/account/*" element={<RequireAuth><Account /></RequireAuth>} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};


// Accent registry lives in src/lib/theme-accents.js (single source shared
// with the native Takeover sheet's picker, which dispatches rlt_theme_change).
const themeConfigs = THEME_ACCENTS;

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
            {/* Web-only: the native shell has its own per-tab scroll memory. */}
            {!isNativeApp() && <ScrollToTop />}
            <NativeAppBootstrap />
            <AuthenticatedApp />
            {showDeferredUi && (
              <Suspense fallback={null}>
                <InstallAppPrompt />
                <PwaUpdatePrompt />
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