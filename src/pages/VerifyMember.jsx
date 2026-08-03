import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldX, Loader2, Search, ArrowLeft, ScanLine } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { formatMembershipDate } from "@/lib/membership";

// Bar-side membership check.
//
// The member's QR encodes a URL to THIS page carrying a short-lived signed
// token, so staff scan it with the phone camera they already have — no scanner
// app, no barcode library, no training. The page is staff-gated because
// whether someone pays for a membership is not public information about them.
//
// The token only proves WHO. Membership itself is re-read from the database on
// every check, so a refunded or revoked card fails immediately no matter what
// the phone in front of you is showing.
export default function VerifyMember() {
  const [params, setParams] = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [manual, setManual] = useState("");

  const isStaff = user?.role === "admin" || user?.role === "moderator";
  const token = params.get("t") || "";

  const check = useCallback(async (payload) => {
    setChecking(true);
    setResult(null);
    try {
      const { data } = await base44.functions.invoke("membershipCard", { action: "verify", ...payload });
      setResult(data);
    } catch (err) {
      setResult({ valid: false, reason: err?.message || "Couldn't reach the server" });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (token && isStaff) check({ token });
  }, [token, isStaff, check]);

  if (isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!isAuthenticated || !isStaff) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-6 text-center">
        <div>
          <ShieldX className="mx-auto h-10 w-10 text-slate-600" />
          <h1 className="mt-3 font-display text-xl uppercase tracking-wide text-foreground">Staff only</h1>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            {isAuthenticated
              ? "This screen is for RLT staff checking member cards at the bar."
              : "Sign in with your staff account to check member cards."}
          </p>
          {!isAuthenticated && (
            <Link
              to="/login"
              className="mt-5 inline-flex min-h-11 items-center justify-center border border-primary bg-primary px-6 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground"
            >
              Sign in
            </Link>
          )}
        </div>
      </main>
    );
  }

  const valid = result?.valid === true;
  const decided = !!result && !checking;

  return (
    <main className="min-h-dvh bg-background px-5 py-10 text-foreground">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-primary">
          <ArrowLeft className="h-3 w-3" /> Back to site
        </Link>

        <h1 className="mt-5 font-display text-2xl uppercase tracking-wide">Member check</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Scan the member's QR code with your camera, or look them up by member number.
        </p>

        {checking && (
          <div className="mt-6 flex items-center gap-2 border border-border/40 bg-card/30 p-5">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Checking…</span>
          </div>
        )}

        {decided && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`mt-6 border-2 p-6 text-center ${
              valid
                ? "border-emerald-500/60 bg-emerald-500/10"
                : "border-red-500/60 bg-red-500/10"
            }`}
          >
            {valid ? (
              <ShieldCheck className="mx-auto h-14 w-14 text-emerald-400" />
            ) : (
              <ShieldX className="mx-auto h-14 w-14 text-red-400" />
            )}
            <p className={`mt-3 font-display text-3xl uppercase tracking-wide ${valid ? "text-emerald-300" : "text-red-300"}`}>
              {valid ? "Valid member" : "Not valid"}
            </p>
            {result.member?.name && (
              <p className="mt-2 text-lg font-bold text-foreground">{result.member.name}</p>
            )}
            {result.member?.number && (
              <p className="font-mono text-sm text-slate-400">{result.member.number}</p>
            )}
            {valid && result.member?.expires_at && (
              <p className="mt-2 text-xs text-slate-400">
                Valid until {formatMembershipDate(result.member.expires_at)}
              </p>
            )}
            {!valid && result.reason && (
              <p className="mt-2 text-sm text-red-200">{result.reason}</p>
            )}
            <button
              type="button"
              onClick={() => { setResult(null); setParams({}, { replace: true }); }}
              className="mt-5 inline-flex min-h-11 items-center gap-1.5 border border-border/50 px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 hover:text-foreground"
            >
              <ScanLine className="h-3 w-3" /> Check another
            </button>
          </motion.div>
        )}

        <form
          className="mt-6 border border-border/40 bg-card/20 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const number = manual.trim();
            if (number) check({ number });
          }}
        >
          <label htmlFor="member-number" className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Look up by member number
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="member-number"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="RLT-001234"
              autoCapitalize="characters"
              className="h-11 min-w-0 flex-1 border border-border/40 bg-secondary/35 px-3 font-mono text-base text-foreground focus-visible:border-primary/65 focus-visible:outline-none"
            />
            <button
              type="submit"
              disabled={checking || !manual.trim()}
              className="flex h-11 shrink-0 items-center gap-1.5 border border-primary bg-primary px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-50"
            >
              <Search className="h-3.5 w-3.5" /> Check
            </button>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Use this when a code won't scan. The result always reflects live membership,
            not what's printed on the card.
          </p>
        </form>
      </div>
    </main>
  );
}
