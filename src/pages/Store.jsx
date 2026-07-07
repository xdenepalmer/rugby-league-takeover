import React, { useState, useEffect, useMemo, useCallback } from "react";
import AdSlot from "@/components/ads/AdSlot";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { 
  ShoppingCart, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  ShoppingBag as BagIcon,
  ChevronRight,
  User,
  Mail,
  CreditCard,
  Flame,
  Star,
  Rocket,
  Info,
  Lock,
  Truck,
  Ruler
} from "lucide-react";
import { AnimatePresence, motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import StoreFaq from "@/components/public/StoreFaq";
import BackgroundVideo, { DEFAULT_BACKGROUND_VIDEO_SOURCES } from "@/components/public/BackgroundVideo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { openExternalUrl } from "@/lib/native/open-external";
import { lightImpact, mediumImpact } from "@/lib/native/haptics";

/* ── 3D Product Card Component ── */
const isTouch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches;

const ProductCard = React.memo(function ProductCard({ product, index, addToCart, cart, user, onSubscribeRelease, onOpenQuickView }) {
  const stock = Number(product.stock_quantity);
  const comingSoon = product.coming_soon === true;
  const soldOut = !comingSoon && Number.isFinite(stock) && stock <= 0;
  const inCart = cart.find(item => item.id === product.id);
  const [releaseEmail, setReleaseEmail] = useState(user?.email || "");
  const [releaseSubscribed, setReleaseSubscribed] = useState(false);

  // 3D Tilt Hook
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [7, -7]), { stiffness: 350, damping: 25 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-7, 7]), { stiffness: 350, damping: 25 });

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }, [mouseX, mouseY]);

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  // Determine stock bar percentage and color
  const stockPercent = comingSoon ? 100 : Number.isFinite(stock) ? Math.min(100, Math.max(0, (stock / 15) * 100)) : 100;
  const stockColor = comingSoon
    ? "bg-primary shadow-[0_0_8px_rgba(249,115,22,0.5)]"
    : soldOut 
      ? "bg-destructive" 
      : stock <= 5 
        ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
        : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";

  const stockLabel = comingSoon
    ? "Coming Soon"
    : soldOut
      ? "Sold Out"
      : stock <= 5
        ? `Only ${stock} left!`
        : "In Stock";

  // Badge determination
  const showHotBadge = index === 0;
  const showNewBadge = index === 1;

  return (
    <motion.article 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.08, 0.4), duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onMouseMove={isTouch ? undefined : handleMouseMove}
      onMouseLeave={isTouch ? undefined : handleMouseLeave}
      onClick={(e) => {
        if (e.target.closest("button, form, input, a")) return;
        onOpenQuickView(product);
      }}
      style={isTouch ? undefined : { rotateX, rotateY, transformPerspective: 1000 }}
      className="group relative flex flex-col border border-border bg-card/40 cmd-glass transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_25px_rgba(249,115,22,0.15)] overflow-hidden cursor-pointer"
    >
      {/* Glow highlight inside */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Badges overlay */}
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
        {comingSoon ? (
          <span className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 shadow-[0_0_12px_rgba(249,115,22,0.4)] flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> COMING SOON
          </span>
        ) : showHotBadge && (
          <span className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 shadow-[0_0_12px_rgba(249,115,22,0.4)] flex items-center gap-1">
            <Flame className="h-3 w-3" /> HOT
          </span>
        )}
        {!comingSoon && showNewBadge && (
          <span className="bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 shadow-[0_0_12px_rgba(217,119,6,0.4)] flex items-center gap-1">
            <Star className="h-3 w-3" /> NEW
          </span>
        )}
        {product.category && (
          <span className="bg-muted border border-border text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 text-slate-200">
            {product.category}
          </span>
        )}
      </div>

      {/* Image Wrap */}
      <div className="relative aspect-square w-full overflow-hidden border-b border-border bg-muted/10">
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name} 
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 group-hover:rotate-1" 
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <ShoppingBag className="h-10 w-10 stroke-1" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <span className="border border-white/20 bg-black/60 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-sm">Quick View</span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#030512]/90 via-transparent to-transparent opacity-60" />
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h2 className="font-display text-2xl uppercase tracking-wide text-foreground group-hover:text-primary transition-colors">
          {product.name}
        </h2>
        <p className="mt-2 flex-1 text-sm leading-6 text-slate-200 line-clamp-3 whitespace-pre-line">
          {product.description}
        </p>

        {/* Stock status indicator */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
            <span className={comingSoon ? "text-primary" : soldOut ? "text-destructive" : stock <= 5 ? "text-amber-400" : "text-emerald-400"}>
              {stockLabel}
            </span>
            <span className="text-slate-300 font-bold">{comingSoon ? "Preview" : `${soldOut ? "0" : stock} left`}</span>
          </div>
          <div className="h-1 w-full bg-border overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${stockPercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full ${stockColor}`} 
            />
          </div>
        </div>

        {comingSoon && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await onSubscribeRelease(product, releaseEmail);
              if (ok) setReleaseSubscribed(true);
            }}
            className="mt-5 border border-primary/25 bg-primary/[0.06] p-3"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Get release alert</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">We'll email you and send an account notification when this drops.</p>
            <div className="mt-3 flex gap-2">
              <Input
                type="email"
                required
                placeholder="Email address"
                value={releaseEmail}
                onChange={(e) => setReleaseEmail(e.target.value)}
                className="h-10 rounded-none border-border bg-background/70 text-xs"
              />
              <Button type="submit" disabled={releaseSubscribed} className="h-10 rounded-none bg-primary px-3 text-[9px] font-bold uppercase tracking-wider">
                {releaseSubscribed ? "Saved" : "Notify"}
              </Button>
            </div>
          </form>
        )}

        {/* Price & Action */}
        <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-4">
          <span className="text-xl font-bold font-mono tracking-tight text-accent drop-shadow-[0_0_8px_rgba(217,119,6,0.3)]">
            ${Number(product.price_aud || 0).toFixed(2)} <span className="text-xs text-slate-400 font-sans font-semibold">AUD</span>
          </span>
          <Button 
            onClick={() => addToCart(product)}
            disabled={soldOut || comingSoon}
            className="rounded-none bg-primary hover:bg-primary/90 font-bold uppercase tracking-wider text-xs px-4 py-2 flex items-center gap-1.5 relative overflow-hidden transition-all duration-300 disabled:bg-muted disabled:text-slate-400"
          >
            {comingSoon ? <Sparkles className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            <span>{comingSoon ? "Soon" : soldOut ? "Sold Out" : inCart ? `In Cart (${inCart.quantity})` : "Add"}</span>
          </Button>
        </div>
      </div>
    </motion.article>
  );
});

