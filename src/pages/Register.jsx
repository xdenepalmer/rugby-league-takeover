import React, { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { AnimatePresence, motion } from "framer-motion";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { canUseGoogleOAuth } from "@/lib/native/auth-guards";
import { isNativeApp } from "@/lib/native/native-env";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";

// Framer motion variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 20 } }
};

export default function Register() {
  const { checkUserAuth } = useAuth();
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
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setShowOtp(true);
    } catch (err) {
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
      window.location.assign(nextUrl);
    } catch (err) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({
        title: "Code sent",
        description: "Check your email for the new code.",
      });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  const googleAvailable = canUseGoogleOAuth({ isNative: isNativeApp() });
  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", nextUrl);
  };

  // Password strength calculation
  const pwdStrength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "bg-border" };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) return { score: 25, label: "Weak", color: "bg-destructive animate-pulse" };
    if (score === 2) return { score: 50, label: "Fair", color: "bg-orange-500" };
    if (score === 3) return { score: 75, label: "Good", color: "bg-amber-400" };
    return { score: 100, label: "Strong", color: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" };
  }, [password]);

  // Check matching state
  const passwordsMatch = useMemo(() => {
    return password && confirmPassword && password === confirmPassword;
  }, [password, confirmPassword]);

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title="Verify email"
        subtitle={`We've sent a 6-digit code to ${email}`}
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="font-semibold">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div variants={itemVariants} className="flex flex-col items-center justify-center">
            <div className="flex justify-center select-none font-mono">
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
                      className="w-12 h-14 text-lg font-bold border border-border bg-background/40 hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-none transition-all duration-300"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-4 font-bold">Enter Verification Code</p>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Button
              className="w-full h-12 font-bold uppercase tracking-widest text-xs rounded-none bg-primary hover:bg-primary/95 text-primary-foreground shadow-[0_0_20px_rgba(249,115,22,0.25)] hover:shadow-[0_0_25px_rgba(249,115,22,0.45)] transition-all flex items-center justify-center gap-2"
              onClick={handleVerify}
              disabled={loading || otpCode.length < 6}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Verify Account</span>
              )}
            </Button>
          </motion.div>

          <motion.p variants={itemVariants} className="text-center text-sm text-muted-foreground">
            Didn't receive the code?{" "}
            <button onClick={handleResend} className="text-primary font-bold hover:underline transition-all">
              Resend Code
            </button>
          </motion.p>
        </motion.div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create account"
      subtitle="Sign up for Rugby League Takeover"
      footer={
        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link to={`/login?next=${encodeURIComponent(nextUrl)}`} className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </p>
      }
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-5"
      >
        {/* Google Button — web only: inside the native shell Google blocks
            WebView logins, so email/password is the app sign-up path */}
        {googleAvailable && (
          <>
            <motion.div variants={itemVariants}>
              <Button
                variant="outline"
                type="button"
                className="w-full h-12 text-sm font-bold uppercase tracking-wider rounded-none border-border bg-background/40 hover:bg-card hover:border-primary/40 relative overflow-hidden group/btn transition-all duration-300"
                onClick={handleGoogle}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 ease-out" />
                <GoogleIcon className="w-5 h-5 mr-3" />
                <span>Sign up with Google</span>
              </Button>
            </motion.div>

            {/* Divider */}
            <motion.div variants={itemVariants} className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/80" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                <span className="bg-card px-4 text-muted-foreground">or register with email</span>
              </div>
            </motion.div>
          </>
        )}

        {/* Error notification */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="p-3.5 bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-semibold">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div variants={itemVariants} className="space-y-2">
            <Label htmlFor="email" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12 rounded-none bg-background/30 border-border focus-visible:ring-primary focus-visible:border-primary/50 text-foreground"
                required
              />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-2 relative">
            <Label htmlFor="password" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12 rounded-none bg-background/30 border-border focus-visible:ring-primary focus-visible:border-primary/50 text-foreground"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Real-time Password Strength meter */}
            {password && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-1 pt-1.5"
              >
                <div className="h-1.5 w-full bg-border overflow-hidden rounded-full">
                  <div className={`h-full ${pwdStrength.color} transition-all duration-300`} style={{ width: `${pwdStrength.score}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider text-right">
                  Strength: <span className="text-foreground">{pwdStrength.label}</span>
                </p>
              </motion.div>
            )}
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="confirm" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Confirm Password</Label>
              {passwordsMatch && (
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Match
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="confirm"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 pr-10 h-12 rounded-none bg-background/30 border-border focus-visible:ring-primary focus-visible:border-primary/50 text-foreground"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="pt-3">
            <Button 
              type="submit" 
              className="w-full h-12 font-bold uppercase tracking-widest text-xs rounded-none bg-primary hover:bg-primary/95 text-primary-foreground shadow-[0_0_20px_rgba(249,115,22,0.25)] hover:shadow-[0_0_25px_rgba(249,115,22,0.45)] transition-all flex items-center justify-center gap-2" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Register</span>
              )}
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </AuthLayout>
  );
}
