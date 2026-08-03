import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { RefreshCw, ShieldCheck, AlertTriangle, Wallet, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import {
  isActiveMember, hasLapsed, formatMembershipDate, membershipStatusLine, isExpiringSoon,
} from "@/lib/membership";

// Refresh a little before the server's 15-minute token TTL so the code on
// screen is never the one that just died in someone's hand at the bar.
const REFRESH_MS = 12 * 60 * 1000;

export default function MembershipCard({ compact = false }) {
  const { user, isAuthenticated } = useAuth();
  const [card, setCard] = useState(null);
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef(null);

  const active = isActiveMember(user);

  const loadCard = useCallback(async (silent = false) => {
    if (!isAuthenticated) return;
    if (!silent) setLoading(true);
    try {
      const { data } = await base44.functions.invoke("membershipCard", { action: "issue" });
      setCard(data);
      setError("");
      // The QR carries a URL to the staff check page, not a bare token: staff
      // scan it with the phone camera they already have and land straight on
      // a pass/fail screen — no scanner app, no barcode decoding in our code.
      const verifyUrl = `${window.location.origin}/verify-member?t=${encodeURIComponent(data.token)}`;
      const svg = await QRCode.toString(verifyUrl, {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
        color: { dark: "#0b0b0f", light: "#ffffff" },
      });
      setQr(svg);
    } catch (err) {
      // A member whose term lapsed between page load and this call gets the
      // honest reason rather than a broken card.
      setError(err?.data?.code === "not_a_member"
        ? "Your membership isn't active right now."
        : err?.message || "Couldn't load your card.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!active) return undefined;
    loadCard();
    timerRef.current = setInterval(() => loadCard(true), REFRESH_MS);
    // Coming back to a backgrounded phone at the door must not show a code
    // that expired while it was in a pocket.
    const onVisible = () => { if (!document.hidden) loadCard(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, loadCard]);

  if (!isAuthenticated) return null;

  if (!active) {
    const lapsed = hasLapsed(user);
    return (
      <div className="border border-border/50 bg-card/30 p-5 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-slate-600" />
        <p className="mt-2 font-display text-base uppercase tracking-wide text-foreground">
          {lapsed ? "Membership expired" : "Not a member yet"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {lapsed
            ? `Your membership ran out on ${formatMembershipDate(user?.membership_expires_at)}. Renew to get your card back.`
            : "RLT members get a digital card for bar discounts, a forum badge and member-only perks."}
        </p>
        <a
          href="/Store"
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 border border-primary bg-primary px-5 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {lapsed ? "Renew membership" : "Become a member"}
        </a>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-primary/40 bg-gradient-to-br from-primary/10 via-card/40 to-black/60">
      <div className="h-[3px] w-full bg-gradient-to-r from-primary via-accent to-primary" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-primary/80">Rugby League Takeover</p>
            <h3 className="mt-1 font-display text-xl uppercase leading-none tracking-wide text-foreground">
              Member Card
            </h3>
          </div>
          <span className="flex shrink-0 items-center gap-1 border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> Active
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="mx-auto w-[168px] shrink-0 bg-white p-2.5 sm:mx-0">
            {qr ? (
              <div className="[&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
            ) : (
              <div className="flex h-[148px] w-[148px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Member</p>
            <p className="truncate font-display text-lg uppercase text-foreground">
              {card?.member?.name || user?.full_name || "RLT Member"}
            </p>
            <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Member no.</p>
            <p className="font-mono text-base font-bold tabular-nums text-primary">
              {card?.member?.number || user?.membership_number || "—"}
            </p>
            <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Valid until</p>
            <p className="text-sm font-bold text-foreground">
              {formatMembershipDate(user?.membership_expires_at)}
            </p>
          </div>
        </div>

        {isExpiringSoon(user) && (
          <p className="mt-3 flex items-start gap-1.5 border border-amber-500/30 bg-amber-500/5 p-2 text-[10px] text-amber-300">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
            {membershipStatusLine(user)}
          </p>
        )}

        {error && (
          <p className="mt-3 flex items-start gap-1.5 border border-red-500/30 bg-red-500/5 p-2 text-[10px] text-red-300">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0" /> {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadCard()}
            disabled={loading}
            className="flex min-h-11 items-center gap-1.5 border border-border/50 bg-black/30 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh code
          </button>
          <WalletButtons onUnavailable={() => toast({
            title: "Wallet passes are coming",
            description: "Apple and Google Wallet cards switch on as soon as the passes are provisioned. Your QR code works at the bar right now.",
          })} />
        </div>

        <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
          Show this code at the bar for member discounts. It refreshes every few minutes,
          so a screenshot won't work — open the app when you order.
        </p>
        {!compact && (
          <p className="mt-1 text-[10px] text-slate-600">
            Member since {formatMembershipDate(card?.member?.started_at || user?.membership_started_at)}
          </p>
        )}
      </div>
    </div>
  );
}

// The wallet buttons appear only when the backend reports the passes are
// provisioned. Rendering a dead "Add to Apple Wallet" button would be a
// promise the app can't keep.
function WalletButtons({ onUnavailable }) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let cancelled = false;
    base44.functions
      .invoke("membershipPass", { action: "status" })
      .then(({ data }) => { if (!cancelled) setStatus(data); })
      .catch(() => { if (!cancelled) setStatus({ apple: false, google: false }); });
    return () => { cancelled = true; };
  }, []);

  const open = async (wallet) => {
    try {
      const { data } = await base44.functions.invoke("membershipPass", { action: "issue", wallet });
      if (data?.url) window.open(data.url, "_blank", "noopener");
      else onUnavailable?.();
    } catch {
      onUnavailable?.();
    }
  };

  if (!status?.apple && !status?.google) return null;
  return (
    <>
      {status.apple && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => open("apple")}
          className="flex min-h-11 items-center gap-1.5 border border-border/50 bg-black px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-colors hover:border-white/40"
        >
          <Wallet className="h-3 w-3" /> Apple Wallet
        </motion.button>
      )}
      {status.google && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => open("google")}
          className="flex min-h-11 items-center gap-1.5 border border-border/50 bg-black/30 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-200 transition-colors hover:border-white/40"
        >
          <Wallet className="h-3 w-3" /> Google Wallet
        </motion.button>
      )}
    </>
  );
}
