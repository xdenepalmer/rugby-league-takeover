import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { writeCart } from "@/lib/cart-store";
import { closeInAppBrowser } from "@/lib/native/open-external";
import { emitHaptic } from "@/lib/native/haptic-events";
import NativeTopBar from "../../components/NativeTopBar.jsx";

/**
 * Universal-link landing for Stripe checkout returns. The URL is only a UI
 * signal — the Stripe webhook remains the sole authority on payment state;
 * this screen refreshes the user's orders (webhook-written) and points at
 * order history for the confirmed status. Success clears the cart exactly
 * like the web return does; cancel keeps it.
 */
export default function NativeCheckoutReturnScreen({ status }) {
  const queryClient = useQueryClient();
  const success = status === "success";

  useEffect(() => {
    // The system-browser sheet may still be open under the app.
    closeInAppBrowser();
    if (success) {
      emitHaptic("save.success");
      writeCart([]);
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } else {
      emitHaptic("mutation.warning");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <NativeTopBar title="Checkout" fallback="/store" />
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 pt-16 text-center">
        {success ? (
          <CheckCircle2 className="h-14 w-14 text-emerald-400" aria-hidden="true" />
        ) : (
          <XCircle className="h-14 w-14 text-amber-400" aria-hidden="true" />
        )}
        <h1 className="pt-4 font-display text-2xl font-bold uppercase tracking-widest">
          {success ? "Payment received" : "Checkout cancelled"}
        </h1>
        <p className="pt-2 text-sm text-muted-foreground">
          {success
            ? "You're locked in. Your order confirmation is syncing now — it'll appear in your order history within a moment."
            : "No charge was made. Your cart is exactly as you left it whenever you're ready."}
        </p>
        <div className="grid w-full gap-2 pt-6">
          {success ? (
            <>
              <Link
                to="/account/orders"
                className="ios-pressable flex min-h-12 items-center justify-center bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground"
              >
                View my orders
              </Link>
              <Link
                to="/store"
                className="ios-pressable flex min-h-12 items-center justify-center border border-border text-sm font-bold uppercase tracking-widest"
              >
                Back to the store
              </Link>
            </>
          ) : (
            <Link
              to="/store"
              className="ios-pressable flex min-h-12 items-center justify-center bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground"
            >
              Back to the store
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
