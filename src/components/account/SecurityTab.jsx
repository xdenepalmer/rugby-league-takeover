import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, LogOut, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const getStrength = (pw) => {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
};

export default function SecurityTab() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = getStrength(newPassword);
  const strengthColor = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'][strength];
  const strengthTextColor = ['', 'text-red-400', 'text-orange-400', 'text-yellow-400', 'text-emerald-400'][strength];
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];

  const changeMutation = useMutation({
    mutationFn: () => base44.auth.changePassword({ userId: user.id, currentPassword, newPassword }),
    onSuccess: () => {
      toast({ title: "Password changed", description: "Use your new password next time you log in." });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => base44.auth.resetPasswordRequest(user.email),
    onSuccess: () => toast({ title: "Reset email sent", description: `Check ${user.email} for a reset link.` }),
  });

  const submit = (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("New passwords do not match."); return; }
    changeMutation.mutate();
  };

  return (
    <div className="grid gap-6">
      <form onSubmit={submit} className="grid gap-4 border border-border bg-card p-6">
        <h3 className="flex items-center gap-2 font-display text-2xl uppercase"><KeyRound className="h-5 w-5 text-primary" /> Change password</h3>
        {error && <p className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Current password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type={showCurrent ? 'text' : 'password'} autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="h-12 pl-10 pr-10 rounded-none border-border bg-background text-sm" required />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label={showCurrent ? 'Hide password' : 'Show password'}>
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid gap-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">New password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type={showNew ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-12 pl-10 pr-10 rounded-none border-border bg-background text-sm" required />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label={showNew ? 'Hide password' : 'Show password'}>
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 transition-all duration-300 ${
                      i <= strength ? strengthColor : 'bg-muted/20'
                    }`} />
                  ))}
                </div>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${strengthTextColor}`}>{strengthLabel}</p>
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Confirm new password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type={showConfirm ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12 pl-10 pr-10 rounded-none border-border bg-background text-sm" required />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && (
              <p className={`text-[10px] font-bold uppercase tracking-wider ${
                confirmPassword === newPassword ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {confirmPassword === newPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={changeMutation.isPending} className="rounded-none bg-primary hover:bg-primary/90 shadow-[0_0_15px_hsl(var(--primary)/0.2)] hover:shadow-[0_0_25px_hsl(var(--primary)/0.4)] transition-all duration-300">
            {changeMutation.isPending ? "Updating..." : "Update password"}
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-3 border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-foreground">Signed in as {user?.email}</p>
          <p className="text-sm text-muted-foreground">Forgot your password or signed up with Google? Send yourself a reset link.</p>
        </div>
        <Button variant="outline" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending} className="rounded-none">
          <Mail className="mr-2 h-4 w-4" /> {resetMutation.isPending ? "Sending..." : "Email reset link"}
        </Button>
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => base44.auth.logout("/")} className="rounded-none text-muted-foreground hover:text-foreground">
          <LogOut className="mr-2 h-4 w-4" /> Log out
        </Button>
      </div>
    </div>
  );
}
