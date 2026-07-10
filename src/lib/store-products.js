/**
 * Product-level helpers shared by the web store page and the native store
 * screens. normalizeSizeVariants/maxQuantityFor mirror the checkout rules:
 * per-size stock takes priority over total stock, hard-capped at 20 per
 * line, and coming-soon products can't be carted.
 */
export const LINE_QUANTITY_CAP = 20;
export const FREE_SHIPPING_THRESHOLD_AUD = 150;

export function normalizeSizeVariants(raw) {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
  return raw
    .map((v) => (typeof v === "string" ? { size: v, stock_quantity: 0 } : v))
    .filter((v) => v && v.size && String(v.size).trim() !== "");
}

export function maxQuantityFor(product, size) {
  if (!product || product.coming_soon === true) return 0;
  let max = LINE_QUANTITY_CAP;
  if (size) {
    const variant = normalizeSizeVariants(product.sizes).find((v) => v.size === size);
    if (variant) {
      const vs = Number(variant.stock_quantity);
      if (Number.isFinite(vs)) max = Math.min(vs, LINE_QUANTITY_CAP);
    }
  }
  if (max === LINE_QUANTITY_CAP) {
    const total = Number(product.stock_quantity);
    if (Number.isFinite(total)) max = Math.min(total, LINE_QUANTITY_CAP);
  }
  return Math.max(0, max);
}

export function productPath(product) {
  return product?.id ? `/store/product/${encodeURIComponent(product.id)}` : "/store";
}

export function galleryItemPath(item) {
  return item?.id ? `/gallery?item=${encodeURIComponent(item.id)}` : "/gallery";
}

export function formatAud(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}
