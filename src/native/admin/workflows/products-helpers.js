/**
 * Pure logic for the native Products workflow. Mirrors the web
 * ProductsManager's rules — the empty-product shape, the low-stock
 * threshold, stock badges, header counts, and the field-coercion the web
 * inputs perform (Number(...) for numerics, "" → null for dimensions) — so
 * the native screens write payload-parity records through the same entity.
 *
 * Note: the web ProductsManager dispatches NO rlt_admin_log events, so the
 * native workflow intentionally emits none either (audit parity is "same
 * events", and here the same set is the empty set).
 */

export const LOW_STOCK = 5;

/** Exact create-draft shape the web manager seeds (ProductsManager.emptyProduct). */
export const EMPTY_PRODUCT = {
  name: "",
  description: "",
  details: "",
  image_url: "",
  image_url_2: "",
  price_aud: 0,
  stock_quantity: 0,
  sizes: [],
  is_active: true,
  sort_order: 1,
  weight_grams: 300,
  length_cm: null,
  width_cm: null,
  height_cm: null,
};

/** Same three-way stock badge the web manager renders (out / low / in). */
export function stockStatus(qty) {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) {
    return { key: "out", label: "Out of stock", tone: "border-red-500/40 bg-red-500/10 text-red-300" };
  }
  if (n <= LOW_STOCK) {
    return { key: "low", label: `Low · ${n} left`, tone: "border-amber-500/40 bg-amber-500/10 text-amber-300" };
  }
  return { key: "in", label: `${n} in stock`, tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
}

/** Header counts, mirroring the web header math exactly. */
export function productCounts(products) {
  const list = products || [];
  return {
    total: list.length,
    active: list.filter((p) => p.is_active !== false).length,
    low: list.filter((p) => Number(p.stock_quantity) > 0 && Number(p.stock_quantity) <= LOW_STOCK).length,
    out: list.filter((p) => !(Number(p.stock_quantity) > 0)).length,
  };
}

/** Native-only client-side facets (read-only slicing; no write impact). */
export const PRODUCT_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "hidden", label: "Hidden" },
  { key: "low", label: "Low stock" },
  { key: "out", label: "Out" },
];

export function filterProducts(products, { query = "", filter = "all" } = {}) {
  const q = query.trim().toLowerCase();
  return (products || []).filter((product) => {
    if (filter === "active" && product.is_active === false) return false;
    if (filter === "hidden" && product.is_active !== false) return false;
    if (filter === "low" && stockStatus(product.stock_quantity).key !== "low") return false;
    if (filter === "out" && stockStatus(product.stock_quantity).key !== "out") return false;
    if (!q) return true;
    return [product.name, product.description, product.details]
      .map((v) => String(v || "").toLowerCase())
      .some((v) => v.includes(q));
  });
}

export function productFilterCounts(products) {
  return Object.fromEntries(PRODUCT_FILTERS.map((f) => [f.key, filterProducts(products, { filter: f.key }).length]));
}

/** Same numeric coercion the web inputs apply: Number(e.target.value). */
export function toNumberField(value) {
  return Number(value);
}

/** Dimension inputs: web writes null for a cleared field, Number otherwise. */
export function toDimensionField(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

/** Legacy string sizes are widened to { size, stock_quantity } (web parity). */
export function normalizeSizeVariant(v) {
  return typeof v === "string" ? { size: v, stock_quantity: 0 } : v || { size: "", stock_quantity: 0 };
}

/** Immutable size-row ops matching the web editor's array handling. */
export function addSizeVariant(sizes) {
  return [...(sizes || []), { size: "", stock_quantity: 0 }];
}

export function setSizeVariant(sizes, index, patch) {
  const next = [...(sizes || [])];
  next[index] = { ...normalizeSizeVariant(next[index]), ...patch };
  return next;
}

export function removeSizeVariant(sizes, index) {
  const next = [...(sizes || [])];
  next.splice(index, 1);
  return next;
}

/** Web parity: the create button is disabled until a name is entered. */
export function canCreateProduct(draft) {
  return !!draft?.name;
}
