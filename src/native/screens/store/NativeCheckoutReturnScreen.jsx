import { useEffect } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, Clock3, HelpCircle, Loader2 } from "lucide-react";
import { useCheckoutReturn } from "@/hooks/use-checkout-return";
import { closeInAppBrowser } from "@/lib/native/open-external";
import { emitHaptic } from "@/lib/native/haptic-events";
import NativeTopBar from "../../components/NativeTopBar.jsx";

const COPY = {
  confirming: {
    icon: Loader2,
    tone: "text-primary",
    title: "Confirming your payment…",
    body: "Hold tight — we're checking with Stripe. This usually takes a second.",
  },
  confirmed: {
    icon: CheckCircle2,
    tone: "text-emerald-400",
    title: "Payment confirmed",
    body: "You're locked in. Your order is in the books and will appear in your order history.",
  },
  pending: {
    icon: Clock3,
    tone: "text-amber-400",
    title: "Payment processing",
    body: "Stripe accepted the checkout but the payment is still settling. Your cart is untouched — the order appears in your history the moment it confirms.",
  },
  cancelled: {
    icon: XCircle,
    tone: "text-amber-400",
    title: "Checkout cancelled",
    body: "This checkout was closed before payment was completed, and your cart is exactly as you left it. If you did complete a payment, check your order history or email receipt.",
  },
  unverified: {
    icon: HelpCircle,
    tone: "text-red-400",
    title: "We couldn't verify this payment",
    body: "This link didn't match a checkout we can confirm. If you completed payment, your order will still arrive via Stripe's confirmation — check your order history or email receipt. Your cart has not been changed.",
  },
  // Deploy skew: an older createCheckout deployment returns without a
  // session_id at all. That's not a failure signal — the webhook still
  // confirms the order — so show a soft "confirming" state, never red.
  confirming_offline: {
    icon: Clock3,
    tone: "text-amber-400",
    title: "Order confirming",
    body: "Your payment is being confirmed by Stripe. Check My Orders in a moment — the order appears there as soon as it's confirmed. Your cart has not been changed.",
  },
};

/**
 * Universal-link landing for Stripe checkout returns. The URL proves only
 * navigation — payment truth comes from verifyCheckoutReturn (a server-side
 * Stripe session check) with the webhook remaining the sole writer of order
 * state. All of that policy lives in the shared useCheckoutReturn hook, which
 * this screen and the web CheckoutReturn page both drive their UI from; the
 * cart is cleared exactly once, and only after verification says the session
 * is paid. This screen adds the native-only trimmings: closing the lingering
 * in-app browser sheet and haptic feedback.
 */
export default function NativeCheckoutReturnScreen({ status }) {
  const { state, cancelled } = useCheckoutReturn({ status });

  // The system-browser sheet may still be open under the app.
  useEffect(() => {
    closeInAppBrowser();
    if (cancelled) emitHaptic("mutation.warning");
  }, [cancelled]);

  // Payment-confirmed haptic, fired when the shared hook lands on "confirmed".
  useEffect(() => {
    if (state === "confirmed") emitHaptic("save.success");
  }, [state]);

  const copy = COPY[state];
  const Icon = copy.icon;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <NativeTopBar title="Checkout" fallback="/store" />
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 pt-16 text-center">
        <Icon className={`h-14 w-14 ${copy.tone} ${state === "confirming" ? "animate-spin" : ""}`} aria-hidden="true" />
        <h1 className="pt-4 font-display text-2xl font-bold uppercase tracking-widest" role="status">
          {copy.title}
        </h1>
        <p className="pt-2 text-sm text-muted-foreground">{copy.body}</p>
        {state !== "confirming" && (
          <div className="grid w-full gap-2 pt-6">
            {(state === "confirmed" || state === "pending" || state === "unverified" || state === "confirming_offline") && (
              <Link
                to="/account/orders"
                className="ios-pressable flex min-h-12 items-center justify-center bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground"
              >
                View my orders
              </Link>
            )}
            <Link
              to="/store"
              className="ios-pressable flex min-h-12 items-center justify-center border border-border text-sm font-bold uppercase tracking-widest"
            >
              Back to the store
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
