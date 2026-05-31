import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, LogOut, Mail } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SecurityTab() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

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
          <Label>Current password</Label>
          <Input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="rounded-none" required />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>New password</Label>
            <Input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-none" required />
          </div>
          <div className="grid gap-2">
            <Label>Confirm new password</Label>
            <Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="rounded-none" required />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={changeMutation.isPending} className="rounded-none bg-primary hover:bg-primary/90">
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
