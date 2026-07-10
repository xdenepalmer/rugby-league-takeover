/**
 * The cart contract, extracted so native screens and the web store share
 * one implementation: line items live in localStorage["rlt_cart"] with the
 * shape { cartItemId, id, name, price_aud, image_url, stock_quantity,
 * quantity, size }, and every write dispatches the rlt_cart_changed
 * CustomEvent the tab bars listen for. Pure list operations + a thin
 * storage adapter; stock limits mirror maxQuantityFor.
 */
import { maxQuantityFor } from "./store-products.js";

export const CART_STORAGE_KEY = "rlt_cart";
export const CART_CHANGED_EVENT = "rlt_cart_changed";

export function cartItemIdFor(productId, size) {
  return `${productId}${size ? `-${size}` : ""}`;
}

export function cartQuantity(cart) {
  return (cart || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
}

export function cartSubtotalAud(cart) {
  return (cart || []).reduce((sum, item) => sum + (Number(item.price_aud) || 0) * (item.quantity || 0), 0);
}

/**
 * Pure add: returns { cart, outcome } where outcome is "added",
 * "limit" (already at stock/line cap) or "unavailable".
 */
export function addItemToCart(cart, product, size) {
  const max = maxQuantityFor(product, size);
  if (max <= 0) return { cart: cart || [], outcome: "unavailable" };
  const cartItemId = cartItemIdFor(product.id, size);
  const list = cart || [];
  const existing = list.find((item) => item.cartItemId === cartItemId);
  if (existing) {
    if (existing.quantity >= max) return { cart: list, outcome: "limit" };
    return {
      cart: list.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item
      ),
      outcome: "added",
    };
  }
  return {
    cart: [
      ...list,
      {
        cartItemId,
        id: product.id,
        name: product.name,
        price_aud: product.price_aud,
        image_url: product.image_url,
        stock_quantity: product.stock_quantity,
        quantity: 1,
        ...(size ? { size } : {}),
      },
    ],
    outcome: "added",
  };
}

/** Pure quantity set (clamped ≥1; use removeCartItem to drop a line). */
export function setCartItemQuantity(cart, cartItemId, quantity, max = Infinity) {
  const clamped = Math.max(1, Math.min(Number(quantity) || 1, max));
  return (cart || []).map((item) =>
    item.cartItemId === cartItemId ? { ...item, quantity: clamped } : item
  );
}

export function removeCartItem(cart, cartItemId) {
  return (cart || []).filter((item) => item.cartItemId !== cartItemId);
}

// ── Storage adapter ──────────────────────────────────────────────────────
export function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCart(cart) {
  const list = Array.isArray(cart) ? cart : [];
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Best-effort; the in-memory state still drives the UI.
  }
  try {
    window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT, { detail: { count: cartQuantity(list) } }));
  } catch {
    // Non-browser context.
  }
  return list;
}
