import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
  </div>
);

// Gate for signed-in-only pages (e.g. /account). Sends guests to /login with a
// ?next= so they return where they intended after authenticating.
export default function RequireAuth({ children }) {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings } = useAuth();
  const location = useLocation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <Spinner />;
  }

  if (!isAuthenticated) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
