/**
 * Native iOS "set a new password" surface. Reached via the isNativeApp() branch
 * in src/pages/ResetPassword.jsx; the web page is untouched. Native reskin ONLY
 * — reuses the exact same auth path as the web page: it waits for the Supabase
 * recovery session (detectSessionInUrl consumes the hash tokens), then calls
 * base44.auth.resetPassword({ newPassword }) and redirects to /account.
 */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/api/supabaseClient";
import { errorImpact, lightImpact, successImpact, warningImpact } from "@/lib/native/haptics";
import { useKeyboardInset } from "@/lib/native/useKeyboardInset";

function AuthShell({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground nt-legible-floor">
      <div className="flex-1 overflow-y-auto nt-gutter-x pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto w-full max-w-sm nt-stack">
          <div className="pt-2">
            <div className="inline-flex h-14 w-14 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="nt-caption mt-5 font-bold uppercase tracking-[0.28em] text-primary">Rugby League Takeover</p>
            <h1 className="nt-large-title mt-1 text-foreground">{title}</h1>
            {subtitle && <p className="nt-subhead mt-1 text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function NativeResetPassword() {
  const { inset } = useKeyboardInset();
  // The reset email signs the user in via tokens in the URL hash, which
  // supabase-js consumes asynchronously (detectSessionInUrl). So: wait
  // briefly for a session instead of gating on a query param.
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (session) {
        setHasSession(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data?.session) {
        setHasSession(true);
        setChecking(false);
      }
    });

    // Give detectSessionInUrl a few seconds to process the hash tokens
    // before declaring the link invalid.
    const timeout = window.setTimeout(() => {
      if (!cancelled) setChecking(false);
    }, 4000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      warningImpact();
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      warningImpact();
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.resetPassword({ newPassword });
      successImpact();
      setDone(true);
      // The recovery link signed them in; with the password now changed,
      // take them straight into their account.
      window.setTimeout(() => {
        window.location.href = "/account";
      }, 1500);
    } catch (err) {
      errorImpact();
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <AuthShell icon={Loader2} title="Checking your link" subtitle="One moment…">
        <div className="flex justify-center py-6" role="status" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="sr-only">Verifying your password reset link</span>
        </div>
      </AuthShell>
    );
  }

  if (!hasSession) {
    return (
      <AuthShell icon={AlertTriangle} title="Invalid or expired reset link" subtitle="This password reset link is no longer valid">
        <p className="nt-body text-foreground">
          Reset links can only be used once and expire after a short time. Please request a new password reset email.
        </p>
        <p className="nt-footnote">
          <Link to="/forgot-password" onClick={() => lightImpact()} className="font-bold text-primary">
            Request a new link
          </Link>
        </p>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell icon={CheckCircle2} title="Password updated" subtitle="You're signed in with your new password">
        <p className="nt-body text-foreground" role="status">
          Taking you to your account…
        </p>
      </AuthShell>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-dvh flex-col bg-background text-foreground nt-legible-floor">
      <div className="flex-1 overflow-y-auto nt-gutter-x pt-[calc(1.5rem+env(safe-area-inset-top,0px))]">
        <div className="mx-auto w-full max-w-sm nt-stack">
          <div className="pt-2">
            <div className="inline-flex h-14 w-14 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
              <Lock className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="nt-caption mt-5 font-bold uppercase tracking-[0.28em] text-primary">Rugby League Takeover</p>
            <h1 className="nt-large-title mt-1 text-foreground">New password</h1>
            <p className="nt-subhead mt-1 text-muted-foreground">Enter your new password below</p>
          </div>

          {error && (
            <div role="alert" className="flex items-center gap-3 border border-destructive/25 bg-destructive/10 p-3.5 text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="nt-footnote font-semibold">{error}</span>
            </div>
          )}

          <div className="nt-stack">
            <div className="space-y-1.5">
              <label htmlFor="password" className="nt-caption font-bold uppercase tracking-widest text-muted-foreground">New password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="nt-material-thin min-h-11 w-full border border-border pl-10 pr-3.5 text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/40"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm" className="nt-caption font-bold uppercase tracking-widest text-muted-foreground">Confirm password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="nt-material-thin min-h-11 w-full border border-border pl-10 pr-3.5 text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/40"
                  required
                  minLength={8}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

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
                <span>Resetting…</span>
              </>
            ) : (
              <span>Reset password</span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
