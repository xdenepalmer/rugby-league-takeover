import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
  </div>
);

// Gate for admin-only pages (/admin/*). Guests are sent to login; signed-in
// non-admins get a clear "no access" message rather than a silent redirect.
export default function RequireAdmin({ children }) {
  const { isAuthenticated, isAdmin, isLoadingAuth, isLoadingPublicSettings } = useAuth();
  const location = useLocation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <Spinner />;
  }

  if (!isAuthenticated) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 text-center text-foreground">
        <div className="max-w-md border border-border bg-card p-8">
          <h1 className="font-display text-4xl uppercase">Admin access only</h1>
          <p className="mt-4 text-muted-foreground">Your account doesn't have permission to manage this site.</p>
          <Button asChild className="mt-6 rounded-none"><Link to="/">Back to site</Link></Button>
        </div>
      </div>
    );
  }

  return children;
}
