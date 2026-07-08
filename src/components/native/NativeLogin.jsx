/**
 * Native iOS sign-in surface. Reached via the isNativeApp() branch in
 * src/pages/Login.jsx; the web Login is untouched. This is a native reskin
 * ONLY — it reuses the exact same auth path as the web page:
 *   base44.auth.loginViaEmailPassword → setToken → useAuth().checkUserAuth →
 *   window.location.assign(nextUrl)
 * Google OAuth is intentionally omitted: inside the WebView Google blocks
 * logins, so email/password is the app sign-in path (same rationale the web
 * page uses to hide the Google button on native).
 */
import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LogIn, Mail, Lock, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { errorImpact, lightImpact, successImpact } from "@/lib/native/haptics";
import { useKeyboardInset } from "@/lib/native/useKeyboardInset";

export default function NativeLogin() {
  const { checkUserAuth } = useAuth();
  const { inset } = useKeyboardInset();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const requestedNext = searchParams.get("next");
  const nextUrl = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/account";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.loginViaEmailPassword(email, password);
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      await checkUserAuth();
      successImpact();
      window.location.assign(nextUrl);
    } catch (err) {
      errorImpact();
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex min-h-dvh flex-col bg-background text-foreground nt-legible-floor">
      <div className="flex-1 overflow-y-auto nt-gutter-x pt-[calc(1.5rem+env(safe-area-inset-top,0px))]">
        <div className="mx-auto w-full max-w-sm nt-stack">
          {/* Brand mark + title */}
          <div className="pt-2">
            <div className="inline-flex h-14 w-14 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
              <LogIn className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="nt-caption mt-5 font-bold uppercase tracking-[0.28em] text-primary">Rugby League Takeover</p>
            <h1 className="nt-large-title mt-1 text-foreground">Welcome back</h1>
            <p className="nt-subhead mt-1 text-muted-foreground">Log in to your account</p>
          </div>

          {/* Error */}
          {error && (
            <div role="alert" className="flex items-center gap-3 border border-destructive/25 bg-destructive/10 p-3.5 text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="nt-footnote font-semibold">{error}</span>
            </div>
          )}

          {/* Fields */}
          <div className="nt-stack">
            <div className="space-y-1.5">
              <label htmlFor="email" className="nt-caption font-bold uppercase tracking-widest text-muted-foreground">Email address</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="nt-material-thin min-h-11 w-full border border-border pl-10 pr-3.5 text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/40"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="nt-caption font-bold uppercase tracking-widest text-muted-foreground">Password</label>
                <Link to="/forgot-password" onClick={() => lightImpact()} className="nt-caption font-bold text-primary">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="nt-material-thin min-h-11 w-full border border-border pl-10 pr-11 text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/40"
                  required
                />
                <button
                  type="button"
                  onClick={() => { lightImpact(); setShowPassword((v) => !v); }}
                  className="ios-pressable absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Cross-link */}
          <p className="nt-footnote text-center text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              to={`/register?next=${encodeURIComponent(nextUrl)}`}
              onClick={() => lightImpact()}
              className="font-bold text-primary"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* Keyboard-aware sticky primary button */}
      <div
        className="nt-material-thin nt-gutter-x shrink-0 border-t border-border/50 pt-3"
        style={{ paddingBottom: `max(calc(5.25rem + var(--safe-bottom)), ${inset > 0 ? inset + 12 : 0}px)` }}
      >
        <div className="mx-auto w-full max-w-sm">
          <button
            type="submit"
            disabled={loading}
            className="ios-pressable flex min-h-12 w-full items-center justify-center gap-2 bg-primary text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Logging in…</span>
              </>
            ) : (
              <span>Log in</span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
