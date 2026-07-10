import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Share2, ShoppingBag, PackageX } from "lucide-react";
import { useProducts } from "@/hooks/data/use-fan-data";
import { normalizeSizeVariants, maxQuantityFor, formatAud } from "@/lib/store-products";
import { readCart, writeCart, addItemToCart } from "@/lib/cart-store";
import { shareProduct } from "@/lib/native/share";
import { emitHaptic } from "@/lib/native/haptic-events";
import { toast } from "@/components/ui/use-toast";
import { hideBrokenImage } from "@/lib/img-fallback";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import NativeCartSheet from "./NativeCartSheet.jsx";

/**
 * Native product detail at /store/product/:id — image gallery, size/stock
 * selection and add-to-cart against the shared rlt_cart contract. Deep-link
 * and share target for products.
 */
export default function NativeProductScreen() {
  const { id } = useParams();
  const { data: products = [], isLoading } = useProducts();
  const product = useMemo(() => products.find((p) => String(p.id) === String(id)) || null, [products, id]);

  const variants = useMemo(() => normalizeSizeVariants(product?.sizes), [product]);
  const sizeLabels = variants.map((v) => v.size);
  const [size, setSize] = useState("");
  const [activeImg, setActiveImg] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    if (!sizeLabels.length) {
      setSize("");
      return;
    }
    setSize((current) => (sizeLabels.includes(current) ? current : sizeLabels.includes("M") ? "M" : sizeLabels[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const gallery = useMemo(
    () => [product?.image_url, product?.image_url_2].filter(Boolean),
    [product]
  );
  const max = maxQuantityFor(product, size || undefined);
  const unavailable = !product || product.coming_soon === true || max <= 0;

  const handleAdd = () => {
    const { cart, outcome } = addItemToCart(readCart(), product, size || undefined);
    if (outcome === "added") {
      writeCart(cart);
      emitHaptic("cart.add");
      toast({ title: "Added to cart", description: product.name });
      setCartOpen(true);
    } else if (outcome === "limit") {
      emitHaptic("mutation.warning");
      toast({ title: "Stock limit reached", description: `You can add up to ${max} of this item.` });
    } else {
      emitHaptic("mutation.error");
      toast({ title: "Unavailable", description: "This item can't be added right now.", variant: "destructive" });
    }
  };

  const topActions = product ? (
    <button
      type="button"
      aria-label="Share product"
      onClick={() => {
        emitHaptic("action.primary");
        shareProduct(product);
      }}
      className="ios-pressable flex h-11 w-11 items-center justify-center text-muted-foreground"
    >
      <Share2 className="h-5 w-5" aria-hidden="true" />
    </button>
  ) : null;

  return (
    <div className="min-h-dvh bg-background pb-32 text-foreground">
      <NativeTopBar title="Product" fallback="/store" right={topActions} />

      {isLoading && !product && (
        <div className="space-y-3 px-4 pt-4">
          <NativeSkeleton className="aspect-square w-full" />
          <NativeSkeleton className="h-7 w-2/3" />
          <NativeSkeleton className="h-12 w-full" />
        </div>
      )}

      {!isLoading && !product && (
        <div className="px-4 pt-8">
          <NativeEmptyState icon={PackageX} title="Product not found" description="It may have been removed from the range." />
        </div>
      )}

      {product && (
        <div className="mx-auto w-full max-w-2xl">
          <div className="relative">
            {gallery.length > 0 && (
              <img
                src={gallery[Math.min(activeImg, gallery.length - 1)]}
                alt={product.name}
                onError={hideBrokenImage}
                className="aspect-square w-full border-b border-border/50 object-cover"
              />
            )}
            {gallery.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                {gallery.map((src, idx) => (
                  <button
                    key={src}
                    type="button"
                    aria-label={`Image ${idx + 1}`}
                    onClick={() => setActiveImg(idx)}
                    className={`h-2.5 w-2.5 rounded-full border border-black/40 ${activeImg === idx ? "bg-primary" : "bg-white/60"}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="px-4 pt-4">
            {product.category && (
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary">{product.category}</p>
            )}
            <h1 className="pt-1 font-display text-xl font-bold uppercase leading-tight tracking-wide">{product.name}</h1>
            <p className="pt-1 text-xl font-black text-primary">
              {formatAud(product.price_aud)} <span className="text-[10px] font-bold text-muted-foreground">AUD</span>
            </p>
            {product.description && (
              <p className="whitespace-pre-wrap pt-3 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
            )}

            {sizeLabels.length > 0 && (
              <div className="pt-4">
                <p className="pb-2 text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Size</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
                  {variants.map((variant) => {
                    const optionMax = maxQuantityFor(product, variant.size);
                    const disabled = optionMax <= 0;
                    return (
                      <button
                        key={variant.size}
                        type="button"
                        role="radio"
                        aria-checked={size === variant.size}
                        disabled={disabled}
                        onClick={() => {
                          emitHaptic("sheet.snap");
                          setSize(variant.size);
                        }}
                        className={`ios-pressable min-h-11 min-w-12 border px-3 text-sm font-bold uppercase ${
                          size === variant.size
                            ? "border-primary bg-primary/15 text-primary"
                            : disabled
                              ? "border-border/40 text-muted-foreground/40 line-through"
                              : "border-border"
                        }`}
                      >
                        {variant.size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="pt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {product.coming_soon ? "Dropping soon — not yet on sale" : max > 0 ? (max <= 3 ? `Only ${max} left` : "In stock") : "Sold out"}
            </p>
          </div>
        </div>
      )}

      {product && (
        <div className="fixed inset-x-0 bottom-[calc(72px+var(--safe-bottom))] z-30 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto w-full max-w-2xl">
            <button
              type="button"
              disabled={unavailable}
              onClick={handleAdd}
              className="ios-pressable flex min-h-12 w-full items-center justify-center gap-2 bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.35)] disabled:opacity-40"
            >
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              {product.coming_soon ? "Coming soon" : max <= 0 ? "Sold out" : "Add to cart"}
            </button>
          </div>
        </div>
      )}

      <NativeCartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
