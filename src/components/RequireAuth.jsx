import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { loginPathWithNext } from "@/lib/next-path";
import RouteGateSpinner from "@/components/RouteGateSpinner";

// Gate for signed-in-only pages (e.g. /account). Sends guests to /login with a
// ?next= so they return where they intended after authenticating.
export default function RequireAuth({ children }) {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings } = useAuth();
  const location = useLocation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <RouteGateSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to={loginPathWithNext(location)} replace />;
  }

  return children;
}
