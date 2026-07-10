import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import PullToRefresh from "@/components/PullToRefresh";
import { useProducts } from "@/hooks/data/use-fan-data";
import { productPath, formatAud } from "@/lib/store-products";
import { hideBrokenImage } from "@/lib/img-fallback";
import { emitHaptic } from "@/lib/native/haptic-events";
import { NativeSkeleton, NativeEmptyState, NativeSponsorCard } from "../../components/NativePrimitives.jsx";
import NativeCartSheet from "./NativeCartSheet.jsx";

function ProductCard({ product }) {
  const out = Number(product.stock_quantity) === 0 && !product.coming_soon;
  return (
    <Link to={productPath(product)} className="ios-pressable block border border-border/60 bg-card/50">
      <div className="relative aspect-square w-full overflow-hidden bg-background/60">
        {product.image_url && (
          <img src={product.image_url} alt={product.name} onError={hideBrokenImage} className="h-full w-full object-cover" loading="lazy" />
        )}
        {product.coming_soon && (
          <span className="absolute left-2 top-2 bg-primary px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-primary-foreground">
            Coming soon
          </span>
        )}
        {out && (
          <span className="absolute left-2 top-2 bg-red-500/90 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white">
            Sold out
          </span>
        )}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 text-xs font-bold uppercase leading-snug tracking-wide">{product.name}</p>
        <p className="pt-1 text-sm font-black text-primary">{formatAud(product.price_aud)} <span className="text-[9px] font-bold text-muted-foreground">AUD</span></p>
      </div>
    </Link>
  );
}

/**
 * Native Store tab: two-up catalogue with category chips, every product a
 * real /store/product/:id route, and the persistent cart sheet.
 */
export default function NativeStoreScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: products = [], isLoading } = useProducts();
  const [category, setCategory] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);

  // Stripe returns land on /store?success|cancelled (the web contract);
  // in the shell they resolve to the native confirmation screens.
  useEffect(() => {
    if (searchParams.get("success") === "true") navigate("/store/checkout/success", { replace: true });
    else if (searchParams.get("cancelled") === "true") navigate("/store/checkout/cancel", { replace: true });
  }, [searchParams, navigate]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ["All", ...set];
  }, [products]);

  const visible = useMemo(
    () => (category === "All" ? products : products.filter((p) => p.category === category)),
    [products, category]
  );

  return (
    <PullToRefresh queryKeys={[["products"]]}>
      <div className="mx-auto w-full max-w-2xl pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <header className="flex items-end justify-between px-4 pb-2">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary">Official merch</p>
            <h1 className="font-display text-2xl font-bold uppercase tracking-widest">Store</h1>
          </div>
          <button
            type="button"
            onClick={() => {
              emitHaptic("sheet.snap");
              setCartOpen(true);
            }}
            className="ios-pressable flex min-h-11 items-center gap-2 border border-border px-3 text-[10px] font-black uppercase tracking-widest"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" /> Cart
          </button>
        </header>

        {categories.length > 2 && (
          <div className="ios-scroll flex gap-2 overflow-x-auto px-4 py-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={category === cat}
                onClick={() => setCategory(cat)}
                className={`ios-pressable min-h-9 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                  category === cat ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {isLoading && products.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 px-4 pt-2">
            <NativeSkeleton className="aspect-square w-full" />
            <NativeSkeleton className="aspect-square w-full" />
            <NativeSkeleton className="aspect-square w-full" />
            <NativeSkeleton className="aspect-square w-full" />
          </div>
        ) : visible.length === 0 ? (
          <div className="px-4 pt-6">
            <NativeEmptyState icon={ShoppingBag} title="Nothing here yet" description="Merch drops land here — keep an eye out." />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 px-4 pt-2">
              {visible.slice(0, 6).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <div className="px-4 py-3">
              <NativeSponsorCard />
            </div>
            <div className="grid grid-cols-2 gap-3 px-4">
              {visible.slice(6).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>

      <NativeCartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
    </PullToRefresh>
  );
}
