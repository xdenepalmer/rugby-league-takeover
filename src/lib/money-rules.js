// Canonical order-total rules: GST, card processing fee, free shipping, and the
// signed shipping quote. Mirrored into supabase/functions/createCheckout/index.ts
// — keep the two in sync (this module is the source of truth).
//
// Everything works in integer cents. Doing tax in floats and rounding at the end
// lets drift reach a customer's card, and a total that disagrees with the
// displayed lines by a cent becomes a support ticket.
//
// Order of operations:
//   goods → + shipping (after any free-shipping waiver) → GST → card fee
// The card fee is calculated last, on the GST-inclusive amount, and is not
// itself treated as a taxable supply. Confirm that treatment with an accountant
// before relying on it for BAS.

export const DEFAULT_GST_RATE_PERCENT = 6.5;
export const DEFAULT_FREE_SHIPPING_THRESHOLD_AUD = 150;
export const DEFAULT_CARD_FEE_PERCENT = 1.75;   // Stripe AU domestic card
export const DEFAULT_CARD_FEE_FIXED_AUD = 0.3;
// Flat-rate shipping (used when shipping_mode === "fixed"): one price for a
// single-item order, a higher price once there are two or more items.
export const DEFAULT_FLAT_SHIPPING_SINGLE_AUD = 12.5;
export const DEFAULT_FLAT_SHIPPING_MULTI_AUD = 15.9;

export const toCents = (aud) => Math.round(Number(aud || 0) * 100);
export const fromCents = (cents) => Number((cents / 100).toFixed(2));

const clampPercent = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : fallback;
};

// ── Settings readers ────────────────────────────────────────────────────
// Each falls back to a documented default rather than 0, so a missing column or
// a malformed row can never silently stop collecting.

export function gstSettings(settings) {
  return {
    enabled: settings?.gst_enabled !== false,
    ratePercent: clampPercent(settings?.gst_rate_percent, DEFAULT_GST_RATE_PERCENT),
    mode: settings?.gst_mode === "absorbed" ? "absorbed" : "added",
    label: String(settings?.gst_label || "GST").trim() || "GST",
  };
}

export function cardFeeSettings(settings) {
  const fixed = Number(settings?.card_fee_fixed_aud);
  return {
    // Off by default: passing card costs to customers is a deliberate choice.
    enabled: settings?.card_fee_enabled === true,
    percent: clampPercent(settings?.card_fee_percent, DEFAULT_CARD_FEE_PERCENT),
    fixedCents: Number.isFinite(fixed) && fixed >= 0 ? toCents(fixed) : toCents(DEFAULT_CARD_FEE_FIXED_AUD),
    mode: settings?.card_fee_mode === "added" ? "added" : "absorbed",
    label: String(settings?.card_fee_label || "Card processing fee").trim() || "Card processing fee",
  };
}

export function freeShippingThresholdAud(settings) {
  const threshold = Number(settings?.free_shipping_threshold_aud);
  return Number.isFinite(threshold) && threshold >= 0 ? threshold : DEFAULT_FREE_SHIPPING_THRESHOLD_AUD;
}

// A flat rate that is missing or malformed falls back to its documented default
// rather than 0 — a $0 postage bug is worse than a slightly wrong price the
// admin can see and correct. Capped at $1000 so a fat-fingered value can't
// produce a nonsensical charge.
const clampFlatRateCents = (value, fallbackAud) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? toCents(n) : toCents(fallbackAud);
};

export function shippingModeSettings(settings) {
  return {
    mode: settings?.shipping_mode === "fixed" ? "fixed" : "calculated",
    flatSingleCents: clampFlatRateCents(settings?.shipping_flat_single_aud, DEFAULT_FLAT_SHIPPING_SINGLE_AUD),
    flatMultiCents: clampFlatRateCents(settings?.shipping_flat_multi_aud, DEFAULT_FLAT_SHIPPING_MULTI_AUD),
  };
}

/**
 * Flat postage for a cart in fixed shipping mode, in cents, BEFORE the
 * free-shipping waiver (orderTotals applies that so storefront and server can't
 * disagree). Deterministic — no AusPost quote involved.
 *
 * Rules (see the WhatsApp brief): one shippable item → single rate; two or more
 * → multi rate. A product may carry its own `flat_shipping_aud` override (e.g.
 * the Membership Package at $15.90); the charge is never below the highest
 * override present, and an override-only item still counts toward the item
 * total so it can't sneak the single rate.
 *
 * `items`: [{ quantity, shipping_required, flat_shipping_aud }]
 */
