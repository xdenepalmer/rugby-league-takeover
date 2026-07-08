/**
 * Native iOS Store — "Shop". A purpose-built native shopping surface, NOT the
 * web store marketing page. Native-only: reached via the isNativeApp() branch in
 * src/pages/Store.jsx; the web Store is untouched. Reuses the exact same React
 * Query keys as the web app (["products"], ["siteSettings"]) so the cache is
 * shared, and the exact same cart contract (localStorage "rlt_cart" + the
 * "rlt_cart_changed" window event) so the tab-bar badge and web cart stay in
 * sync.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ShoppingBag, ShoppingCart, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { hideBrokenImage } from "@/lib/img-fallback";
import { lightImpact, selectionChanged, successImpact } from "@/lib/native/haptics";
import PullToRefresh from "@/components/PullToRefresh";

/* Apparel with size variants must not blind-add a sizeless line item — the same
 * normalization the web Store uses to decide productHasSizes. */
function normalizeSizeVariants(raw) {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
  return raw
    .map((v) => (typeof v === "string" ? { size: v, stock_quantity: 0 } : v))
    .filter((v) => v && v.size && String(v.size).trim() !== "");
}

function readCart() {
  try {
    const stored = localStorage.getItem("rlt_cart");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function Eyebrow({ children, tone = "text-primary" }) {
  return (
    <p className={`nt-caption font-bold uppercase tracking-[0.22em] ${tone}`}>{children}</p>
  );
}

/* ── Native product card ── */
function NativeProductCard({ product, inCartQty, onAdd, onQuickView }) {
  const stock = Number(product.stock_quantity);
  const comingSoon = product.coming_soon === true;
  const soldOut = !comingSoon && Number.isFinite(stock) && stock <= 0;
  const productHasSizes = normalizeSizeVariants(product?.sizes).length > 0;
  const disabled = soldOut || comingSoon;

  const handlePrimary = () => {
    if (disabled) return;
    if (productHasSizes) {
      selectionChanged();
      onQuickView(product);
    } else {
      onAdd(product);
    }
  };

  return (
    <div className="nt-raised nt-e2 flex flex-col overflow-hidden border border-border/50">
      <button
        type="button"
        onClick={() => { selectionChanged(); onQuickView(product); }}
        className="ios-pressable relative block aspect-square w-full overflow-hidden border-b border-border/40 bg-muted/20 text-left"
        aria-label={`View ${product.name}`}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onError={hideBrokenImage}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ShoppingBag className="h-9 w-9 stroke-1" />
          </div>
        )}
        {(comingSoon || soldOut) && (
          <span className="absolute left-2 top-2 border border-border/60 bg-background/80 px-2 py-0.5 text-2xs font-bold uppercase tracking-wider text-foreground backdrop-blur">
            {comingSoon ? "Soon" : "Sold out"}
          </span>
        )}
        {product.category && !comingSoon && !soldOut && (
          <span className="absolute left-2 top-2 border border-border/50 bg-background/70 px-2 py-0.5 text-2xs font-bold uppercase tracking-wider text-slate-200 backdrop-blur">
            {product.category}
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="nt-subhead line-clamp-2 font-bold uppercase tracking-wide text-foreground">
          {product.name}
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-black tabular-nums text-accent">
            ${Number(product.price_aud || 0).toFixed(2)}
          </span>
          <button
            type="button"
            onClick={handlePrimary}
            disabled={disabled}
            aria-label={
              comingSoon ? "Coming soon" : soldOut ? "Sold out" : productHasSizes ? `Select size for ${product.name}` : `Add ${product.name} to cart`
            }
            className="ios-pressable flex h-9 min-w-9 items-center justify-center gap-1 border border-border bg-primary px-2.5 text-2xs font-black uppercase tracking-wider text-primary-foreground disabled:border-border/40 disabled:bg-muted disabled:text-muted-foreground"
          >
            {comingSoon ? (
              <Sparkles className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span>{comingSoon ? "Soon" : soldOut ? "Out" : productHasSizes ? "Size" : inCartQty > 0 ? inCartQty : "Add"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Native quick-view sheet (sized products) ── */
function NativeQuickView({ product, onClose, onAdd }) {
  const variants = useMemo(() => normalizeSizeVariants(product?.sizes), [product?.sizes]);
  const labels = useMemo(() => variants.map((v) => v.size), [variants]);
  const hasSizes = labels.length > 0;
  const defaultSize = labels.includes("M") ? "M" : labels[0] || "";
  const [selectedSize, setSelectedSize] = useState(defaultSize);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setSelectedSize(labels.includes("M") ? "M" : labels[0] || "");
    setQuantity(1);
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!product) return null;

  const totalStock = Number(product.stock_quantity);
  const comingSoon = product.coming_soon === true;
  const soldOut = !comingSoon && Number.isFinite(totalStock) && totalStock <= 0;
  const selectedVariant = variants.find((v) => v.size === selectedSize);
  const maxQty = selectedVariant?.stock_quantity != null && Number.isFinite(selectedVariant.stock_quantity)
    ? selectedVariant.stock_quantity
    : Number.isFinite(totalStock) ? totalStock : 99;
  const canAdd = !comingSoon && !soldOut && (!hasSizes || !!selectedSize) && quantity <= maxQty;

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(product, hasSizes ? selectedSize : undefined, quantity);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 240 }}
          className="nt-material relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden border-t border-border/60"
          role="dialog"
          aria-modal="true"
          aria-label={product.name}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/25" aria-hidden />
          <div className="nt-gutter-x flex-1 overflow-y-auto pb-4 pt-3">
            <div className="aspect-square w-full overflow-hidden border border-border/40 bg-muted/20">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} decoding="async" onError={hideBrokenImage} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ShoppingBag className="h-12 w-12 stroke-1" />
                </div>
              )}
            </div>

            <div className="mt-4">
              {product.category && (
                <Eyebrow tone="text-slate-300">{product.category}</Eyebrow>
              )}
              <h2 className="nt-title mt-1 font-display uppercase tracking-wide text-foreground">{product.name}</h2>
              <p className="mt-1 font-mono text-lg font-black text-accent">${Number(product.price_aud || 0).toFixed(2)} AUD</p>
              {product.description && (
                <p className="nt-footnote mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{product.description}</p>
              )}
            </div>

            {hasSizes && !comingSoon && !soldOut && (
              <div className="mt-4">
                <Eyebrow tone="text-slate-300">Select size</Eyebrow>
                <div className="mt-2 flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const vStock = Number(v.stock_quantity);
                    const isOut = Number.isFinite(vStock) && vStock <= 0;
                    const isSelected = selectedSize === v.size;
                    return (
                      <button
                        key={v.size}
                        type="button"
                        disabled={isOut}
                        onClick={() => { selectionChanged(); setSelectedSize(v.size); setQuantity(1); }}
                        className={`ios-pressable h-11 min-w-11 border px-3 text-xs font-black uppercase ${
                          isOut
                            ? "cursor-not-allowed border-border/20 bg-muted/10 text-muted-foreground/30 line-through"
                            : isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background/50 text-slate-300"
                        }`}
                      >
                        {v.size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="nt-material-thin nt-gutter-x shrink-0 border-t border-border/50 pt-3" style={{ paddingBottom: "max(0.75rem, var(--safe-bottom))" }}>
            {comingSoon || soldOut ? (
              <div className="flex h-12 w-full items-center justify-center border border-border/50 bg-muted text-xs font-black uppercase tracking-widest text-muted-foreground">
                {comingSoon ? "Coming soon" : "Sold out"}
              </div>
            ) : (
              <div className="flex items-stretch gap-3">
                <div className="flex items-center border border-border">
                  <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="ios-pressable flex h-12 w-11 items-center justify-center text-slate-300" aria-label="Decrease quantity">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center font-mono text-sm font-bold text-foreground tabular-nums">{quantity}</span>
                  <button type="button" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} className="ios-pressable flex h-12 w-11 items-center justify-center text-slate-300" aria-label="Increase quantity">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!canAdd}
                  className="ios-pressable flex h-12 flex-1 items-center justify-center border border-border bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground disabled:border-border/40 disabled:bg-muted disabled:text-muted-foreground"
                >
                  {quantity > maxQty ? "Not enough stock" : `Add • $${(Number(product.price_aud || 0) * quantity).toFixed(2)}`}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default function NativeStore() {
  const enabled = appParams.hasBase44Config;
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("sort_order", 50),
    enabled,
    staleTime: 60000,
    gcTime: 300000,
  });

  const [cart, setCart] = useState(readCart);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [quickViewProduct, setQuickViewProduct] = useState(null);

  // Persist + broadcast on every change — the same contract the web Store and
  // the native tab-bar badge listen to.
  useEffect(() => {
    try { localStorage.setItem("rlt_cart", JSON.stringify(cart)); } catch { /* private mode / quota */ }
    window.dispatchEvent(new CustomEvent("rlt_cart_changed", { detail: { count: cart.reduce((s, i) => s + i.quantity, 0) } }));
  }, [cart]);

  // Stay in sync if another surface (web cart, other tab) mutates the cart.
  useEffect(() => {
    const sync = () => setCart(readCart());
    window.addEventListener("rlt_cart_changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("rlt_cart_changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const visibleProducts = useMemo(() => products.filter((p) => p.is_active !== false), [products]);

  const categories = useMemo(() => {
    const list = new Set();
    visibleProducts.forEach((p) => { if (p.category) list.add(p.category); });
    return ["All", ...Array.from(list)];
  }, [visibleProducts]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "All") return visibleProducts;
    return visibleProducts.filter((p) => p.category === selectedCategory);
  }, [visibleProducts, selectedCategory]);

  const addToCart = useCallback((product, size, count = 1) => {
    if (product.coming_soon === true) return;

    let maxQuantity = 20;
    if (size) {
      const variant = normalizeSizeVariants(product?.sizes).find((v) => v.size === size);
      if (variant) {
        const vs = Number(variant.stock_quantity);
        if (Number.isFinite(vs)) maxQuantity = Math.min(vs, 20);
      }
    }
    if (maxQuantity === 20) {
      const total = Number(product.stock_quantity);
      if (Number.isFinite(total)) maxQuantity = Math.min(total, 20);
    }
    if (maxQuantity <= 0) return;

    successImpact();
    const cartItemId = product.id + (size ? "-" + size : "");
    setCart((curr) => {
      const existing = curr.find((item) => item.cartItemId === cartItemId);
      if (existing) {
        return curr.map((item) =>
          item.cartItemId === cartItemId
            ? { ...item, quantity: Math.min(item.quantity + count, maxQuantity) }
            : item
        );
      }
      return [
        ...curr,
        { cartItemId, id: product.id, name: product.name, price_aud: product.price_aud, image_url: product.image_url, stock_quantity: product.stock_quantity, quantity: Math.min(count, maxQuantity), size },
      ];
    });
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const inCartById = useMemo(() => {
    const map = new Map();
    cart.forEach((item) => map.set(item.id, (map.get(item.id) || 0) + item.quantity));
    return map;
  }, [cart]);

  return (
    <>
      <PullToRefresh queryKeys={[["products"], ["siteSettings"]]}>
        <main className="min-h-dvh bg-background text-foreground nt-legible-floor pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))]">
          <div className="mx-auto w-full max-w-xl nt-gutter-x nt-stack">
            {/* Large-title header */}
            <div className="flex items-end justify-between gap-3 pb-1">
              <div className="min-w-0">
                <Eyebrow>Supporter gear</Eyebrow>
                <h1 className="nt-large-title mt-0.5 text-foreground">Store</h1>
              </div>
              <div className="shrink-0 border border-border/60 bg-card/50 px-2.5 py-1">
                <span className="nt-caption font-bold uppercase tracking-wider text-muted-foreground">
                  {visibleProducts.length} item{visibleProducts.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {/* Category rail */}
            {categories.length > 1 && (
              <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 store-category-rail" role="tablist">
                {categories.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      role="tab"
                      aria-selected={active}
                      onClick={() => { selectionChanged(); setSelectedCategory(cat); }}
                      className={`ios-pressable shrink-0 snap-start border px-3.5 py-2 text-2xs font-black uppercase tracking-wider ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/70 bg-card/50 text-slate-300"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Product grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((n) => (
                  <div key={n} className="nt-raised nt-e1 overflow-hidden border border-border/40">
                    <div className="aspect-square w-full animate-pulse bg-muted/20" />
                    <div className="space-y-2 p-3">
                      <div className="h-3 w-3/4 animate-pulse bg-muted/20" />
                      <div className="h-4 w-1/2 animate-pulse bg-muted/20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="nt-raised nt-e1 border border-border/50 p-10 text-center">
                <ShoppingBag className="mx-auto mb-3 h-10 w-10 stroke-1 text-muted-foreground" />
                <h3 className="nt-subhead font-bold uppercase tracking-wide text-foreground">No merchandise found</h3>
                <p className="nt-footnote mt-1 text-muted-foreground">Check back soon for official Takeover gear.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map((product) => (
                  <NativeProductCard
                    key={product.id}
                    product={product}
                    inCartQty={inCartById.get(product.id) || 0}
                    onAdd={addToCart}
                    onQuickView={setQuickViewProduct}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </PullToRefresh>

      {/* Sticky "View cart" bar — lifts above the floating tab bar when non-empty */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "tween", duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-x-0 z-[45] nt-gutter-x"
            style={{ bottom: "calc(4.75rem + var(--safe-bottom))" }}
          >
            <button
              type="button"
              onClick={() => { lightImpact(); window.dispatchEvent(new Event("rlt_open_cart")); }}
              className="ios-pressable nt-material-bar mx-auto flex w-full max-w-xl items-center justify-between gap-3 border border-primary/40 px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
            >
              <span className="flex items-center gap-2 text-primary">
                <ShoppingCart className="h-4 w-4" />
                <span className="text-xs font-black uppercase tracking-wider">View cart ({cartCount})</span>
              </span>
              <span className="font-mono text-sm font-black text-accent tabular-nums">
                ${cart.reduce((s, i) => s + Number(i.price_aud || 0) * i.quantity, 0).toFixed(2)} AUD
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {quickViewProduct && (
        <NativeQuickView
          product={quickViewProduct}
          onClose={() => setQuickViewProduct(null)}
          onAdd={addToCart}
        />
      )}
    </>
  );
}
