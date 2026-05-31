import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ShoppingCart, ShoppingBag, Plus, Minus, Trash2, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Store() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cart, setCart] = useState(() => {
    try {
      const stored = localStorage.getItem("rlt_cart");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const { user } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const { data: products = [] } = useQuery({ 
    queryKey: ["products"], 
    queryFn: () => base44.entities.Product.list("sort_order", 50),
    enabled: appParams.hasBase44Config
  });
  const visibleProducts = products.filter((product) => product.is_active !== false);

  useEffect(() => {
    localStorage.setItem("rlt_cart", JSON.stringify(cart));
  }, [cart]);

  // Prefill checkout details for signed-in buyers (they can still edit them).
  useEffect(() => {
    if (user?.email) {
      setCheckoutName((current) => current || user.full_name || "");
      setCheckoutEmail((current) => current || user.email || "");
    }
  }, [user?.email, user?.full_name]);

  const addToCart = (product) => {
    const stock = Number(product.stock_quantity);
    if (Number.isFinite(stock) && stock <= 0) return;

    setCart((curr) => {
      const existing = curr.find((item) => item.id === product.id);
      if (existing) {
        const maxQuantity = Number.isFinite(stock) ? Math.min(stock, 20) : 20;
        return curr.map((item) => 
          item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, maxQuantity) } : item
        );
      }
      return [...curr, { id: product.id, name: product.name, price_aud: product.price_aud, image_url: product.image_url, stock_quantity: product.stock_quantity, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const updateQuantity = (id, change) => {
    setCart((curr) => 
      curr.map((item) => {
        if (item.id === id) {
          const stock = Number(item.stock_quantity);
          const maxQuantity = Number.isFinite(stock) ? Math.min(stock, 20) : 20;
          const newQty = Math.max(1, Math.min(item.quantity + change, maxQuantity));
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const removeFromCart = (id) => {
    setCart((curr) => curr.filter((item) => item.id !== id));
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + (Number(item.price_aud || 0) * item.quantity), 0);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0 || !checkoutEmail) return;

    if (window.self !== window.top) {
      alert("Checkout works from the published app, not inside the preview window.");
      return;
    }

    setCheckingOut(true);
    setCheckoutError("");
    try {
      const response = await base44.functions.invoke("createCheckout", {
        items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
        customerName: checkoutName,
        customerEmail: checkoutEmail,
      });

      if (response?.data?.url) {
        new URL(response.data.url);
        localStorage.removeItem("rlt_cart");
        setCart([]);
        window.location.href = response.data.url;
      } else {
        throw new Error("Failed to create checkout session.");
      }
    } catch (err) {
      setCheckoutError(err?.response?.data?.error || err?.data?.error || err?.message || "An error occurred during checkout.");
    } finally {
      setCheckingOut(false);
    }
  };

  const isSuccess = searchParams.get("success") === "true";
  const isCancelled = searchParams.get("cancelled") === "true";

  const clearAlerts = () => {
    setSearchParams({});
  };

  return (
    <main className="relative min-h-screen bg-background px-5 py-8 text-foreground md:px-8">
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="flex items-center justify-between border-b border-border/80 pb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Official Supporter Gear</p>
            <h1 className="font-display text-4xl uppercase tracking-tight sm:text-5xl">Vegas Takeover Store</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCartOpen(true)}
              className="relative flex h-12 w-12 items-center justify-center border border-border bg-card transition-colors hover:border-accent hover:text-accent"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center bg-primary text-[10px] font-bold text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </button>
            <Button asChild variant="outline" className="h-12 rounded-none border-border">
              <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
            </Button>
          </div>
        </div>

        {isSuccess && (
          <div className="mt-6 flex items-center justify-between border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <p className="text-sm font-semibold">Payment successful! Check your email for order confirmation.</p>
            </div>
            <button onClick={clearAlerts} className="text-xs underline hover:text-white">Dismiss</button>
          </div>
        )}

        {isCancelled && (
          <div className="mt-6 flex items-center justify-between border border-primary/30 bg-primary/10 p-4 text-primary">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm font-semibold">Checkout cancelled. Your items are saved in your cart.</p>
            </div>
            <button onClick={clearAlerts} className="text-xs underline hover:text-white">Dismiss</button>
          </div>
        )}

        <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {visibleProducts.map((product) => {
            const stock = Number(product.stock_quantity);
            const soldOut = Number.isFinite(stock) && stock <= 0;

            return (
              <article 
                key={product.id} 
                className="group relative flex flex-col border border-border bg-card/60 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40"
              >
                <div className="aspect-square w-full overflow-hidden bg-muted/20 border-b border-border">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name} 
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">No image available</div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h2 className="font-display text-2xl uppercase tracking-wide">{product.name}</h2>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{product.description}</p>
                  <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
                    <span className="text-xl font-bold text-accent">${Number(product.price_aud || 0).toFixed(2)} AUD</span>
                    <Button 
                      onClick={() => addToCart(product)}
                      disabled={soldOut}
                      className="rounded-none bg-primary hover:bg-primary/90 font-bold uppercase tracking-wider text-xs"
                    >
                      {soldOut ? "Sold Out" : "Add To Cart"}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {visibleProducts.length === 0 && (
          <p className="mt-10 border border-border bg-card p-12 text-center text-muted-foreground">
            Official takeover merchandise is being prepared. Check back soon!
          </p>
        )}
      </div>

      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.35 }}
              className="fixed bottom-0 right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border bg-card p-6 shadow-2xl md:max-w-md"
            >
              <div className="flex items-center justify-between border-b border-border/80 pb-4">
                <h3 className="flex items-center gap-2 font-display text-2xl uppercase tracking-wider">
                  <ShoppingBag className="h-5 w-5 text-accent" /> Your Cart
                </h3>
                <button 
                  onClick={() => setCartOpen(false)}
                  className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4">
                {cart.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
                    <ShoppingBag className="h-10 w-10 stroke-1 mb-2" />
                    <p className="text-sm">Your cart is empty.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {cart.map((item) => (
                      <div key={item.id} className="flex gap-4 border border-border bg-background/40 p-3">
                        <div className="h-16 w-16 flex-shrink-0 bg-muted/30">
                          {item.image_url && (
                            <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col">
                          <h4 className="text-sm font-bold uppercase tracking-wide line-clamp-1">{item.name}</h4>
                          <p className="text-xs text-accent mt-1">${Number(item.price_aud || 0).toFixed(2)} AUD</p>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center border border-border">
                              <button 
                                onClick={() => updateQuantity(item.id, -1)}
                                className="flex h-7 w-7 items-center justify-center bg-card hover:bg-muted text-muted-foreground"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-8 text-center text-xs font-semibold">{item.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.id, 1)}
                                className="flex h-7 w-7 items-center justify-center bg-card hover:bg-muted text-muted-foreground"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <button 
                              onClick={() => removeFromCart(item.id)}
                              className="text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="border-t border-border/80 pt-4">
                  <div className="flex items-center justify-between text-base font-bold uppercase tracking-wider mb-4">
                    <span>Subtotal</span>
                    <span className="text-accent">${cartSubtotal.toFixed(2)} AUD</span>
                  </div>

                  <form onSubmit={handleCheckout} className="grid gap-3">
                    {checkoutError && (
                      <p className="border border-primary/50 bg-primary/10 p-3 text-sm font-semibold text-foreground">
                        {checkoutError}
                      </p>
                    )}
                    <Input 
                      required 
                      placeholder="Your name" 
                      value={checkoutName}
                      onChange={(e) => setCheckoutName(e.target.value)}
                      className="h-10 rounded-none bg-background border-border" 
                    />
                    <Input 
                      required 
                      type="email" 
                      placeholder="Email for receipt" 
                      value={checkoutEmail}
                      onChange={(e) => setCheckoutEmail(e.target.value)}
                      className="h-10 rounded-none bg-background border-border" 
                    />
                    <Button 
                      type="submit" 
                      disabled={checkingOut}
                      className="h-12 w-full rounded-none bg-primary font-bold uppercase tracking-widest text-xs mt-2"
                    >
                      {checkingOut ? "Connecting to Stripe..." : `Checkout • $${cartSubtotal.toFixed(2)} AUD`}
                    </Button>
                  </form>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
