import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, LogIn, ShieldCheck, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DeleteAccount() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);

  const deleteAccount = async (event) => {
    event.preventDefault();
    if (confirmation !== "DELETE" || isDeleting || isAdmin) return;
    setError("");
    setIsDeleting(true);
    try {
      await base44.functions.invoke("deleteAccount", { confirmation });
      setDeleted(true);
      await base44.auth.logout();
    } catch (deleteError) {
      setError(deleteError?.message || "We could not delete the account. Please try again or contact support.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="relative min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-[calc(7.25rem+env(safe-area-inset-top,0px))] md:px-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-primary">Privacy control</p>
        <h1 className="mt-3 font-display text-3xl uppercase leading-none tracking-wide md:text-5xl">Delete your account</h1>
        <p className="mt-5 text-sm leading-7 text-muted-foreground">
          This page is the official account-deletion route for Rugby League Takeover on web, Android and iOS.
          You can delete your account without contacting support.
        </p>

        <section className="mt-8 border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 font-display text-xl uppercase">
            <Trash2 className="h-5 w-5 text-destructive" /> What will be deleted
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li>Your login, profile details, preferences, badges and reward history.</li>
            <li>Your travel-interest forms, product alerts, testimonials, tips and push-notification tokens.</li>
            <li>Your forum text, images and identifying links; reactions on other posts are removed.</li>
          </ul>
          <div className="mt-5 border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Limited records we retain</p>
            <p className="mt-1">
              Completed order and payment records may be retained where required for refunds, accounting, tax,
              fraud prevention or legal obligations. They are detached from your app account and are not used for marketing.
            </p>
          </div>
        </section>

        {deleted ? (
          <section className="mt-6 border border-emerald-500/30 bg-emerald-500/10 p-6">
            <h2 className="flex items-center gap-2 font-display text-xl uppercase text-emerald-300">
              <CheckCircle2 className="h-5 w-5" /> Account deleted
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Your account and associated app data have been removed.</p>
            <Button asChild className="mt-5 rounded-none"><Link to="/">Return home</Link></Button>
          </section>
        ) : !isAuthenticated ? (
          <section className="mt-6 border border-border bg-card p-6">
            <h2 className="font-display text-xl uppercase">Sign in to continue</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Sign in to verify ownership, then return to this page. If you cannot access the account, email{" "}
              <a className="text-primary underline" href="mailto:support@rugbyleaguetakeover.com">support@rugbyleaguetakeover.com</a>.
            </p>
            <Button asChild className="mt-5 rounded-none">
              <Link to="/login?next=%2Fdelete-account"><LogIn className="mr-2 h-4 w-4" /> Sign in</Link>
            </Button>
          </section>
        ) : isAdmin ? (
          <section className="mt-6 border border-primary/30 bg-primary/10 p-6">
            <h2 className="flex items-center gap-2 font-display text-xl uppercase"><ShieldCheck className="h-5 w-5" /> Administrator protected</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              For platform safety, an administrator account cannot delete itself. Another administrator must first change its role.
            </p>
          </section>
        ) : (
          <form onSubmit={deleteAccount} className="mt-6 border border-destructive/40 bg-card p-6">
            <h2 className="font-display text-xl uppercase">Permanently delete {user?.email}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This cannot be undone. Type <strong className="text-foreground">DELETE</strong> below to confirm.
            </p>
            <div className="mt-5 grid gap-2">
              <Label htmlFor="delete-confirmation" className="text-xs font-bold uppercase tracking-widest">Confirmation</Label>
              <Input
                id="delete-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                className="h-12 rounded-none"
                placeholder="Type DELETE"
              />
            </div>
            {error && <p role="alert" className="mt-4 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              variant="destructive"
              disabled={confirmation !== "DELETE" || isDeleting}
              className="mt-5 rounded-none"
            >
              <Trash2 className="mr-2 h-4 w-4" /> {isDeleting ? "Deleting account..." : "Permanently delete account"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-xs leading-6 text-muted-foreground">
          Privacy questions: <a className="text-primary underline" href="mailto:support@rugbyleaguetakeover.com">support@rugbyleaguetakeover.com</a>
          {" · "}<Link className="text-primary underline" to="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </main>
  );
}
