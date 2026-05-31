import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
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

export default function Login() {
  const { checkUserAuth } = useAuth();
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
      window.location.assign(nextUrl);
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", nextUrl);
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Log in to your account"
      footer={
        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <Link to={`/register?next=${encodeURIComponent(nextUrl)}`} className="text-primary font-medium hover:underline">
            Create one
          </Link>
        </p>
      }
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* Google Button */}
        <motion.div variants={itemVariants}>
          <Button
            variant="outline"
            type="button"
            className="w-full h-12 text-sm font-bold uppercase tracking-wider rounded-none border-border bg-background/40 hover:bg-card hover:border-primary/40 relative overflow-hidden group/btn transition-all duration-300"
            onClick={handleGoogle}
          >
            {/* Shimmer Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 ease-out" />
            <GoogleIcon className="w-5 h-5 mr-3" />
            <span>Continue with Google</span>
          </Button>
        </motion.div>

        {/* Separator Divider */}
        <motion.div variants={itemVariants} className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/80" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
            <span className="bg-card px-4 text-muted-foreground">or email login</span>
          </div>
        </motion.div>

        {/* Error Notification Banner */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-semibold">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div variants={itemVariants} className="space-y-2">
            <Label htmlFor="email" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Email address</Label>
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

          <motion.div variants={itemVariants} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Password</Label>
              <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
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
          </motion.div>

          <motion.div variants={itemVariants} className="pt-2">
            <Button 
              type="submit" 
              className="w-full h-12 font-bold uppercase tracking-widest text-xs rounded-none bg-primary hover:bg-primary/95 text-primary-foreground shadow-[0_0_20px_rgba(249,115,22,0.25)] hover:shadow-[0_0_25px_rgba(249,115,22,0.45)] transition-all duration-300 flex items-center justify-center gap-2" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <span>Log in</span>
              )}
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </AuthLayout>
  );
}