/* ── apparel sizing options and descriptions ── */
function normalizeSizeVariants(raw) {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
  return raw
    .map(v => typeof v === "string" ? { size: v, stock_quantity: 0 } : v)
    .filter(v => v && v.size && String(v.size).trim() !== "");
}

function ProductQuickViewModal({ product, isOpen, onClose, addToCart, cart, user }) {
  const [quantity, setQuantity] = useState(1);
  const variants = useMemo(() => normalizeSizeVariants(product?.sizes), [product?.sizes]);
  const variantLabels = useMemo(() => variants.map(v => v.size), [variants]);
  const hasSizes = variantLabels.length > 0;
  const defaultSize = variantLabels.includes("M") ? "M" : variantLabels[0] || "M";
  const [selectedSize, setSelectedSize] = useState(defaultSize);

  const selectedVariant = useMemo(() => variants.find(v => v.size === selectedSize), [variants, selectedSize]);
  const gallery = useMemo(() => [product?.image_url, product?.image_url_2].filter(Boolean), [product?.image_url, product?.image_url_2]);
  const [activeImg, setActiveImg] = useState("");

  useEffect(() => {
    if (isOpen) {
      const v = normalizeSizeVariants(product?.sizes);
      const labels = v.map(x => x.size);
      const def = labels.includes("M") ? "M" : labels[0] || "M";
      setSelectedSize(def);
      setQuantity(1);
      setActiveImg(product?.image_url || product?.image_url_2 || "");
    }
  }, [isOpen, product?.id, product?.sizes, product?.image_url, product?.image_url_2]);

  if (!isOpen || !product) return null;

  const totalStock = Number(product.stock_quantity);
  const comingSoon = product.coming_soon === true;
  const soldOut = !comingSoon && Number.isFinite(totalStock) && totalStock <= 0;
  const inCart = cart.find(item => item.id === product.id && item.size === (hasSizes ? selectedSize : undefined));

  const handleAdd = () => {
    addToCart(product, hasSizes ? selectedSize : undefined);
    // Add additional quantities if selected
    if (quantity > 1) {
      for (let i = 1; i < quantity; i++) {
        addToCart(product, hasSizes ? selectedSize : undefined);
      }
    }
    const sizeNote = hasSizes ? "(Size " + selectedSize + ") " : "";
    toast({
      title: "Added to Cart",
      description: `${product.name} ${sizeNote}x${quantity} added to cart.`,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
        />

        {/* Sheet Content */}
        <motion.div
          initial={{ y: "100%", opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0.5 }}
          transition={{ type: "spring", damping: 25, stiffness: 220 }}
          className="ios-sheet relative z-10 w-full max-h-[92dvh] overflow-hidden border-t border-border bg-card/95 pb-safe shadow-2xl flex flex-col md:max-w-2xl md:border md:h-auto md:max-h-[85dvh]"
        >
          {/* Top border glow */}
          <div className="h-[2px] w-full bg-gradient-to-r from-primary via-accent to-primary" />
          
          <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Quick View</span>
            <button onClick={onClose} className="text-xs uppercase tracking-wider font-bold text-slate-400 hover:text-foreground cursor-pointer">Close</button>
          </div>

          <div className="ios-scroll flex-1 overflow-y-auto cmd-scrollbar p-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Product Image (+ optional 2nd photo gallery) */}
              <div>
                <div className="aspect-square bg-muted/10 border border-border/40 overflow-hidden relative">
                  {activeImg ? (
                    <img src={activeImg} alt={product.name} decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <ShoppingBag className="h-12 w-12 stroke-1" />
                    </div>
                  )}
                </div>
                {gallery.length > 1 && (
                  <div className="mt-2 flex gap-2">
                    {gallery.map((img) => (
                      <button
                        key={img}
                        type="button"
                        onClick={() => setActiveImg(img)}
                        className={`h-16 w-16 shrink-0 overflow-hidden border transition-colors ${activeImg === img ? "border-primary" : "border-border/40 hover:border-border"}`}
                        aria-label="View product photo"
                      >
                        <img src={img} alt="" decoding="async" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Title & Info */}
              <div className="flex flex-col justify-between">
                <div>
                  {product.category && (
                    <span className="bg-muted border border-border text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 text-slate-200">
                      {product.category}
                    </span>
                  )}
                  <h2 className="font-display text-2xl uppercase tracking-wide text-foreground mt-2">{product.name}</h2>
                  <p className="text-xl font-bold font-mono text-accent mt-1">${Number(product.price_aud || 0).toFixed(2)} AUD</p>
                  {/* whitespace-pre-line preserves the line breaks/paragraphs entered in admin */}
                  <p className="text-xs text-slate-250 leading-relaxed mt-4 whitespace-pre-line">{product.description}</p>
                  {product.details && (
                    <p className="text-xs text-slate-300/90 leading-relaxed mt-3 whitespace-pre-line border-t border-border/30 pt-3">{product.details}</p>
                  )}
                </div>

                <div className="mt-4">
                  {/* Stock status indicator */}
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span className={comingSoon ? "text-primary" : soldOut ? "text-destructive" : totalStock <= 5 ? "text-amber-400" : "text-emerald-400"}>
                      {comingSoon ? "Coming Soon" : soldOut ? "Sold Out" : totalStock <= 5 ? `Only ${totalStock} left!` : "In Stock"}
                    </span>
                    <span className="text-slate-300 font-bold">{comingSoon ? "Preview" : `${soldOut ? "0" : totalStock} left`}</span>
                  </div>
                  <div className="h-1 w-full bg-border overflow-hidden mt-1.5">
                    <div className={`h-full ${comingSoon ? "bg-primary" : soldOut ? "bg-destructive" : totalStock <= 5 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${comingSoon ? 100 : Number.isFinite(totalStock) ? Math.min(100, Math.max(0, (totalStock / 15) * 100)) : 100}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Sizing selection */}
            {hasSizes && !comingSoon && !soldOut && (
              <div className="space-y-2 border-t border-border/20 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Select Size</h3>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      setTimeout(() => document.getElementById("sizing")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                    }}
                    className="min-h-8 px-2 text-[10px] font-bold uppercase tracking-wider text-primary hover:underline cursor-pointer"
                  >
                    Size Guide
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {variants.map(v => {
                    const sizeStock = Number(v.stock_quantity);
                    const isOut = Number.isFinite(sizeStock) && sizeStock <= 0;
                    const isSelected = selectedSize === v.size;
                    return (
                      <button
                        key={v.size}
                        onClick={() => !isOut && setSelectedSize(v.size)}
                        disabled={isOut}
                        className={`h-11 w-11 text-xs font-bold border transition-all ${
                          isOut ? "border-border/20 bg-muted/10 text-muted-foreground/30 cursor-not-allowed line-through" :
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground font-extrabold cursor-pointer" 
                            : "border-border bg-background/50 text-slate-300 hover:border-primary/50 cursor-pointer"
                        }`}
                      >
                        {v.size}
                      </button>
                    );
                  })}
                </div>
                {/* Per-size stock badges */}
                <div className="flex flex-wrap gap-1.5 text-[9px] font-bold uppercase tracking-wider">
                  {variants.map(v => {
                    const sizeStock = Number(v.stock_quantity);
                    return (
                      <span key={v.size} className={`px-1.5 py-0.5 border ${Number.isFinite(sizeStock) && sizeStock <= 0 ? "border-destructive/20 text-destructive/50" : sizeStock <= 3 ? "border-amber-500/20 text-amber-400" : "border-emerald-500/20 text-emerald-400"}`}>
                        {v.size}: {Number.isFinite(sizeStock) && sizeStock <= 0 ? "Sold" : `${sizeStock} left`}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sizing Details */}
            {hasSizes && variants.length > 0 && (
              <div className="border border-border/30 bg-muted/5 p-4 space-y-1.5 text-[11px] text-slate-300 font-medium">
                <span className="font-bold uppercase text-slate-200 block mb-1">Standard Fit &amp; Care</span>
                <p>• Heavyweight cotton fit. For an oversized fit, select one size up.</p>
                <p>• Cold wash inside out. Hang dry. Do not tumble dry.</p>
              </div>
            )}

            {/* Trust and Policy Bar */}
            <div className="grid grid-cols-2 gap-4 border-t border-border/20 pt-4 text-xs">
              <div className="space-y-1">
                <span className="font-bold text-foreground">🚚 Free Shipping</span>
                <p className="text-slate-300 text-[11px] leading-relaxed">Free delivery on orders over $150. Estimated delivery 4-7 business days.</p>
              </div>
              <div className="space-y-1">
                <span className="font-bold text-foreground">🔄 30-Day Returns</span>
                <p className="text-slate-300 text-[11px] leading-relaxed">Easy returns within 30 days for unworn items in original packaging.</p>
              </div>
            </div>
          </div>

          <div className="border-t border-border/30 p-4 bg-background/90 shrink-0">
            {!comingSoon && !soldOut && (
              <div className="flex gap-4">
                <div className="flex items-center border border-border h-12 bg-background">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="h-full w-10 text-slate-300 hover:text-white transition-colors cursor-pointer">-</button>
                  <span className="w-8 text-center font-mono font-bold">{quantity}</span>
                  <button onClick={() => {
                    const maxQty = selectedVariant?.stock_quantity != null && Number.isFinite(selectedVariant.stock_quantity)
                      ? selectedVariant.stock_quantity
                      : Number.isFinite(totalStock) ? totalStock : 99;
                    setQuantity(q => Math.min(maxQty, q + 1));
                  }} className="h-full w-10 text-slate-300 hover:text-white transition-colors cursor-pointer">+</button>
                </div>
                <Button onClick={handleAdd} disabled={quantity > ((selectedVariant?.stock_quantity != null && Number.isFinite(selectedVariant.stock_quantity)) ? selectedVariant.stock_quantity : (Number.isFinite(totalStock) ? totalStock : 99))} className="flex-1 h-12 rounded-none bg-primary hover:bg-primary/90 font-bold uppercase tracking-widest text-xs disabled:bg-muted disabled:text-slate-400">
                {quantity > ((selectedVariant?.stock_quantity != null && Number.isFinite(selectedVariant.stock_quantity)) ? selectedVariant.stock_quantity : (Number.isFinite(totalStock) ? totalStock : 99)) ? "Not enough stock" : `Add to Cart • $${(Number(product.price_aud || 0) * quantity).toFixed(2)} AUD`}
                </Button>
              </div>
            )}
            {(comingSoon || soldOut) && (
              <Button disabled className="w-full h-12 rounded-none bg-muted text-slate-400 font-bold uppercase tracking-widest text-xs">
                {comingSoon ? "Coming Soon" : "Sold Out"}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/* ── Skeleton Loading Grid ── */
function SkeletonLoader() {
  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className="border border-border/30 bg-muted/10 flex flex-col overflow-hidden">
          {/* Image placeholder */}
          <div className="aspect-square w-full bg-muted/10 animate-pulse border-b border-border/30" />
          {/* Content area */}
          <div className="p-6 space-y-4">
            {/* Title bar */}
            <div className="h-6 bg-muted/10 animate-pulse w-3/4 border border-border/30" />
            {/* Description bars */}
            <div className="space-y-2">
              <div className="h-4 bg-muted/10 animate-pulse w-full border border-border/30" />
              <div className="h-4 bg-muted/10 animate-pulse w-5/6 border border-border/30" />
            </div>
            {/* Stock bar */}
            <div className="h-1 bg-muted/10 animate-pulse w-full border border-border/30" />
            {/* Price + button row */}
            <div className="flex items-center justify-between border-t border-border/30 pt-4">
              <div className="h-5 bg-muted/10 animate-pulse w-24 border border-border/30" />
              <div className="h-9 bg-muted/10 animate-pulse w-20 border border-border/30" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StoreExperienceRail({ productCount, categoryCount, cartCount, onCartOpen }) {
  const items = [
    {
      icon: Truck,
      label: "Shipping",
      value: "Free over $150 AUD",
      detail: "Estimates at checkout",
      tone: "text-primary",
    },
    {
      icon: CheckCircle2,
      label: "Orders",
      value: "Track in profile",
      detail: "Receipts and status",
      tone: "text-emerald-400",
    },
    {
      icon: Lock,
      label: "Checkout",
      value: "Stripe secured",
      detail: "Card details protected",
      tone: "text-sky-300",
    },
    {
      icon: ShoppingBag,
      label: "Store",
      value: `${productCount} item${productCount === 1 ? "" : "s"}`,
      detail: `${categoryCount} categor${categoryCount === 1 ? "y" : "ies"}`,
      tone: "text-accent",
    },
  ];

  return (
    <section className="mt-6 grid gap-3 border border-border/60 bg-card/35 p-3 cmd-glass sm:grid-cols-2 lg:grid-cols-4" aria-label="Store shopping benefits">
      {items.map(({ icon: Icon, label, value, detail, tone }) => (
        <div key={label} className="flex min-w-0 items-center gap-3 border border-border/40 bg-background/35 p-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center border border-border/60 bg-card/55 ${tone}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
            <p className="truncate text-sm font-extrabold text-foreground">{value}</p>
            <p className="truncate text-[11px] text-muted-foreground">{detail}</p>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onCartOpen}
        className="flex min-h-11 items-center justify-between border border-primary/25 bg-primary/[0.055] px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.22em] text-primary transition-colors hover:bg-primary/10 sm:col-span-2 lg:hidden"
      >
        <span>{cartCount > 0 ? `${cartCount} item${cartCount === 1 ? "" : "s"} in cart` : "Open cart"}</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </section>
  );
}

function StoreSizeGuide() {
  const rows = [
    { size: "S", chest: "92-97 cm", fit: "Slim supporter fit" },
    { size: "M", chest: "98-103 cm", fit: "Regular match-day fit" },
    { size: "L", chest: "104-109 cm", fit: "Regular relaxed fit" },
    { size: "XL", chest: "110-116 cm", fit: "Relaxed travel fit" },
    { size: "2XL", chest: "117-123 cm", fit: "Roomy supporter fit" },
  ];

  return (
    <section id="sizing" className="mt-12 border border-border/50 bg-card/25 p-4 cmd-glass sm:p-5" aria-labelledby="store-size-guide-title">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">
            <Ruler className="h-3.5 w-3.5" /> Size guide
          </p>
          <h2 id="store-size-guide-title" className="mt-2 font-display text-2xl uppercase tracking-wide text-foreground sm:text-3xl">
            Pick the right fit
          </h2>
        </div>
        <p className="max-w-sm text-xs leading-5 text-muted-foreground">
          General apparel guide. If you prefer a looser travel-day fit, choose one size up.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        {rows.map((row) => (
          <div key={row.size} className="border border-border/45 bg-background/35 p-3">
            <p className="font-display text-2xl uppercase text-foreground">{row.size}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">{row.chest}</p>
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{row.fit}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Main Store Component ── */
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
  const [checkoutNotice, setCheckoutNotice] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [quickViewProduct, setQuickViewProduct] = useState(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("sort_order", 50),
    enabled: appParams.hasBase44Config,
    staleTime: 60000, // Cache products list for 1 minute
    gcTime: 300000,   // Keep in cache garbage collection for 5 minutes
  });
  const { data: settingsRecords = [] } = useQuery({
    queryKey: ["siteSettings"],
    queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });
  const videoSources = settingsRecords[0]?.background_video_urls?.length
    ? settingsRecords[0].background_video_urls
    : DEFAULT_BACKGROUND_VIDEO_SOURCES;

  const visibleProducts = useMemo(() => {
    return products.filter((product) => product.is_active !== false);
  }, [products]);

  useEffect(() => {
    if (isLoading || !appParams.hasBase44Config || cart.length === 0) return;

    const productsById = new Map(visibleProducts.map((product) => [product.id, product]));
    let changed = false;
    const nextCart = cart.flatMap((item) => {
      const product = productsById.get(item.id);
      if (!product) {
        changed = true;
        return [];
      }
      const stock = Number(product.stock_quantity);
      if (product.coming_soon === true || (Number.isFinite(stock) && stock <= 0)) {
        changed = true;
        return [];
      }

      const maxQuantity = Number.isFinite(stock) ? Math.min(stock, 20) : 20;
      const quantity = Math.min(item.quantity, maxQuantity);
      const updated = {
        ...item,
        name: product.name,
        price_aud: product.price_aud,
        image_url: product.image_url,
        stock_quantity: product.stock_quantity,
        quantity,
      };

      if (quantity !== item.quantity || updated.name !== item.name || updated.price_aud !== item.price_aud || updated.stock_quantity !== item.stock_quantity) {
        changed = true;
      }
      return [updated];
    });

    if (changed) {
      setCart(nextCart);
      setCheckoutError("");
      setCheckoutNotice("Some unavailable cart items were removed. Please review your cart before checkout.");
    }
  }, [isLoading, visibleProducts, cart]);

  // Extract categories dynamically
  const categories = useMemo(() => {
    const list = new Set();
    visibleProducts.forEach(p => {
      if (p.category) list.add(p.category);
    });
    return ["All", ...Array.from(list)];
  }, [visibleProducts]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "All") return visibleProducts;
    return visibleProducts.filter(p => p.category === selectedCategory);
  }, [visibleProducts, selectedCategory]);

  useEffect(() => {
    localStorage.setItem("rlt_cart", JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent("rlt_cart_changed", { detail: { count: cart.reduce((s, i) => s + i.quantity, 0) } }));
  }, [cart]);

  // Lock body scroll when cart drawer is open
  useEffect(() => {
    if (cartOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [cartOpen]);

  useEffect(() => {
    const openCart = () => setCartOpen(true);
    window.addEventListener("rlt_open_cart", openCart);
    return () => window.removeEventListener("rlt_open_cart", openCart);
  }, []);

  // Prefill checkout details for signed-in buyers (they can still edit them).
  useEffect(() => {
    if (user?.email) {
      setCheckoutName((current) => current || user.full_name || "");
      setCheckoutEmail((current) => current || user.email || "");
    }
  }, [user?.email, user?.full_name]);

  const addToCart = useCallback((product, size) => {
    if (product.coming_soon === true) return;

    // Determine max quantity: per-size stock takes priority, fall back to total stock
    let maxQuantity = 20;
    if (size) {
      const variants = normalizeSizeVariants(product?.sizes);
      const variant = variants.find(v => v.size === size);
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

    lightImpact();
    const cartItemId = product.id + (size ? "-" + size : "");

    setCart((curr) => {
      const existing = curr.find((item) => item.cartItemId === cartItemId);
      if (existing) {
        if (existing.quantity >= maxQuantity) {
          toast({ title: "Stock limit reached", description: `You can add up to ${maxQuantity} of this item.` });
        }
        return curr.map((item) => 
          item.cartItemId === cartItemId ? { ...item, quantity: Math.min(item.quantity + 1, maxQuantity) } : item
        );
      }
      return [...curr, { cartItemId, id: product.id, name: product.name, price_aud: product.price_aud, image_url: product.image_url, stock_quantity: product.stock_quantity, quantity: 1, size }];
    });
    setCartOpen(true);
  }, []);

  const subscribeToRelease = useCallback(async (product, email) => {
    if (!product?.id || !email) return false;
    const response = await base44.functions.invoke("subscribeProductRelease", {
      productId: product.id,
      email,
      name: user?.full_name || "",
    });
    toast({
      title: response?.data?.alreadyLive ? "Already live" : "Release alert saved",
      description: response?.data?.alreadyLive ? "This product is already available in the store." : "We'll let you know when it drops.",
    });
    return true;
  }, [user?.full_name]);

  const updateQuantity = useCallback((cartItemId, change) => {
    setCart((curr) => 
      curr.map((item) => {
        if (item.cartItemId === cartItemId) {
          const stock = Number(item.stock_quantity);
          const maxQuantity = Number.isFinite(stock) ? Math.min(stock, 20) : 20;
          const newQty = Math.max(1, Math.min(item.quantity + change, maxQuantity));
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  }, []);

  const removeFromCart = useCallback((cartItemId) => {
    setCart((curr) => curr.filter((item) => item.cartItemId !== cartItemId));
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + (Number(item.price_aud || 0) * item.quantity), 0);

  // Free shipping threshold logic
  const shippingThreshold = 150;
  const progressPercent = Math.min(100, (cartSubtotal / shippingThreshold) * 100);
  const needsMore = Math.max(0, shippingThreshold - cartSubtotal);
  const isFreeShipping = cartSubtotal >= shippingThreshold;

  // AusPost live rate calculation — a real quote (or a $0 override once the
  // free-shipping threshold is hit) is required before checkout can proceed.
  const [shippingPostcode, setShippingPostcode] = useState("");
  const [shippingRates, setShippingRates] = useState([]);
  const [shippingRatesFor, setShippingRatesFor] = useState("");
  const [selectedShippingCode, setSelectedShippingCode] = useState("");
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");

  const cartSignature = useMemo(
    () => cart.map((item) => `${item.id}:${item.quantity}`).sort().join("|"),
    [cart]
  );
  const ratesStale = !shippingRates.length || shippingRatesFor !== `${shippingPostcode.trim()}::${cartSignature}`;
  const selectedRate = shippingRates.find((rate) => rate.code === selectedShippingCode);

  const calculateShipping = async () => {
    const trimmed = shippingPostcode.trim();
    if (!/^\d{4}$/.test(trimmed)) {
      setShippingError("Enter a valid 4-digit Australian postcode.");
      return;
    }
    setShippingLoading(true);
    setShippingError("");
    try {
      const response = await base44.functions.invoke("auspostRates", {
        toPostcode: trimmed,
        cart: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
      });
      const services = response?.data?.services || [];
      if (!services.length) throw new Error("No AusPost shipping options are available for this postcode.");
      setShippingRates(services);
      setShippingRatesFor(`${trimmed}::${cartSignature}`);
      setSelectedShippingCode(services[0].code);
    } catch (err) {
      const message = err?.response?.data?.error || err?.data?.error || err?.message || "Could not calculate shipping right now.";
      setShippingError(message);
      setShippingRates([]);
      setShippingRatesFor("");
      setSelectedShippingCode("");
    } finally {
      setShippingLoading(false);
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0 || !checkoutEmail) return;

    if (ratesStale || !selectedRate) {
      setShippingError("Please calculate and select a shipping option before checkout.");
      return;
    }

    if (window.self !== window.top) {
      // Info-style notice (not an error): the preview iframe blocks the Stripe redirect.
      setCheckoutError("");
      setCheckoutNotice("Checkout works from the published app, not inside the preview window. Open the live site to complete your order.");
      return;
    }

    setCheckingOut(true);
    setCheckoutError("");
    setCheckoutNotice("");
    try {
      const response = await base44.functions.invoke("createCheckout", {
        items: cart.map((item) => ({ productId: item.id, quantity: item.quantity, size: item.size || "" })),
        customerName: checkoutName,
        customerEmail: checkoutEmail,
        shipping: {
          code: selectedRate.code,
          name: selectedRate.name,
          postcode: shippingPostcode.trim(),
          price_aud: isFreeShipping ? 0 : selectedRate.price_aud,
        },
      });

      if (response?.data?.url) {
        new URL(response.data.url);
        // Native shell: hand off to the system browser sheet so the WebView
        // stays on the local app; web keeps the full-page Stripe redirect.
        mediumImpact();
        await openExternalUrl(response.data.url, { fallback: "navigate" });
      } else {
        throw new Error("Failed to create checkout session.");
      }
    } catch (err) {
      const errorData = err?.response?.data || err?.data || {};
      if (errorData.unavailableProductIds?.length) {
        setCart((curr) => curr.filter((item) => !errorData.unavailableProductIds.includes(item.id)));
        setCheckoutNotice("Some unavailable cart items were removed. Please review your cart before checkout.");
      }
      setCheckoutError(errorData.error || err?.message || "An error occurred during checkout.");
    } finally {
      setCheckingOut(false);
    }
  };

  const isSuccess = searchParams.get("success") === "true";
  const isCancelled = searchParams.get("cancelled") === "true";

  useEffect(() => {
    if (!isSuccess) return;
    localStorage.removeItem("rlt_cart");
    setCart([]);
  }, [isSuccess]);

  const clearAlerts = () => {
    setSearchParams({});
  };

  return (
    <main className="relative min-h-dvh bg-background px-5 pb-[calc(5rem+var(--safe-bottom))] pt-[calc(7.25rem+env(safe-area-inset-top,0px))] text-foreground md:px-8 overflow-hidden">
      <BackgroundVideo sources={videoSources} />
      <div className="relative z-10">
      {/* Background visual components */}
      <div className="absolute inset-0 cmd-grid-bg opacity-30 z-0 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl z-0 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-accent/5 blur-3xl z-0 pointer-events-none" />

      {/* Decorative Floating Shapes */}
      <motion.div
        animate={{ y: [0, -18, 0], x: [0, 8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-44 left-16 w-32 h-32 rounded-full bg-primary/5 blur-2xl pointer-events-none hidden lg:block"
      />
      <motion.div
        animate={{ y: [0, 15, 0], x: [0, -10, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-36 right-16 w-44 h-44 rounded-full bg-accent/5 blur-2xl pointer-events-none hidden lg:block"
      />

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Header Block */}
        <div className="flex flex-col gap-5 border-b border-border/60 pb-7 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-primary flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3 w-3 animate-pulse" /> Official Supporter Gear
            </p>
            <h1 className="font-display text-4xl uppercase tracking-tight sm:text-5xl md:text-6xl text-foreground">
              Vegas Takeover Store
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Official supporter gear, clear checkout steps, and order tracking from your account after purchase.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-3">
            <button 
              onClick={() => setCartOpen(true)}
              className="relative flex h-12 items-center justify-center gap-2 border border-border bg-card/60 px-3 cmd-glass transition-colors hover:border-primary hover:text-primary shadow-[0_0_15px_rgba(0,0,0,0.2)] sm:px-5"
            >
              <ShoppingCart className="h-5 w-5 text-accent" />
              <span className="text-xs font-bold uppercase tracking-wider">Cart</span>
              {cartCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center bg-primary text-[10px] font-bold text-primary-foreground rounded-none shadow-[0_0_10px_rgba(249,115,22,0.4)]">
                  {cartCount}
                </span>
              )}
            </button>
            <Button asChild variant="outline" className="h-12 rounded-none border-border bg-card/20 backdrop-blur-sm hover:bg-card">
              <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Home</Link>
            </Button>
          </div>
        </div>

        {/* Success/Cancel Banners */}
        <AnimatePresence>
          {isSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-6 border border-emerald-500/30 bg-emerald-500/10 p-6 cmd-glass shadow-lg text-emerald-400 space-y-4"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-display text-xl uppercase tracking-wider text-foreground">Order Placed Successfully!</h3>
                  <p className="text-sm text-slate-200 mt-1">Thank you for your purchase. We've sent a detailed receipt to your email address.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 pt-2">
                <Link to="/account" className="flex items-center justify-between border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 min-h-[44px] text-xs font-bold uppercase tracking-wider text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors">
                  <span>Track in My Orders</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <Link to="/forum" className="flex items-center justify-between border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 min-h-[44px] text-xs font-bold uppercase tracking-wider text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors">
                  <span>Join the Forum</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <button onClick={clearAlerts} className="flex items-center justify-between border border-border bg-card/25 px-4 py-3 min-h-[44px] text-xs font-bold uppercase tracking-wider text-foreground hover:bg-card transition-colors cursor-pointer">
                  <span>Continue Shopping</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {isCancelled && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-6 flex items-center justify-between border border-primary/30 bg-primary/10 p-4 text-primary cmd-glass shadow-lg"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm font-semibold">Checkout cancelled. Your items are safe in your cart.</p>
              </div>
              <button onClick={clearAlerts} className="min-h-[44px] min-w-[44px] p-3 text-xs uppercase tracking-wider font-bold hover:text-white transition-colors underline cursor-pointer">Dismiss</button>
            </motion.div>
          )}
        </AnimatePresence>

        <StoreExperienceRail
          productCount={visibleProducts.length}
          categoryCount={Math.max(categories.length - 1, 0)}
          cartCount={cartCount}
          onCartOpen={() => setCartOpen(true)}
        />

        {/* Category Pill Filters */}
        {categories.length > 1 && (
          <div className="mt-8 border-b border-border/30 pb-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-300">Browse the drop</span>
              <span className="text-[10px] font-mono text-muted-foreground">{filteredProducts.length} visible</span>
            </div>
            <div role="tablist" className="store-category-rail -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  role="tab"
                  aria-selected={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`min-h-[44px] shrink-0 border px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? "border-primary bg-primary text-primary-foreground shadow-[0_0_12px_rgba(249,115,22,0.3)]"
                      : "border-border bg-card/40 text-slate-300 hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Store Grid Area */}
        <div className="mt-10">
          {isLoading ? (
            <SkeletonLoader />
          ) : filteredProducts.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="border border-border bg-card/30 cmd-glass p-16 text-center max-w-lg mx-auto"
            >
              <BagIcon className="mx-auto h-12 w-12 text-slate-400 stroke-1 mb-4 animate-bounce" />
              <h3 className="font-display text-2xl uppercase tracking-wide mb-2">No merchandise found</h3>
              <p className="text-sm text-slate-300 leading-relaxed font-medium">
                We're currently stocking the shelves with official Las Vegas Takeover gear. Check back shortly!
              </p>
            </motion.div>
          ) : (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product, idx) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  index={idx}
                  addToCart={addToCart}
                  cart={cart}
                  user={user}
                  onSubscribeRelease={subscribeToRelease}
                  onOpenQuickView={setQuickViewProduct}
                />
              ))}
            </div>
          )}
          {/* Sponsored */}
          <div className="py-8">
            <AdSlot position="banner-bottom" size="leaderboard" className="w-full" />
          </div>
          <StoreSizeGuide />
          <StoreFaq />
        </div>
      </div>
      </div>

      {/* Rendered outside the z-10 content wrapper — the cart drawer, floating
          cart FAB and quick view modal are fixed overlays whose z-index must
          escape to cover the fixed nav/tab bar, which a nested stacking
          context would trap. */}
      {/* Cart Drawer & Slide-over Overlay */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "linear" }}
              style={{ willChange: "opacity" }}
              onClick={() => setCartOpen(false)}
              className="fixed inset-0 z-40 bg-black/65 lg:hidden cursor-pointer"
              role="button"
              aria-label="Close cart"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.3 }}
              style={{ willChange: "transform" }}
              className="fixed bottom-0 right-0 top-0 z-50 flex h-dvh w-full flex-col border-l border-border/80 bg-card p-5 pb-safe shadow-[0_0_50px_rgba(0,0,0,0.5)] md:max-w-md md:p-6"
              role="dialog"
              aria-modal="true"
              aria-label="Shopping cart"
            >
              <div className="absolute left-[-2px] top-0 bottom-0 w-[2px] cmd-accent-bar" />

              <div className="flex items-center justify-between border-b border-border pb-4">
                <h3 className="flex items-center gap-2 font-display text-2xl uppercase tracking-wider text-foreground">
                  <ShoppingBag className="h-5 w-5 text-primary" /> Your Cart
                </h3>
                <button
                  onClick={() => setCartOpen(false)}
                  className="min-h-[44px] px-4 py-3 text-xs uppercase tracking-[0.25em] text-slate-300 hover:text-primary transition-colors font-bold cursor-pointer"
                  aria-label="Close cart"
                >
                  Close
                </button>
              </div>

              {cart.length > 0 && (
                <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-slate-300 border-b border-border/10 pb-3 pt-4 mb-1">
                  <span className="text-primary flex items-center gap-1 font-extrabold">1. Cart</span>
                  <span className="text-muted-foreground/30">→</span>
                  <span className={checkoutEmail ? "text-primary flex items-center gap-1 font-extrabold" : "text-slate-400"}>2. Details</span>
                  <span className="text-muted-foreground/30">→</span>
                  <span className="text-slate-400">3. Pay</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto cmd-scrollbar py-4 pr-1">
                {cart.length === 0 ? (
                  <div className="flex h-64 flex-col items-center justify-center text-center px-4">
                    <motion.div
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <ShoppingBag className="h-14 w-14 stroke-1 mb-4 text-muted-foreground" />
                    </motion.div>
                    <h4 className="text-lg font-display uppercase tracking-wider text-foreground">Your cart is empty</h4>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xs">Browse our merch collection and add items to get started</p>
                    <Button
                      onClick={() => setCartOpen(false)}
                      variant="outline"
                      className="mt-6 rounded-none border-primary text-primary hover:bg-primary hover:text-primary-foreground font-bold uppercase tracking-widest text-xs px-6 py-3 cursor-pointer"
                    >
                      Continue Shopping
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {cart.map((item) => (
                      <motion.div
                        key={item.cartItemId}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="flex gap-4 border border-border bg-background/50 p-3 hover:border-primary/20 transition-all duration-300 relative group/item"
                      >
                        <div className="h-16 w-16 flex-shrink-0 bg-muted/10 border border-border/50 overflow-hidden">
                          {item.image_url && (
                            <img src={item.image_url} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover/item:scale-105" />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col justify-between">
                          <div>
                            <h4 className="text-sm font-bold uppercase tracking-wide line-clamp-1 text-foreground">{item.name}</h4>
                            {item.size && (
                              <span className="inline-block bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary px-1.5 py-0.5 uppercase tracking-wider mt-1">
                                Size: {item.size}
                              </span>
                            )}
                            <p className="text-xs text-accent mt-1 font-mono font-semibold">${Number(item.price_aud || 0).toFixed(2)} AUD</p>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center border border-border">
                              <button
                                onClick={() => updateQuantity(item.cartItemId, -1)}
                                aria-label={`Decrease quantity of ${item.name}`}
                                className="flex h-11 w-11 items-center justify-center bg-card text-slate-300 transition-colors hover:bg-muted hover:text-white cursor-pointer"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-10 text-center text-xs font-mono font-bold text-foreground">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.cartItemId, 1)}
                                aria-label={`Increase quantity of ${item.name}`}
                                className="flex h-11 w-11 items-center justify-center bg-card text-slate-300 transition-colors hover:bg-muted hover:text-white cursor-pointer"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <button 
                              onClick={() => removeFromCart(item.cartItemId)}
                              className="touch-target flex items-center justify-center text-slate-400 transition-colors hover:text-destructive cursor-pointer"
                              aria-label="Remove item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="border-t border-border/60 bg-card/60 pt-4 backdrop-blur-md pb-safe">
                  <div className="mb-4 bg-muted/20 border border-border/40 p-3 space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1">{needsMore > 0 ? `Spend $${needsMore.toFixed(2)} AUD more for free shipping` : <><Rocket className="h-3 w-3 inline" /> You qualify for free shipping!</>}</span>
                    </div>
                    <div className="h-1.5 w-full bg-border overflow-hidden rounded-full">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-primary to-accent"
                      />
                    </div>
                  </div>

                  <div className="mb-4 border border-border/40 bg-background/35 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                        <Truck className="h-3 w-3 text-primary" /> Shipping (AusPost, domestic AU)
                      </p>
                      {selectedRate && !ratesStale && (
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          {isFreeShipping ? "FREE" : `$${Number(selectedRate.price_aud).toFixed(2)} AUD`}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <label htmlFor="shipping-postcode" className="sr-only">Delivery postcode</label>
                      <Input
                        id="shipping-postcode"
                        placeholder="Postcode e.g. 4000"
                        inputMode="numeric"
                        maxLength={4}
                        value={shippingPostcode}
                        onChange={(e) => setShippingPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="h-10 rounded-none bg-background/50 border-border text-sm"
                      />
                      <Button
                        type="button"
                        onClick={calculateShipping}
                        disabled={shippingLoading || shippingPostcode.length !== 4}
                        variant="outline"
                        className="h-10 shrink-0 rounded-none border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3"
                      >
                        {shippingLoading ? "Calculating…" : "Calculate"}
                      </Button>
                    </div>

                    {shippingError && (
                      <p className="flex items-center gap-1.5 text-[10px] font-medium text-destructive" role="alert">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {shippingError}
                      </p>
                    )}

                    {!ratesStale && shippingRates.length > 0 && (
                      <div className="space-y-1.5">
                        {shippingRates.map((rate) => (
                          <label
                            key={rate.code}
                            className={`flex cursor-pointer items-center justify-between gap-2 border px-3 py-2 text-xs transition-colors ${
                              selectedShippingCode === rate.code ? "border-primary bg-primary/5" : "border-border/40 hover:border-border"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="shipping-rate"
                                value={rate.code}
                                checked={selectedShippingCode === rate.code}
                                onChange={() => setSelectedShippingCode(rate.code)}
                                className="h-3.5 w-3.5 accent-primary"
                              />
                              <span>
                                <span className="block font-bold text-foreground">{rate.name}</span>
                                {rate.delivery_time && <span className="block text-[10px] text-muted-foreground">{rate.delivery_time}</span>}
                              </span>
                            </span>
                            <span className="shrink-0 font-mono font-bold text-accent">
                              {isFreeShipping ? "FREE" : `$${Number(rate.price_aud).toFixed(2)}`}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    {ratesStale && shippingRates.length > 0 && (
                      <p className="text-[10px] font-medium text-amber-400">Cart or postcode changed — recalculate shipping.</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-base font-bold uppercase tracking-wider mb-4 border-b border-border/30 pb-3">
                    <span>Total</span>
                    <span className="text-accent font-mono tracking-tight text-lg">
                      ${(cartSubtotal + (selectedRate && !ratesStale ? (isFreeShipping ? 0 : Number(selectedRate.price_aud)) : 0)).toFixed(2)} AUD
                    </span>
                  </div>

                  <form onSubmit={handleCheckout} className="grid gap-3">
                    {checkoutError && (
                      <p className="border border-destructive/50 bg-destructive/10 p-3 text-xs font-semibold text-foreground flex items-center gap-2" role="alert" aria-live="polite">
                        <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                        <span>{checkoutError}</span>
                      </p>
                    )}
                    {checkoutNotice && (
                      <p className="border border-sky-500/40 bg-sky-500/10 p-3 text-xs font-medium text-slate-200 flex items-center gap-2" role="status">
                        <Info className="h-4 w-4 text-sky-400 flex-shrink-0" />
                        <span>{checkoutNotice}</span>
                      </p>
                    )}

                    <div className="relative">
                      <label htmlFor="checkout-name" className="sr-only">Your full name</label>
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="checkout-name"
                        required
                        placeholder="Your full name"
                        value={checkoutName}
                        onChange={(e) => setCheckoutName(e.target.value)}
                        className="h-10 pl-9 rounded-none bg-background/50 border-border focus-visible:ring-primary text-foreground"
                      />
                    </div>
                    <div className="relative">
                      <label htmlFor="checkout-email" className="sr-only">Receipt email address</label>
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="checkout-email"
                        required
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="Receipt email address"
                        value={checkoutEmail}
                        onChange={(e) => setCheckoutEmail(e.target.value)}
                        className="h-10 pl-9 rounded-none bg-background/50 border-border focus-visible:ring-primary"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={checkingOut || ratesStale || !selectedRate}
                      className="h-12 w-full rounded-none bg-primary hover:bg-primary/95 text-white font-bold uppercase tracking-widest text-xs mt-2 shadow-[0_0_20px_rgba(249,115,22,0.2)] hover:shadow-[0_0_25px_rgba(249,115,22,0.45)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      <CreditCard className="h-4 w-4" />
                      {checkingOut
                        ? "Connecting to Stripe..."
                        : ratesStale || !selectedRate
                          ? "Calculate shipping to continue"
                          : `Checkout • $${(cartSubtotal + (isFreeShipping ? 0 : Number(selectedRate.price_aud))).toFixed(2)} AUD`}
                    </Button>
                    <p className="flex items-center justify-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                      <Lock className="h-3 w-3 text-emerald-400" /> Secure checkout by Stripe
                    </p>
                  </form>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Cart FAB on Mobile */}
      <AnimatePresence>
        {!cartOpen && cartCount > 0 && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setCartOpen(true)}
            className="fixed bottom-[calc(5.5rem+var(--safe-bottom))] right-6 z-[45] flex items-center justify-center rounded-none border border-primary-foreground/15 bg-primary p-4 text-white shadow-[0_0_25px_rgba(249,115,22,0.5)] pointer-events-auto hover:bg-primary/95 active:scale-95 group lg:bottom-[calc(1.5rem+var(--safe-bottom))] cursor-pointer"
          >
            <ShoppingCart className="h-6 w-6 group-hover:scale-110 transition-transform" />
            <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center bg-accent text-[11px] font-bold text-accent-foreground rounded-none shadow-md border border-accent-foreground/10 animate-bounce">
              {cartCount}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Product Quick View Modal */}
      <ProductQuickViewModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        addToCart={addToCart}
        cart={cart}
        user={user}
      />
    </main>
  );
}