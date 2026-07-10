import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Trash2, Minus, Plus, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import {
  readCart,
  writeCart,
  setCartItemQuantity,
  removeCartItem,
  cartQuantity,
  cartSubtotalAud,
  CART_CHANGED_EVENT,
} from "@/lib/cart-store";
import { FREE_SHIPPING_THRESHOLD_AUD, formatAud } from "@/lib/store-products";
import { openExternalUrl } from "@/lib/native/open-external";
import { emitHaptic } from "@/lib/native/haptic-events";
import { hideBrokenImage } from "@/lib/img-fallback";
import { NativeEmptyState } from "../../components/NativePrimitives.jsx";

/**
 * Persistent native cart: shared rlt_cart contract, AusPost live rates and
 * the server-authoritative Stripe checkout (createCheckout only ever
 * returns a hosted URL; totals/stock are validated server-side and the
 * webhook remains the source of payment truth). Checkout hands off to the
 * system browser sheet.
 */
export default function NativeCartSheet({ open, onClose }) {
  const { user } = useAuth();
  const [cart, setCart] = useState([]);
  const [postcode, setPostcode] = useState("");
  const [rates, setRates] = useState([]);
  const [ratesFor, setRatesFor] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [loadingRates, setLoadingRates] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => setCart(readCart());
  useEffect(() => {
    if (!open) return undefined;
    refresh();
    window.addEventListener(CART_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CART_CHANGED_EVENT, refresh);
  }, [open]);

  const subtotal = cartSubtotalAud(cart);
  const freeShipping = subtotal >= FREE_SHIPPING_THRESHOLD_AUD;
  const cartSignature = useMemo(() => cart.map((i) => `${i.cartItemId}x${i.quantity}`).join(","), [cart]);
  const selectedRate = rates.find((r) => r.code === selectedCode) || null;
  const shippingPrice = selectedRate ? (freeShipping ? 0 : Number(selectedRate.price_aud) || 0) : 0;

  // Rates go stale whenever the cart or postcode changes.
  useEffect(() => {
    if (ratesFor && ratesFor !== `${postcode.trim()}::${cartSignature}`) {
      setRates([]);
      setRatesFor("");
      setSelectedCode("");
    }
  }, [postcode, cartSignature, ratesFor]);

  const updateItem = (cartItemId, quantity, max) => {
    const next = quantity <= 0 ? removeCartItem(cart, cartItemId) : setCartItemQuantity(cart, cartItemId, quantity, max);
    setCart(writeCart(next));
    emitHaptic("sheet.snap");
  };

  const fetchRates = async () => {
    const trimmed = postcode.trim();
    if (!/^\d{4}$/.test(trimmed)) {
      setError("Enter a 4-digit Australian postcode.");
      return;
    }
    setLoadingRates(true);
    setError("");
    try {
      const response = await base44.functions.invoke("auspostRates", {
        toPostcode: trimmed,
        cart: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
      });
      const services = response?.data?.services || [];
      if (!services.length) throw new Error("No AusPost shipping options are available for this postcode.");
      setRates(services);
      setRatesFor(`${trimmed}::${cartSignature}`);
      setSelectedCode(services[0].code);
      emitHaptic("save.success");
    } catch (err) {
      setError(err?.response?.data?.error || err?.data?.error || err?.message || "Could not calculate shipping right now.");
      setRates([]);
      setSelectedCode("");
      emitHaptic("mutation.error");
    } finally {
      setLoadingRates(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedRate) return;
    setCheckingOut(true);
    setError("");
    try {
      const response = await base44.functions.invoke("createCheckout", {
        items: cart.map((item) => ({ productId: item.id, quantity: item.quantity, size: item.size || "" })),
        customerName: user?.full_name || "",
        customerEmail: user?.email || "",
        shipping: {
          code: selectedRate.code,
          name: selectedRate.name,
          postcode: postcode.trim(),
          price_aud: shippingPrice,
        },
      });
      if (response?.data?.url) {
        new URL(response.data.url);
        emitHaptic("checkout.handoff");
        await openExternalUrl(response.data.url, { fallback: "navigate" });
      } else {
        throw new Error("Failed to create checkout session.");
      }
    } catch (err) {
      const data = err?.response?.data || err?.data || {};
      setError(data.error || err.message || "Checkout failed. Please try again.");
      emitHaptic("mutation.error");
      if (data.unavailableProductIds?.length) {
        toast({ title: "Some items are unavailable", description: "Your cart was adjusted — please review it.", variant: "destructive" });
      }
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Cart">
          <motion.button
            type="button"
            aria-label="Close cart"
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            className="ios-sheet absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col border-t border-border bg-card"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 380 }}
            onAnimationComplete={() => open && emitHaptic("sheet.snap")}
          >
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <h2 className="font-display text-sm font-bold uppercase tracking-widest">
                Cart {cartQuantity(cart) > 0 && `(${cartQuantity(cart)})`}
              </h2>
              <button type="button" onClick={onClose} aria-label="Close" className="ios-pressable flex h-11 w-11 items-center justify-center text-muted-foreground">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="ios-scroll flex-1 overflow-y-auto px-4 pb-[max(1rem,var(--safe-bottom))]">
              {cart.length === 0 ? (
                <div className="py-8">
                  <NativeEmptyState icon={ShoppingBag} title="Cart's empty" description="Add some takeover merch and it'll show up here." />
                </div>
              ) : (
                <>
                  <div className="divide-y divide-border/40">
                    {cart.map((item) => {
                      const max = Math.min(Number(item.stock_quantity) || 20, 20);
                      return (
                        <div key={item.cartItemId} className="flex items-center gap-3 py-3">
                          {item.image_url && (
                            <img src={item.image_url} alt="" onError={hideBrokenImage} className="h-16 w-16 shrink-0 border border-border/40 object-cover" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold uppercase tracking-wide">{item.name}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              {item.size ? `Size ${item.size} · ` : ""}{formatAud(item.price_aud)}
                            </p>
                            <div className="flex items-center gap-1 pt-1">
                              <button type="button" aria-label="Decrease quantity" onClick={() => updateItem(item.cartItemId, item.quantity - 1, max)} className="ios-pressable flex h-9 w-9 items-center justify-center border border-border">
                                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                              <span className="min-w-8 text-center text-sm font-black">{item.quantity}</span>
                              <button type="button" aria-label="Increase quantity" disabled={item.quantity >= max} onClick={() => updateItem(item.cartItemId, item.quantity + 1, max)} className="ios-pressable flex h-9 w-9 items-center justify-center border border-border disabled:opacity-40">
                                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <p className="text-sm font-black text-primary">{formatAud((Number(item.price_aud) || 0) * item.quantity)}</p>
                            <button type="button" aria-label={`Remove ${item.name}`} onClick={() => updateItem(item.cartItemId, 0)} className="ios-pressable flex h-9 w-9 items-center justify-center text-muted-foreground">
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-border/60 pt-3">
                    <p className="pb-2 text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Delivery (Australia)</p>
                    <div className="flex gap-2">
                      <Input
                        value={postcode}
                        onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        inputMode="numeric"
                        placeholder="Postcode"
                        aria-label="Postcode"
                        className="h-11 w-28 rounded-none border-border bg-background"
                      />
                      <button
                        type="button"
                        onClick={fetchRates}
                        disabled={loadingRates || cart.length === 0}
                        className="ios-pressable min-h-11 flex-1 border border-border text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                      >
                        {loadingRates ? "Checking…" : "Get shipping options"}
                      </button>
                    </div>
                    {freeShipping && (
                      <p className="pt-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                        Free delivery unlocked (orders over ${FREE_SHIPPING_THRESHOLD_AUD})
                      </p>
                    )}
                    {rates.length > 0 && (
                      <div className="space-y-1 pt-2" role="radiogroup" aria-label="Shipping option">
                        {rates.map((rate) => (
                          <button
                            key={rate.code}
                            type="button"
                            role="radio"
                            aria-checked={selectedCode === rate.code}
                            onClick={() => setSelectedCode(rate.code)}
                            className={`ios-pressable flex min-h-11 w-full items-center justify-between border px-3 text-left text-xs font-bold uppercase tracking-wide ${
                              selectedCode === rate.code ? "border-primary bg-primary/10 text-primary" : "border-border"
                            }`}
                          >
                            <span className="min-w-0 truncate">{rate.name}</span>
                            <span>{freeShipping ? "Free" : formatAud(rate.price_aud)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {error && <p className="pt-2 text-xs font-bold text-red-400">{error}</p>}
                  </div>

                  <div className="space-y-1 border-t border-border/60 py-3 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatAud(subtotal)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span>{selectedRate ? (shippingPrice === 0 ? "Free" : formatAud(shippingPrice)) : "—"}</span></div>
                    <div className="flex justify-between pt-1 text-base font-black"><span className="uppercase tracking-widest">Total</span><span className="text-primary">{formatAud(subtotal + shippingPrice)} AUD</span></div>
                  </div>

                  <button
                    type="button"
                    disabled={!selectedRate || checkingOut}
                    onClick={handleCheckout}
                    className="ios-pressable flex min-h-12 w-full items-center justify-center bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.35)] disabled:opacity-40"
                  >
                    {checkingOut ? "Opening secure checkout…" : "Checkout with Stripe"}
                  </button>
                  <p className="pt-2 text-center text-[9px] uppercase tracking-widest text-muted-foreground">
                    Secure payment opens in Safari — your order confirms automatically.
                  </p>
                </>
              )}
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
