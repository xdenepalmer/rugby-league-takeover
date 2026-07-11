import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Package, Plus, X, Upload, Trash2, Eye, EyeOff } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import AdminConfirmSheet from "@/components/admin/shared/AdminConfirmSheet";
import MobileActionDrawer from "@/components/admin/MobileActionDrawer";
import PullToRefresh from "@/components/PullToRefresh";
import { emitHaptic } from "@/lib/native/haptic-events";
import { formatAud } from "@/lib/store-products";
import { useWindowedList } from "@/hooks/use-windowed-list";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  EMPTY_PRODUCT,
  PRODUCT_FILTERS,
  stockStatus,
  productCounts,
  filterProducts,
  productFilterCounts,
  toNumberField,
  toDimensionField,
  normalizeSizeVariant,
  addSizeVariant,
  setSizeVariant,
  removeSizeVariant,
  canCreateProduct,
} from "./products-helpers.js";

/**
 * Native merch products workflow — list at /admin/store/products, editor at
 * /admin/store/products/:productId. Every write sends the exact payloads the
 * web ProductsManager sends (Product.create / Product.update with the full
 * draft record / Product.delete) and invalidates the same ["products"] query
 * key, so the cache stays shared with the web panels. The web manager
 * dispatches no rlt_admin_log events for products, so neither does this.
 */

const useProducts = () =>
  useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("sort_order", 200),
    enabled: appParams.hasBase44Config,
    staleTime: 60000,
  });

