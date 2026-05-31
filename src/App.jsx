import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import RequireAuth from '@/components/RequireAuth';
import RequireAdmin from '@/components/RequireAdmin';
// Add page imports here
import Home from './pages/Home';
import Admin from './pages/Admin';
import Account from './pages/Account';
import Store from './pages/Store';
import Forum from './pages/Forum';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

const AuthenticatedApp = () => {
  const { isLoadingPublicSettings, authError } = useAuth();
  const { pathname } = useLocation();
  // Account-optional: only /account and /admin require a session. Their own
  // guards (RequireAuth/RequireAdmin) handle redirects, so an expired token must
  // never bounce an anonymous visitor off a public page.
  const isProtectedRoute = pathname.startsWith('/account') || pathname.startsWith('/admin');

  // Block only on the initial app/public-settings load.
  if (isLoadingPublicSettings) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // A gated-app "not registered" error only matters on protected routes.
  if (authError?.type === 'user_not_registered' && isProtectedRoute) {
    return <UserNotRegisteredError />;
  }

  // Render the main app
  return (
    <Routes>
      {/* Add your page Route elements here */}
      <Route path="/" element={<Home />} />
      <Route path="/admin/*" element={<RequireAdmin><Admin /></RequireAdmin>} />
      <Route path="/account/*" element={<RequireAuth><Account /></RequireAuth>} />
      <Route path="/store" element={<Store />} />
      <Route path="/forum" element={<Forum />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