export function computeFlatShippingCents(items, settings) {
  const { flatSingleCents, flatMultiCents } = shippingModeSettings(settings);
  let shippableUnits = 0;
  let overrideMaxCents = 0;
  for (const item of items || []) {
    const qty = Math.max(0, Math.floor(Number(item?.quantity) || 0));
    if (qty <= 0) continue;
    const overrideAud = Number(item?.flat_shipping_aud);
    const hasOverride = Number.isFinite(overrideAud) && overrideAud > 0;
    // An item ships if it's physical, or if it carries a flat override (a
    // digital membership that still posts a card, say).
    const ships = item?.shipping_required !== false || hasOverride;
    if (!ships) continue;
    shippableUnits += qty;
    if (hasOverride) overrideMaxCents = Math.max(overrideMaxCents, toCents(overrideAud));
  }
  if (shippableUnits <= 0) return 0;
  const countRateCents = shippableUnits >= 2 ? flatMultiCents : flatSingleCents;
  return Math.max(countRateCents, overrideMaxCents);
}

/**
 * Does this order ship free? Decided on the goods subtotal alone — counting
 * shipping toward the threshold would let postage pay for itself.
 */
export function qualifiesForFreeShipping(subtotalCents, settings) {
  return subtotalCents >= toCents(freeShippingThresholdAud(settings));
}

// ── Tax + fee maths ─────────────────────────────────────────────────────

/**
 * GST on a taxable amount.
 * 'added'    → rate/100 of the amount, charged on top.
 * 'absorbed' → the tax already inside the amount, which is rate/(100+rate) —
 *              6.5% absorbed on $100 is $6.10, not $6.50.
 */
export function computeGstCents(taxableCents, settings) {
  const { enabled, ratePercent, mode } = gstSettings(settings);
  if (!enabled || ratePercent <= 0) return 0;
  const base = Math.max(0, taxableCents);
  return mode === "absorbed"
    ? Math.round((base * ratePercent) / (100 + ratePercent))
    : Math.round((base * ratePercent) / 100);
}

/**
 * Card processing fee.
 * 'absorbed' → what the shop will pay on this order; disclosed, never charged.
 * 'added'    → grossed up, because Stripe's percentage applies to the final
 *              amount including the surcharge itself. Charging a flat
 *              percent × base under-recovers on every order.
 *                 total = (base + fixed) / (1 - percent/100)
 *                 fee   = total - base
 */
export function computeCardFeeCents(baseCents, settings) {
  const { enabled, percent, fixedCents, mode } = cardFeeSettings(settings);
  if (!enabled) return 0;
  const base = Math.max(0, baseCents);
  if (base <= 0) return 0;

  if (mode === "added") {
    const rate = percent / 100;
    if (rate >= 1) return 0; // nonsensical config — never multiply the order
    return Math.max(0, Math.round((base + fixedCents) / (1 - rate)) - base);
  }
  // Absorbed: the actual cost of acceptance on the amount charged.
  return Math.round((base * percent) / 100) + fixedCents;
}

/**
 * Full breakdown. `shippingCents` is the quoted postage before any waiver — the
 * waiver is applied here so storefront and server cannot disagree about it.
 *
 * Amounts marked `*Included` are components of the total, already inside it.
 * Amounts not marked are charged on top.
 */
export function orderTotals({ subtotalCents, shippingCents = 0, settings, isPickup = false }) {
  const goods = Math.max(0, Math.round(Number(subtotalCents) || 0));
  const quoted = isPickup ? 0 : Math.max(0, Math.round(Number(shippingCents) || 0));
  const freeShippingApplied = !isPickup && qualifiesForFreeShipping(goods, settings);
  const shipping = freeShippingApplied ? 0 : quoted;

  const gst = gstSettings(settings);
  const taxable = goods + shipping;
  const gstCents = computeGstCents(taxable, settings);
  const gstIncluded = gst.mode === "absorbed";
  const afterTax = taxable + (gstIncluded ? 0 : gstCents);

  const card = cardFeeSettings(settings);
  const cardFeeCents = computeCardFeeCents(afterTax, settings);
  const cardFeeIncluded = card.mode !== "added";

  return {
    subtotalCents: goods,
    shippingCents: shipping,
    freeShippingApplied,
    gstCents,
    gstIncluded,
    gstLabel: gst.label,
    gstRatePercent: gst.ratePercent,
    cardFeeCents,
    cardFeeIncluded,
    cardFeeLabel: card.label,
    totalCents: afterTax + (cardFeeIncluded ? 0 : cardFeeCents),
  };
}

// ── Signed shipping quotes ──────────────────────────────────────────────
// auspostRates signs each quote; createCheckout verifies it before charging.
// This is what stops a crafted request naming its own postage price.

/** Stable fingerprint of a cart — item order and formatting must not change it. */
export function cartFingerprint(items) {
  return (items || [])
    .map((i) => `${String(i?.productId ?? i?.product_id ?? "").trim()}:${Math.max(1, Math.floor(Number(i?.quantity) || 1))}`)
    .filter((s) => !s.startsWith(":"))
    .sort()
    .join(",");
}

export function quotePayload({ code, priceCents, postcode, cartHash, expiresAt }) {
  return [code, priceCents, postcode, cartHash, expiresAt].join("|");
}