const useProductMutations = () => {
  const queryClient = useQueryClient();
  // Web parity: ProductsManager invalidates ["products"] only.
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["products"] });
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => {
      emitHaptic("save.success");
      refresh();
      toast({ title: "Product added" });
    },
    onError: () => {
      emitHaptic("mutation.error");
      toast({ title: "Failed to create product", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      emitHaptic("save.success");
      refresh();
      toast({ title: "Product saved" });
    },
    onError: () => {
      emitHaptic("mutation.error");
      toast({ title: "Failed to save product", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => {
      emitHaptic("save.success");
      refresh();
      toast({ title: "Product removed" });
    },
    onError: () => {
      emitHaptic("mutation.error");
      toast({ title: "Failed to delete product", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });
  return { createMutation, updateMutation, deleteMutation };
};

/**
 * Touch-first image control: URL paste, native file picker, always-visible
 * clear button (no hover-only affordances). Uploads through the EXACT client
 * call the web ImageField uses: base44.integrations.Core.UploadFile.
 */
function NativeImageField({ label, value, onChange, idPrefix }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
      emitHaptic("save.success");
    } catch (error) {
      emitHaptic("mutation.error");
      toast({ title: "Image upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-2">
      <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-url`}>
        {label}
      </label>
      <div className="flex items-start gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-border bg-card/50">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <Package className="h-6 w-6 text-muted-foreground/40" aria-hidden="true" />
          )}
        </div>
        <div className="grid min-w-0 flex-1 gap-2">
          <Input
            id={`${idPrefix}-url`}
            placeholder="Paste image URL"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 rounded-none border-border bg-background"
          />
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => upload(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="ios-pressable flex min-h-11 flex-1 items-center justify-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" /> {uploading ? "Uploading…" : "Upload"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                aria-label={`Remove ${label.toLowerCase()}`}
                className="ios-pressable flex min-h-11 min-w-11 items-center justify-center border border-red-500/40 text-red-400"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Shared editor fields — the same field set (and coercion) the web forms write. */
function ProductFormFields({ draft, setField, idPrefix }) {
  const sizes = draft.sizes || [];
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-name`}>
          Product name
        </label>
        <Input
          id={`${idPrefix}-name`}
          placeholder="e.g. Takeover Tee"
          value={draft.name || ""}
          onChange={(e) => setField("name", e.target.value)}
          className="h-11 rounded-none border-border bg-background"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-price`}>
            Price (AUD)
          </label>
          <Input
            id={`${idPrefix}-price`}
            type="number"
            inputMode="decimal"
            value={draft.price_aud ?? 0}
            onChange={(e) => setField("price_aud", toNumberField(e.target.value))}
            className="h-11 rounded-none border-border bg-background font-mono"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-stock`}>
            Stock quantity
          </label>
          <Input
            id={`${idPrefix}-stock`}
            type="number"
            inputMode="numeric"
            value={draft.stock_quantity ?? 0}
            onChange={(e) => setField("stock_quantity", toNumberField(e.target.value))}
            className="h-11 rounded-none border-border bg-background font-mono"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-sort`}>
          Sort order
        </label>
        <Input
          id={`${idPrefix}-sort`}
          type="number"
          inputMode="numeric"
          value={draft.sort_order ?? 1}
          onChange={(e) => setField("sort_order", toNumberField(e.target.value))}
          className="h-11 rounded-none border-border bg-background font-mono"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-description`}>
          Description
        </label>
        <Textarea
          id={`${idPrefix}-description`}
          placeholder="Describe the product…"
          value={draft.description || ""}
          onChange={(e) => setField("description", e.target.value)}
          className="min-h-20 resize-none rounded-none border-border bg-background text-sm"
        />
        <p className="text-[10px] text-muted-foreground">Line breaks and blank lines are preserved on the store page.</p>
      </div>

      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-details`}>
          Extra details (optional)
        </label>
        <Textarea
          id={`${idPrefix}-details`}
          placeholder="What's included, care instructions, sizing notes…"
          value={draft.details || ""}
          onChange={(e) => setField("details", e.target.value)}
          className="min-h-20 resize-none rounded-none border-border bg-background text-sm"
        />
      </div>

      <NativeImageField label="Product image" idPrefix={`${idPrefix}-img1`} value={draft.image_url} onChange={(url) => setField("image_url", url)} />
      <NativeImageField label="Second photo (optional)" idPrefix={`${idPrefix}-img2`} value={draft.image_url_2} onChange={(url) => setField("image_url_2", url)} />

      <div className="grid gap-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Shipping — weight &amp; dimensions (AusPost)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" inputMode="numeric" placeholder="Weight (g)" aria-label="Weight in grams" value={draft.weight_grams ?? 300} onChange={(e) => setField("weight_grams", toNumberField(e.target.value))} className="h-11 rounded-none border-border bg-background font-mono" />
          <Input type="number" inputMode="decimal" placeholder="Length (cm)" aria-label="Length in centimetres" value={draft.length_cm ?? ""} onChange={(e) => setField("length_cm", toDimensionField(e.target.value))} className="h-11 rounded-none border-border bg-background font-mono" />
          <Input type="number" inputMode="decimal" placeholder="Width (cm)" aria-label="Width in centimetres" value={draft.width_cm ?? ""} onChange={(e) => setField("width_cm", toDimensionField(e.target.value))} className="h-11 rounded-none border-border bg-background font-mono" />
          <Input type="number" inputMode="decimal" placeholder="Height (cm)" aria-label="Height in centimetres" value={draft.height_cm ?? ""} onChange={(e) => setField("height_cm", toDimensionField(e.target.value))} className="h-11 rounded-none border-border bg-background font-mono" />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Used to calculate live AusPost shipping rates. Leave dimensions blank to use a default small satchel.
        </p>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Size variants (per-size stock)</p>
          <button
            type="button"
            onClick={() => setField("sizes", addSizeVariant(sizes))}
            className="ios-pressable flex min-h-11 items-center gap-1 px-2 text-[10px] font-bold uppercase tracking-widest text-primary"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add size
          </button>
        </div>
        {sizes.map((v, i) => {
          const sizeObj = normalizeSizeVariant(v);
          return (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="e.g. S"
                aria-label={`Size ${i + 1} label`}
                value={sizeObj.size || ""}
                onChange={(e) => setField("sizes", setSizeVariant(sizes, i, { size: e.target.value }))}
                className="h-11 w-24 shrink-0 rounded-none border-border bg-background"
              />
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Stock"
                aria-label={`Size ${i + 1} stock`}
                value={sizeObj.stock_quantity ?? 0}
                onChange={(e) => setField("sizes", setSizeVariant(sizes, i, { stock_quantity: toNumberField(e.target.value) }))}
                className="h-11 w-24 shrink-0 rounded-none border-border bg-background font-mono"
              />
              <button
                type="button"
                onClick={() => setField("sizes", removeSizeVariant(sizes, i))}
                aria-label={`Remove size ${i + 1}`}
                className="ios-pressable flex min-h-11 min-w-11 items-center justify-center border border-border text-muted-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
        {sizes.length === 0 && (
          <p className="text-[10px] italic text-muted-foreground">No size variants — leave empty if sizing doesn't apply.</p>
        )}
      </div>

      <label className="flex min-h-11 items-center justify-between border border-border bg-card/50 px-3 py-2">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {draft.is_active !== false ? (
            <Eye className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          ) : (
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" />
          )}
          Active in store
        </span>
        <Switch checked={draft.is_active !== false} onCheckedChange={(v) => setField("is_active", v)} />
      </label>
    </div>
  );
}

/** Native searchable, filterable product list — /admin/store/products */
export default function NativeProductsList() {
  const navigate = useNavigate();
  const { data: products = [], isLoading } = useProducts();
  const { createMutation } = useProductMutations();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [createDraft, setCreateDraft] = useState(null); // null = drawer closed

  const counts = useMemo(() => productCounts(products), [products]);
  const filterCounts = useMemo(() => productFilterCounts(products), [products]);
  const visible = useMemo(() => filterProducts(products, { query, filter }), [products, query, filter]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, { initial: 15, step: 15, restoreKey: "admin-products" });

  const setCreateField = (field, value) => setCreateDraft((draft) => ({ ...draft, [field]: value }));

  const submitCreate = async () => {
    if (!canCreateProduct(createDraft) || createMutation.isPending) return;
    emitHaptic("action.primary");
    try {
      // Web parity: create sends the emptyProduct-shaped draft as-is.
      await createMutation.mutateAsync(createDraft);
      setCreateDraft(null);
    } catch {
      // onError already toasted; keep the drawer open so nothing is lost.
    }
  };

  return (
    <div className="pb-8">
      <NativeTopBar
        title="Products"
        fallback="/admin/store"
        right={
          <button
            type="button"
            onClick={() => {
              emitHaptic("action.primary");
              setCreateDraft({ ...EMPTY_PRODUCT });
            }}
            aria-label="Add product"
            className="ios-pressable flex h-11 min-w-11 items-center justify-center text-primary"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        }
      />
      <PullToRefresh queryKeys={[["products"]]}>
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 border border-border bg-card/50 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, description"
              aria-label="Search products"
              className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="ios-scroll flex gap-2 overflow-x-auto py-2">
            {PRODUCT_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`ios-pressable min-h-9 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                  filter === f.key ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
                }`}
              >
                {f.label} ({filterCounts[f.key] ?? 0})
              </button>
            ))}
          </div>
          {(counts.low > 0 || counts.out > 0) && (
            <p className="pb-2 text-[10px] font-bold uppercase tracking-widest text-amber-300">
              {counts.out > 0 ? `${counts.out} out of stock` : ""}
              {counts.out > 0 && counts.low > 0 ? " · " : ""}
              {counts.low > 0 ? `${counts.low} low stock` : ""}
            </p>
          )}
        </div>

        {isLoading && products.length === 0 ? (
          <div className="space-y-2 px-4">
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState
              icon={Package}
              title="No products here"
              description={products.length === 0 ? "Add your first product with the + button." : "Nothing matches this filter right now."}
            />
          </div>
        ) : (
          <div>
            {windowed.map((product) => {
              const stock = stockStatus(product.stock_quantity);
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    emitHaptic("tab.select");
                    navigate(`/admin/store/products/${encodeURIComponent(product.id)}`);
                  }}
                  className={`ios-pressable flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left ${
                    product.is_active === false ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-border bg-card/50">
                    {product.image_url ? (
                      <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-muted-foreground/40" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold">{product.name || "Untitled Product"}</p>
                      {product.is_active === false && (
                        <span className="shrink-0 border border-border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          Hidden
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className={`border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${stock.tone}`}>{stock.label}</span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">#{product.sort_order || 0}</span>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-black text-primary">{formatAud(product.price_aud)}</span>
                </button>
              );
            })}
            {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
          </div>
        )}
      </PullToRefresh>

      <MobileActionDrawer
        open={!!createDraft}
        onOpenChange={(open) => {
          if (!open) setCreateDraft(null);
        }}
        title="Add product"
        description="New merch goes live in the store as soon as it's active."
      >
        {createDraft && (
          <>
            <ProductFormFields draft={createDraft} setField={setCreateField} idPrefix="native-product-create" />
            <div className="grid grid-cols-2 gap-2 pt-4">
              <button
                type="button"
                disabled={createMutation.isPending}
                onClick={() => setCreateDraft(null)}
                className="ios-pressable flex min-h-11 items-center justify-center border border-border text-xs font-bold uppercase tracking-widest disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canCreateProduct(createDraft) || createMutation.isPending}
                onClick={submitCreate}
                className="ios-pressable flex min-h-11 items-center justify-center bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
              >
                {createMutation.isPending ? "Adding…" : "Add product"}
              </button>
            </div>
          </>
        )}
      </MobileActionDrawer>
    </div>
  );
}

/** Native product editor — /admin/store/products/:productId */
export function NativeProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { data: products = [], isLoading } = useProducts();
  const product = useMemo(() => products.find((p) => String(p.id) === String(productId)) || null, [products, productId]);
  const { updateMutation, deleteMutation } = useProductMutations();

  const [edits, setEdits] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Web parity: the edit form is seeded from the full record and Save sends
  // the whole edited record back through Product.update (not a sparse patch).
  const draft = { ...(product || {}), ...edits };
  const setField = (field, value) => setEdits((prev) => ({ ...prev, [field]: value }));

  const save = () => {
    emitHaptic("action.primary");
    updateMutation.mutate({ id: product.id, data: draft });
  };

  const confirmDeleteProduct = async () => {
    try {
      await deleteMutation.mutateAsync(product.id);
      setConfirmDelete(false);
      navigate("/admin/store/products", { replace: true });
    } catch {
      // onError already toasted; the sheet stays open for retry.
    }
  };

  if (!isLoading && !product) {
    return (
      <div>
        <NativeTopBar title="Product" fallback="/admin/store/products" />
        <div className="px-4 pt-6">
          <NativeEmptyState icon={Package} title="Product not found" description="It may have been removed, or you're offline." />
        </div>
      </div>
    );
  }
  if (!product) {
    return (
      <div>
        <NativeTopBar title="Product" fallback="/admin/store/products" />
        <div className="space-y-2 px-4 pt-4">
          <NativeSkeleton className="h-24 w-full" />
          <NativeSkeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const stock = stockStatus(draft.stock_quantity);

  return (
    <div className="pb-10">
      <NativeTopBar title={product.name || "Product"} fallback="/admin/store/products" />
      <div className="space-y-4 px-4 pt-3">
        <div className="flex items-center justify-between border border-border/60 bg-card/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${stock.tone}`}>{stock.label}</span>
            {draft.is_active === false && (
              <span className="border border-border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Hidden</span>
            )}
          </div>
          <p className="text-lg font-black text-primary">{formatAud(draft.price_aud)}</p>
        </div>

        <div className="border border-border/60 bg-card/50 p-3">
          <ProductFormFields draft={draft} setField={setField} idPrefix="native-product-edit" />
        </div>

        <button
          type="button"
          disabled={updateMutation.isPending}
          onClick={save}
          className="ios-pressable flex min-h-12 w-full items-center justify-center bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
        >
          {updateMutation.isPending ? "Saving…" : "Save product"}
        </button>

        <button
          type="button"
          onClick={() => {
            emitHaptic("mutation.warning");
            setConfirmDelete(true);
          }}
          className="ios-pressable flex min-h-11 w-full items-center justify-center gap-1.5 border border-red-500/40 text-xs font-bold uppercase tracking-widest text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete product
        </button>
      </div>

      <AdminConfirmSheet
        open={confirmDelete}
        variant="destructive"
        title="Delete this product?"
        description="This permanently removes the product from the store. This can't be undone."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={confirmDeleteProduct}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
