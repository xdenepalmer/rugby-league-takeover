/**
 * Native iOS sign-up surface. Reached via the isNativeApp() branch in
 * src/pages/Register.jsx; the web Register is untouched. Native reskin ONLY —
 * it reuses the exact same auth path as the web page:
 *   base44.auth.register → base44.auth.verifyOtp → setToken →
 *   useAuth().checkUserAuth → window.location.assign(nextUrl), plus
 *   base44.auth.resendOtp for the resend link. Google OAuth is omitted on
 *   native (the WebView blocks it), matching the web page's native behaviour.
 */
import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { UserPlus, Mail, Lock, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { errorImpact, lightImpact, successImpact, warningImpact } from "@/lib/native/haptics";
import { useKeyboardInset } from "@/lib/native/useKeyboardInset";

export default function NativeRegister() {
  const { checkUserAuth } = useAuth();
  const { inset } = useKeyboardInset();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [searchParams] = useSearchParams();
  const requestedNext = searchParams.get("next");
  const nextUrl = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/account";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      warningImpact();
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      successImpact();
      setShowOtp(true);
    } catch (err) {
      errorImpact();
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      await checkUserAuth();
      successImpact();
      window.location.assign(nextUrl);
    } catch (err) {
      errorImpact();
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      lightImpact();
      toast({
        title: "Code sent",
        description: "Check your email for the new code.",
      });
    } catch (err) {
      errorImpact();
      setError(err.message || "Failed to resend code");
    }
  };

  // Password strength calculation
  const pwdStrength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "bg-border" };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) return { score: 25, label: "Weak", color: "bg-destructive" };
    if (score === 2) return { score: 50, label: "Fair", color: "bg-orange-500" };
    if (score === 3) return { score: 75, label: "Good", color: "bg-amber-400" };
    return { score: 100, label: "Strong", color: "bg-emerald-500" };
  }, [password]);

  const passwordsMatch = useMemo(() => {
    return password && confirmPassword && password === confirmPassword;
  }, [password, confirmPassword]);

  // ── OTP verification step ──
  if (showOtp) {
    return (
      <div className="flex min-h-dvh flex-col bg-background text-foreground nt-legible-floor">
        <div className="flex-1 overflow-y-auto nt-gutter-x pt-[calc(1.5rem+env(safe-area-inset-top,0px))]">
          <div className="mx-auto w-full max-w-sm nt-stack">
            <div className="pt-2">
              <div className="inline-flex h-14 w-14 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
                <Mail className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="nt-caption mt-5 font-bold uppercase tracking-[0.28em] text-primary">Rugby League Takeover</p>
              <h1 className="nt-large-title mt-1 text-foreground">Verify email</h1>
              <p className="nt-subhead mt-1 text-muted-foreground">We&apos;ve sent a 6-digit code to {email}</p>
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-3 border border-destructive/25 bg-destructive/10 p-3.5 text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="nt-footnote font-semibold">{error}</span>
              </div>
            )}

            <div className="flex flex-col items-center">
              <div className="flex select-none justify-center font-mono">
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={setOtpCode}
                  autoFocus
                  autoComplete="one-time-code"
                >
                  <InputOTPGroup className="gap-2.5">
                    {[0, 1, 2, 3, 4, 5].map((idx) => (
                      <InputOTPSlot
                        key={idx}
                        index={idx}
                        className="h-14 w-11 rounded-none border border-border bg-card/40 text-lg font-bold transition-colors focus:border-primary focus:ring-1 focus:ring-primary/40"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="nt-caption mt-4 font-bold uppercase tracking-widest text-muted-foreground">Enter verification code</p>
            </div>

            <p className="nt-footnote text-center text-muted-foreground">
              Didn&apos;t receive the code?{" "}
              <button type="button" onClick={handleResend} className="font-bold text-primary">
                Resend code
              </button>
            </p>
          </div>
        </div>

        <div
          className="nt-material-thin nt-gutter-x shrink-0 border-t border-border/50 pt-3"
          style={{ paddingBottom: `max(calc(5.25rem + var(--safe-bottom)), ${inset > 0 ? inset + 12 : 0}px)` }}
        >
          <div className="mx-auto w-full max-w-sm">
            <button
              type="button"
              onClick={handleVerify}
              disabled={loading || otpCode.length < 6}
              className="ios-pressable flex min-h-12 w-full items-center justify-center gap-2 bg-primary text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying…</span>
                </>
              ) : (
                <span>Verify account</span>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Registration step ──
  return (
    <form onSubmit={handleSubmit} className="flex min-h-dvh flex-col bg-background text-foreground nt-legible-floor">
      <div className="flex-1 overflow-y-auto nt-gutter-x pt-[calc(1.5rem+env(safe-area-inset-top,0px))]">
        <div className="mx-auto w-full max-w-sm nt-stack">
          <div className="pt-2">
            <div className="inline-flex h-14 w-14 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
              <UserPlus className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="nt-caption mt-5 font-bold uppercase tracking-[0.28em] text-primary">Rugby League Takeover</p>
            <h1 className="nt-large-title mt-1 text-foreground">Create account</h1>
            <p className="nt-subhead mt-1 text-muted-foreground">Sign up for Rugby League Takeover</p>
          </div>

          {error && (
            <div role="alert" className="flex items-center gap-3 border border-destructive/25 bg-destructive/10 p-3.5 text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="nt-footnote font-semibold">{error}</span>
            </div>
          )}

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
              <label htmlFor="password" className="nt-caption font-bold uppercase tracking-widest text-muted-foreground">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
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
              {password && (
                <div className="space-y-1 pt-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div className={`h-full ${pwdStrength.color} transition-all duration-300`} style={{ width: `${pwdStrength.score}%` }} />
                  </div>
                  <p className="text-2xs font-bold uppercase tracking-wider text-right text-muted-foreground">
                    Strength: <span className="text-foreground">{pwdStrength.label}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="confirm" className="nt-caption font-bold uppercase tracking-widest text-muted-foreground">Confirm password</label>
                {passwordsMatch && (
                  <span className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Match
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="confirm"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="nt-material-thin min-h-11 w-full border border-border pl-10 pr-11 text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/40"
                  required
                />
                <button
                  type="button"
                  onClick={() => { lightImpact(); setShowConfirmPassword((v) => !v); }}
                  className="ios-pressable absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <p className="nt-footnote text-center text-muted-foreground">
            Already have an account?{" "}
            <Link
              to={`/login?next=${encodeURIComponent(nextUrl)}`}
              onClick={() => lightImpact()}
              className="font-bold text-primary"
            >
              Log in
            </Link>
          </p>
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
                <span>Creating account…</span>
              </>
            ) : (
              <span>Register</span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
