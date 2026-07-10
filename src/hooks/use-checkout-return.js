import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { writeCart } from "@/lib/cart-store";
import {
  isValidStripeSessionId,
  resolveCheckoutConfirmation,
  shouldClearCart,
  wasCartClearedFor,
  markCartClearedFor,
} from "@/lib/checkout-return";

export const MAX_VERIFY_ATTEMPTS = 5;
export const VERIFY_RETRY_MS = 4000;

/**
 * Shared Stripe checkout-return verification for BOTH the web return page
 * (src/pages/CheckoutReturn.jsx) and the native return screen
 * (NativeCheckoutReturnScreen.jsx). The return URL proves navigation only —
 * payment truth comes exclusively from verifyCheckoutReturn, a server-side
 * Stripe session check, with the webhook remaining the sole writer of order
 * state. The cart is cleared exactly once, and only after verification says
 * the session is paid; pending keeps polling briefly; cancelled/unverified
 * never touch the cart or claim success.
 *
 * Returned `state` is one of:
 *  - "confirming"          → verifying with Stripe (or async payment settling)
 *  - "confirmed"           → Stripe reports the session paid
 *  - "pending"             → completed but payment still settling — cart kept
 *  - "cancelled"           → the session expired / user backed out — cart kept
 *  - "unverified"          → couldn't match a confirmable session — cart kept
 *  - "confirming_offline"  → deploy skew (no session_id): soft, webhook governs
 */
export function useCheckoutReturn({ status } = {}) {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id") || "";
  const cancelled = status !== "success";
  const [state, setState] = useState(cancelled ? "cancelled" : "confirming");
  const attempts = useRef(0);
  const timer = useRef(null);

  useEffect(() => {
    if (cancelled) return undefined;
    if (!sessionId) {
      // No session id at all (older createCheckout still deployed): the
      // webhook governs — soft state, refresh orders, never a red failure.
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      setState("confirming_offline");
      return undefined;
    }
    if (!isValidStripeSessionId(sessionId)) {
      setState("unverified");
      return undefined;
    }
    let disposed = false;

    const confirm = () => {
      if (shouldClearCart("confirmed", wasCartClearedFor(sessionId))) {
        writeCart([]);
        markCartClearedFor(sessionId);
      }
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setState("confirmed");
    };

    const verify = async () => {
      attempts.current += 1;
      let confirmation = "unverified";
      try {
        const response = await base44.functions.invoke("verifyCheckoutReturn", { sessionId });
        confirmation = resolveCheckoutConfirmation(response?.data);
      } catch {
        confirmation = "unverified";
      }
      if (disposed) return;
      if (confirmation === "confirmed") {
        confirm();
      } else if (confirmation === "pending" && attempts.current < MAX_VERIFY_ATTEMPTS) {
        setState("confirming");
        timer.current = setTimeout(verify, VERIFY_RETRY_MS);
      } else if (confirmation === "pending") {
        setState("pending");
      } else if (confirmation === "cancelled") {
        setState("cancelled");
      } else if (attempts.current < 2) {
        // One retry for transient network failures before giving up.
        timer.current = setTimeout(verify, VERIFY_RETRY_MS);
      } else {
        setState("unverified");
      }
    };

    verify();
    return () => {
      disposed = true;
      clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelled, sessionId]);

  return { state, sessionId, cancelled };
}
