import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, Trash2 } from "lucide-react";

const emptyProduct = { name: "", description: "", image_url: "", price_aud: 0, stock_quantity: 0, is_active: true, sort_order: 1 };

export default function ProductsManager({ products }) {
  const [draft, setDraft] = useState(emptyProduct);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["products"] });
  const createMutation = useMutation({ mutationFn: (data) => base44.entities.Product.create(data), onSuccess: () => { refresh(); setDraft(emptyProduct); } });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.Product.update(id, data), onSuccess: refresh });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.Product.delete(id), onSuccess: refresh });

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setDraft((current) => ({ ...current, image_url: file_url }));
    } finally {
      setUploading(false);
    }
  };

  return (
    <section id="products-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <h2 className="font-display text-4xl uppercase">Merch Products</h2>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <Input placeholder="Product name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="rounded-none" />
        <Input type="number" placeholder="Price AUD" value={draft.price_aud} onChange={(e) => setDraft({ ...draft, price_aud: Number(e.target.value) })} className="rounded-none" />
        <Input placeholder="Image URL" value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} className="rounded-none md:col-span-2" />
        <Input type="file" accept="image/*" disabled={uploading} onChange={(e) => uploadImage(e.target.files?.[0])} className="rounded-none md:col-span-2" />
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
            <div className="h-20 w-20 overflow-hidden bg-secondary">
              {product.image_url && <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Input defaultValue={product.name || ""} onBlur={(e) => updateMutation.mutate({ id: product.id, data: { name: e.target.value } })} className="rounded-none" />
              <Input type="number" defaultValue={product.price_aud || 0} onBlur={(e) => updateMutation.mutate({ id: product.id, data: { price_aud: Number(e.target.value) } })} className="rounded-none" />
              <Input type="number" defaultValue={product.stock_quantity || 0} onBlur={(e) => updateMutation.mutate({ id: product.id, data: { stock_quantity: Number(e.target.value) } })} className="rounded-none" />
              <Input type="number" defaultValue={product.sort_order || 1} onBlur={(e) => updateMutation.mutate({ id: product.id, data: { sort_order: Number(e.target.value) } })} className="rounded-none" />
              <Textarea defaultValue={product.description || ""} onBlur={(e) => updateMutation.mutate({ id: product.id, data: { description: e.target.value } })} className="min-h-20 rounded-none md:col-span-2" />
              <Input defaultValue={product.image_url || ""} onBlur={(e) => updateMutation.mutate({ id: product.id, data: { image_url: e.target.value } })} className="rounded-none md:col-span-2" />
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
