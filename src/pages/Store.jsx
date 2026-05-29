import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Store() {
  const [checkout, setCheckout] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => base44.entities.Product.list("sort_order", 50) });
  const visibleProducts = products.filter((product) => product.is_active !== false);

  const buyProduct = async (product) => {
    if (window.self !== window.top) {
      alert("Checkout works from the published app, not inside the preview window.");
      return;
    }
    setLoadingId(product.id);
    const details = checkout[product.id] || {};
    const response = await base44.functions.invoke("createCheckout", {
      productId: product.id,
      quantity: Number(details.quantity || 1),
      customerName: details.name || "",
      customerEmail: details.email || ""
    });
    window.location.href = response.data.url;
  };

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Official Merch</p>
            <h1 className="font-display text-5xl uppercase">Takeover Store</h1>
          </div>
          <Button asChild variant="outline" className="rounded-none"><Link to="/">Back</Link></Button>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleProducts.map((product) => (
            <article key={product.id} className="border border-border bg-card">
              <div className="aspect-square bg-secondary">
                {product.image_url && <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />}
              </div>
              <div className="grid gap-4 p-5">
                <h2 className="font-display text-3xl uppercase">{product.name}</h2>
                <p className="text-sm leading-6 text-muted-foreground">{product.description}</p>
                <p className="text-xl font-bold">${Number(product.price_aud || 0).toFixed(2)} AUD</p>
                <Input placeholder="Your name" className="rounded-none" onChange={(e) => setCheckout({ ...checkout, [product.id]: { ...(checkout[product.id] || {}), name: e.target.value } })} />
                <Input placeholder="Email for receipt" type="email" className="rounded-none" onChange={(e) => setCheckout({ ...checkout, [product.id]: { ...(checkout[product.id] || {}), email: e.target.value } })} />
                <Input placeholder="Quantity" type="number" min="1" defaultValue="1" className="rounded-none" onChange={(e) => setCheckout({ ...checkout, [product.id]: { ...(checkout[product.id] || {}), quantity: e.target.value } })} />
                <Button onClick={() => buyProduct(product)} disabled={loadingId === product.id || !(checkout[product.id]?.email)} className="rounded-none bg-primary hover:bg-primary/90">
                  <ShoppingBag className="mr-2 h-4 w-4" /> {loadingId === product.id ? "Opening checkout…" : "Buy Now"}
                </Button>
              </div>
            </article>
          ))}
        </div>
        {visibleProducts.length === 0 && <p className="mt-10 border border-border bg-card p-8 text-muted-foreground">Merch products are coming soon.</p>}
      </div>
    </main>
  );
}