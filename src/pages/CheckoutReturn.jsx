import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, Clock3, HelpCircle, Loader2 } from "lucide-react";
import { useCheckoutReturn } from "@/hooks/use-checkout-return";

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
    body: "You're locked in. We've emailed your receipt, and your order now appears in your order history.",
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
    body: "No charge was made. Your cart is exactly as you left it whenever you're ready.",
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
 * Verified web landing for Stripe checkout returns (routed from
 * /store/checkout/success and /store/checkout/cancel). This replaces the old
 * URL-trusting `/store?success=true` banner: the URL proves navigation only,
 * and every claim here is driven by the shared useCheckoutReturn hook, which
 * asks verifyCheckoutReturn server-side before confirming anything or clearing
 * the cart. The webhook remains the sole writer of order state.
 */
export default function CheckoutReturn({ status }) {
  const { state } = useCheckoutReturn({ status });
  const copy = COPY[state];
  const Icon = copy.icon;
  const showOrdersLink =
    state === "confirmed" || state === "pending" || state === "unverified" || state === "confirming_offline";

  return (
    <main className="relative min-h-dvh bg-background px-5 pb-24 pt-[calc(7.25rem+env(safe-area-inset-top,0px))] text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-1 text-center">
        <Icon
          className={`h-14 w-14 ${copy.tone} ${state === "confirming" ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
        <h1 className="pt-4 font-display text-2xl font-bold uppercase tracking-widest" role="status">
          {copy.title}
        </h1>
        <p className="pt-2 text-sm text-muted-foreground">{copy.body}</p>
        {state !== "confirming" && (
          <div className="grid w-full gap-2 pt-6">
            {showOrdersLink && (
              <Link
                to="/account"
                className="flex min-h-12 items-center justify-center bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground transition-colors hover:bg-primary/90"
              >
                View my orders
              </Link>
            )}
            <Link
              to="/store"
              className="flex min-h-12 items-center justify-center border border-border text-sm font-bold uppercase tracking-widest transition-colors hover:border-primary hover:text-primary"
            >
              Back to the store
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
