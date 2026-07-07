import React, { useEffect, useState, lazy, Suspense } from "react";
import { QueryClientProvider } from '@tanstack/react-query'
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
        <Router>
          <ScrollToTop />
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
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App