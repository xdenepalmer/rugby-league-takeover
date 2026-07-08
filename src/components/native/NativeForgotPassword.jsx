/**
 * Native iOS "reset password request" surface. Reached via the isNativeApp()
 * branch in src/pages/ForgotPassword.jsx; the web page is untouched. Native
 * reskin ONLY — reuses the exact same auth path as the web page:
 *   base44.auth.resetPasswordRequest(email), then always shows the "sent"
 *   confirmation regardless of the result (no account enumeration).
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { lightImpact, successImpact } from "@/lib/native/haptics";
import { useKeyboardInset } from "@/lib/native/useKeyboardInset";

export default function NativeForgotPassword() {
  const { inset } = useKeyboardInset();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await base44.auth.resetPasswordRequest(email);
    } catch {
      // Always show success regardless
    } finally {
      setLoading(false);
      setSent(true);
      successImpact();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex min-h-dvh flex-col bg-background text-foreground nt-legible-floor">
      <div className="flex-1 overflow-y-auto nt-gutter-x pt-[calc(1.5rem+env(safe-area-inset-top,0px))]">
        <div className="mx-auto w-full max-w-sm nt-stack">
          <div className="pt-2">
            <div className="inline-flex h-14 w-14 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
              <Mail className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="nt-caption mt-5 font-bold uppercase tracking-[0.28em] text-primary">Rugby League Takeover</p>
            <h1 className="nt-large-title mt-1 text-foreground">Reset password</h1>
            <p className="nt-subhead mt-1 text-muted-foreground">We&apos;ll send you a link to reset it</p>
          </div>

          {sent ? (
            <div className="nt-stack">
              <div className="inline-flex h-12 w-12 items-center justify-center border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                <Sparkles className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="nt-body text-foreground">
                If an account exists with <span className="font-semibold text-accent">{email}</span>, you&apos;ll receive a password reset link shortly.
              </p>
              <p className="nt-footnote text-muted-foreground">
                Make sure to check your spam folder if it doesn&apos;t arrive in a few minutes.
              </p>
            </div>
          ) : (
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
          )}

          <p className="nt-footnote text-center text-muted-foreground">
            <Link to="/login" onClick={() => lightImpact()} className="inline-flex items-center gap-1.5 font-bold text-primary">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to log in</span>
            </Link>
          </p>
        </div>
      </div>

      {!sent && (
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
                  <span>Sending link…</span>
                </>
              ) : (
                <span>Send reset link</span>
              )}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
