import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Trash2 } from "lucide-react";
import ImageField from "./ImageField";

const LOW_STOCK = 5;
const stockBadge = (qty) => {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return { label: "Out of stock", tone: "border-destructive/40 text-destructive" };
  if (n <= LOW_STOCK) return { label: `Low · ${n} left`, tone: "border-amber-500/40 text-amber-400" };
  return { label: `${n} in stock`, tone: "border-emerald-500/40 text-emerald-400" };
};

const emptyProduct = { name: "", description: "", image_url: "", price_aud: 0, stock_quantity: 0, is_active: true, sort_order: 1 };

export default function ProductsManager({ products }) {
  const [draft, setDraft] = useState(emptyProduct);
  const queryClient = useQueryClient();

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["products"] });
  const createMutation = useMutation({ mutationFn: (data) => base44.entities.Product.create(data), onSuccess: () => { refresh(); setDraft(emptyProduct); } });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.Product.update(id, data), onSuccess: refresh });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.Product.delete(id), onSuccess: refresh });

  return (
    <section id="products-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <h2 className="font-display text-4xl uppercase">Merch Products</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {products.length} products · {products.filter((p) => p.is_active !== false).length} active ·{" "}
        <span className="text-amber-400">{products.filter((p) => Number(p.stock_quantity) > 0 && Number(p.stock_quantity) <= LOW_STOCK).length} low</span> ·{" "}
        <span className="text-destructive">{products.filter((p) => !(Number(p.stock_quantity) > 0)).length} out of stock</span>
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <Input placeholder="Product name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="rounded-none" />
        <Input type="number" placeholder="Price AUD" value={draft.price_aud} onChange={(e) => setDraft({ ...draft, price_aud: Number(e.target.value) })} className="rounded-none" />
        <ImageField label="Product image" value={draft.image_url} onChange={(url) => setDraft({ ...draft, image_url: url })} className="md:col-span-2" />
        <Textarea placeholder="Product description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="min-h-24 rounded-none md:col-span-2" />
        <Input type="number" placeholder="Stock quantity" value={draft.stock_quantity} onChange={(e) => setDraft({ ...draft, stock_quantity: Number(e.target.value) })} className="rounded-none" />
        <Input type="number" placeholder="Sort order" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="rounded-none" />
        <Button onClick={() => createMutation.mutate(draft)} disabled={!draft.name || createMutation.isPending} className="rounded-none bg-primary hover:bg-primary/90 md:col-span-2">
          <Save className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      <div className="mt-8 grid gap-4">
        {products.map((product) => (
          <div key={product.id} className="grid gap-4 border border-border p-4 md:grid-cols-[80px_1fr_auto] md:items-center">
            <div className="grid gap-2">
              <div className="h-20 w-20 overflow-hidden bg-secondary">
                {product.image_url && <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />}
              </div>
              <Badge variant="outline" className={`w-fit rounded-none text-[10px] uppercase ${stockBadge(product.stock_quantity).tone}`}>{stockBadge(product.stock_quantity).label}</Badge>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Input defaultValue={product.name || ""} onBlur={(e) => updateMutation.mutate({ id: product.id, data: { name: e.target.value } })} className="rounded-none" />
              <Input type="number" defaultValue={product.price_aud || 0} onBlur={(e) => updateMutation.mutate({ id: product.id, data: { price_aud: Number(e.target.value) } })} className="rounded-none" />
              <Input type="number" defaultValue={product.stock_quantity || 0} onBlur={(e) => updateMutation.mutate({ id: product.id, data: { stock_quantity: Number(e.target.value) } })} className="rounded-none" />
              <Input type="number" defaultValue={product.sort_order || 1} onBlur={(e) => updateMutation.mutate({ id: product.id, data: { sort_order: Number(e.target.value) } })} className="rounded-none" />
              <Textarea defaultValue={product.description || ""} onBlur={(e) => updateMutation.mutate({ id: product.id, data: { description: e.target.value } })} className="min-h-20 rounded-none md:col-span-2" />
              <ImageField label="Product image" value={product.image_url} onChange={(url) => updateMutation.mutate({ id: product.id, data: { image_url: url } })} className="md:col-span-2" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={product.is_active !== false} onCheckedChange={(value) => updateMutation.mutate({ id: product.id, data: { is_active: value } })} />
              <Button variant="destructive" size="icon" className="rounded-none" onClick={() => deleteMutation.mutate(product.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
