import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
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
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Reset password"
      subtitle="We'll send you a link to reset it"
      footer={
        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link to="/login" className="text-primary font-bold hover:underline transition-colors inline-flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to log in</span>
          </Link>
        </p>
      }
    >
      {sent ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="mx-auto inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-none shadow-sm mb-2">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            If an account exists with <span className="font-semibold text-accent">{email}</span>, you'll receive a password reset link shortly.
          </p>
          <p className="text-xs text-muted-foreground">
            Make sure to check your spam folder if it doesn't arrive in a few minutes.
          </p>
        </motion.div>
      ) : (
        <motion.form 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          onSubmit={handleSubmit} 
          className="space-y-5"
        >
          <div className="space-y-2">
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
          </div>
          <Button 
            type="submit" 
            className="w-full h-12 font-bold uppercase tracking-widest text-xs rounded-none bg-primary hover:bg-primary/95 text-primary-foreground shadow-[0_0_20px_rgba(249,115,22,0.25)] hover:shadow-[0_0_25px_rgba(249,115,22,0.45)] transition-all flex items-center justify-center gap-2" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span>Sending link...</span>
              </>
            ) : (
              <span>Send reset link</span>
            )}
          </Button>
        </motion.form>
      )}
    </AuthLayout>
  );
}
