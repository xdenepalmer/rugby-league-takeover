import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, Trash2, Plus, X, ShoppingBag, Package, DollarSign, Eye, EyeOff, Edit3, BarChart3, AlertTriangle } from "lucide-react";
import ImageField from "./ImageField";

const LOW_STOCK = 5;
const stockBadge = (qty) => {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return { label: "Out of stock", tone: "border-destructive/30 text-destructive bg-destructive/5" };
  if (n <= LOW_STOCK) return { label: `Low · ${n} left`, tone: "border-amber-500/30 text-amber-400 bg-amber-500/5" };
  return { label: `${n} in stock`, tone: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5" };
};

const emptyProduct = { name: "", description: "", image_url: "", price_aud: 0, stock_quantity: 0, is_active: true, sort_order: 1 };

/* ── Product Card ── */
function ProductCard({ product, onUpdate, onDelete, index }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(product);
  const stock = stockBadge(product.stock_quantity);

  const handleSave = () => {
    onUpdate(draft);
    setEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.3 }}
      className={`group relative overflow-hidden border hover:border-primary/20 transition-all duration-300 ${
        product.is_active !== false
          ? "border-border/60 bg-card/30"
          : "border-border/30 bg-card/10 opacity-60"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-primary/[0.02] via-white/[0.05] to-transparent" />
      {!editing ? (
        /* ── Preview Mode ── */
        <div className="flex flex-col gap-4 p-4 sm:flex-row">
          {/* Image */}
          <div className="h-20 w-20 shrink-0 bg-muted/10 border border-border/20 overflow-hidden flex items-center justify-center">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-6 w-6 text-muted-foreground/15" />
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {product.is_active !== false ? (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
              )}
              <h4 className="text-sm font-bold text-foreground truncate">{product.name || "Untitled Product"}</h4>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold font-mono text-primary border border-primary/20 bg-primary/5">
                <DollarSign className="h-2.5 w-2.5" /> {Number(product.price_aud || 0).toFixed(2)} AUD
              </span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold border ${stock.tone}`}>
                {stock.label}
              </span>
              <span className="text-[8px] font-mono text-muted-foreground/20">#{product.sort_order || 0}</span>
            </div>

            {product.description && (
              <p className="text-[10px] text-muted-foreground/60 line-clamp-1">{product.description}</p>
            )}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-col">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="touch-target flex items-center justify-center border border-border/30 text-muted-foreground/50 transition-colors hover:border-border hover:text-foreground"
              aria-label="Edit product"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(product.id)}
              className="touch-target flex items-center justify-center border border-border/30 text-muted-foreground/50 transition-colors hover:border-destructive/30 hover:text-destructive"
              aria-label="Delete product"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        /* ── Edit Mode ── */
        <div className="p-4 md:p-5 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/60 flex items-center gap-1.5">
              <Edit3 className="h-3 w-3" /> Editing Product
            </p>
            <button type="button" onClick={() => { setDraft(product); setEditing(false); }} className="touch-target flex items-center justify-center text-muted-foreground/50 hover:text-foreground" aria-label="Cancel editing">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Product Name</label>
              <Input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-11 rounded-none border-border/40 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Price (AUD)</label>
              <Input type="number" value={draft.price_aud || 0} onChange={(e) => setDraft({ ...draft, price_aud: Number(e.target.value) })} className="h-11 rounded-none border-border/40 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Stock Quantity</label>
              <Input type="number" value={draft.stock_quantity || 0} onChange={(e) => setDraft({ ...draft, stock_quantity: Number(e.target.value) })} className="h-11 rounded-none border-border/40 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Sort Order</label>
              <Input type="number" value={draft.sort_order || 1} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="h-11 rounded-none border-border/40 text-sm" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Description</label>
            <Textarea value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="min-h-16 rounded-none text-sm border-border/40 resize-none" />
          </div>

          <ImageField label="Product image" value={draft.image_url} onChange={(url) => setDraft({ ...draft, image_url: url })} />

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <label className="touch-target inline-flex items-center gap-2 border border-border/30 bg-muted/5 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {draft.is_active !== false ? <Eye className="h-3 w-3 text-emerald-400" /> : <EyeOff className="h-3 w-3 text-muted-foreground/30" />}
              Active
              <Switch checked={draft.is_active !== false} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
            </label>
            <div className="flex-1" />
            <Button onClick={handleSave} size="mobile" className="rounded-none bg-primary text-[9px] font-bold uppercase tracking-wider hover:bg-primary/90">
              <Save className="mr-1.5 h-3 w-3" /> Save
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ── Main Component ── */
export default function ProductsManager({ products }) {
  const [draft, setDraft] = useState(emptyProduct);
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["products"] });
  const createMutation = useMutation({ mutationFn: (data) => base44.entities.Product.create(data), onSuccess: () => { refresh(); setDraft(emptyProduct); setShowCreate(false); } });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.Product.update(id, data), onSuccess: refresh });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.Product.delete(id), onSuccess: refresh });

  const activeCount = products.filter((p) => p.is_active !== false).length;
  const lowStockCount = products.filter((p) => Number(p.stock_quantity) > 0 && Number(p.stock_quantity) <= LOW_STOCK).length;
  const outOfStockCount = products.filter((p) => !(Number(p.stock_quantity) > 0)).length;

  return (
    <div className="border border-border/60 bg-card/30 cmd-glass overflow-hidden">
      <div className="h-[2px] w-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" />

      <div className="p-5 md:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20">
              <ShoppingBag className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-display text-2xl uppercase tracking-wide">Merch Products</h2>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[9px] font-mono text-muted-foreground/40">{products.length} products</span>
                <span className="text-[9px] font-mono text-emerald-400/60">{activeCount} active</span>
                {lowStockCount > 0 && <span className="text-[9px] font-mono text-amber-400">{lowStockCount} low</span>}
                {outOfStockCount > 0 && <span className="text-[9px] font-mono text-destructive/70">{outOfStockCount} out</span>}
              </div>
            </div>
          </div>

          <Button
            onClick={() => setShowCreate(!showCreate)}
            size="mobile"
            className={`rounded-none text-[9px] font-bold uppercase tracking-wider ${showCreate ? "bg-muted text-foreground hover:bg-muted/80" : "bg-primary hover:bg-primary/90"}`}
          >
            {showCreate ? <><X className="mr-1 h-3 w-3" /> Cancel</> : <><Plus className="mr-1 h-3 w-3" /> Add Product</>}
          </Button>
        </div>

        {/* Inventory Summary */}
        {(lowStockCount > 0 || outOfStockCount > 0) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {outOfStockCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 border border-destructive/20 bg-destructive/5 text-[9px] font-bold uppercase tracking-wider text-destructive">
                <AlertTriangle className="h-3 w-3" /> {outOfStockCount} out of stock
              </div>
            )}
            {lowStockCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 border border-amber-500/20 bg-amber-500/5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
                <BarChart3 className="h-3 w-3" /> {lowStockCount} low stock
              </div>
            )}
          </div>
        )}

        {/* Create form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden mb-5"
            >
              <div className="border border-primary/20 bg-primary/[0.02] p-4 md:p-5 space-y-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/60 flex items-center gap-1.5">
                  <Plus className="h-3 w-3" /> Add New Product
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Product Name</label>
                    <Input placeholder="e.g. Takeover Tee" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-11 rounded-none border-border/40 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Price (AUD)</label>
                    <Input type="number" value={draft.price_aud} onChange={(e) => setDraft({ ...draft, price_aud: Number(e.target.value) })} className="h-11 rounded-none border-border/40 text-sm" />
                  </div>
                </div>
                <ImageField label="Product image" value={draft.image_url} onChange={(url) => setDraft({ ...draft, image_url: url })} />
                <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Description</label>
                  <Textarea placeholder="Describe the product…" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="min-h-16 rounded-none text-sm border-border/40 resize-none" />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Stock Quantity</label>
                    <Input type="number" value={draft.stock_quantity} onChange={(e) => setDraft({ ...draft, stock_quantity: Number(e.target.value) })} className="h-11 rounded-none border-border/40 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Sort Order</label>
                    <Input type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="h-11 rounded-none border-border/40 text-sm" />
                  </div>
                </div>
                <Button onClick={() => createMutation.mutate(draft)} disabled={!draft.name || createMutation.isPending} size="mobile" className="rounded-none bg-primary text-[9px] font-bold uppercase tracking-wider hover:bg-primary/90">
                  <Plus className="mr-1.5 h-3 w-3" /> {createMutation.isPending ? "Adding…" : "Add Product"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Product Grid */}
        <div className="space-y-2">
          {products.length === 0 && (
            <div className="border border-border/30 bg-muted/5 p-10 text-center">
              <Package className="h-6 w-6 mx-auto text-muted-foreground/15 mb-2" />
              <p className="text-sm text-muted-foreground/30">No products yet. Add your first one above.</p>
            </div>
          )}
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              onUpdate={(data) => updateMutation.mutate({ id: product.id, data })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
