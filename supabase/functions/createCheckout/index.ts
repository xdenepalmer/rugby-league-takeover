// Stripe checkout session creation. The canonical, unit-tested copy of these
// rules lives in tests/checkout-rules.mjs — keep the two in sync when editing.
import Stripe from 'npm:stripe@22.2.0';
import { json, preflight, serviceClient, getCaller, isEmail, getStripeSecretKey } from './shared.ts';

const MAX_CHECKOUT_QUANTITY = 20;
const CHECKOUT_CURRENCY = 'aud';
const DEFAULT_CHECKOUT_ORIGIN = 'https://rugbyleaguetakeover.com';

const toTrimmedString = (value: unknown) => String(value ?? '').trim();

const toPositiveInteger = (value: unknown, fallback = 1) => {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const toMoneyCents = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number * 100);
};

// deno-lint-ignore no-explicit-any
const getTrackedStock = (product: any) => {
  const stock = Number(product?.stock_quantity);
  return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : null;
};

const parseOrigin = (value: unknown) => {
  try {
    return new URL(String(value || '')).origin;
  } catch {
    return '';
  }
};

// deno-lint-ignore no-explicit-any
function normalizeCheckoutItems(rawItems: any) {
  if (!Array.isArray(rawItems)) return [];

  const byCartKey = new Map();
  for (const item of rawItems) {
    const productId = toTrimmedString(item?.productId);
    if (!productId) continue;

    const size = toTrimmedString(item?.size).slice(0, 20);
    const key = `${productId}::${size}`;
    const quantity = Math.min(toPositiveInteger(item?.quantity), MAX_CHECKOUT_QUANTITY);
    const existing = byCartKey.get(key) || { productId, size, quantity: 0 };
    existing.quantity = Math.min(existing.quantity + quantity, MAX_CHECKOUT_QUANTITY);
    byCartKey.set(key, existing);
  }

  return [...byCartKey.values()];
}

// deno-lint-ignore no-explicit-any
function buildCheckoutLineItems(items: any[], getProduct: (id: string) => any) {
  const lineItems = [];
  const stripeLineItems = [];
  const requestedByProductId = new Map();
  for (const item of items) {
    requestedByProductId.set(item.productId, (requestedByProductId.get(item.productId) || 0) + item.quantity);
  }

  for (const item of items) {
    const product = getProduct(item.productId);
    if (!product || product.is_active === false) {
      return { ok: false as const, status: 404, error: `Product '${item.productId}' is not available` };
    }

    const unitAmount = toMoneyCents(product.price_aud);
    if (!unitAmount) {
      return { ok: false as const, status: 400, error: `Product '${item.productId}' has an invalid price` };
    }

    const stock = getTrackedStock(product);
    const requestedTotal = requestedByProductId.get(item.productId) || item.quantity;
    if (stock !== null && stock < requestedTotal) {
      return { ok: false as const, status: 409, error: `Not enough stock for product '${product.name || item.productId}'` };
    }

    const displayName = item.size ? `${product.name} — Size ${item.size}` : product.name;

    lineItems.push({
      product_id: product.id,
      name: product.name,
      size: item.size || '',
      quantity: item.quantity,
      price_aud: Number((unitAmount / 100).toFixed(2)),
    });

    stripeLineItems.push({
      quantity: item.quantity,
      price_data: {
        currency: CHECKOUT_CURRENCY,
        unit_amount: unitAmount,
        product_data: {
          name: displayName,
          description: product.description || undefined,
          images: product.image_url ? [product.image_url] : undefined,
        },
      },
    });
  }

  if (lineItems.length === 0) {
    return { ok: false as const, status: 400, error: 'No valid products in cart' };
  }

  return { ok: true as const, lineItems, stripeLineItems };
}

// deno-lint-ignore no-explicit-any
// deno-lint-ignore no-explicit-any
function buildShippingLineItem(shipping: any) {
  const code = toTrimmedString(shipping?.code);
  const name = toTrimmedString(shipping?.name) || 'Shipping';
  const postcode = toTrimmedString(shipping?.postcode);
  const price = Number(shipping?.price_aud);
  if (!code || !postcode || !Number.isFinite(price) || price < 0) return null;

  const unitAmount = Math.round(price * 100);
  return {
    code,
    name,
    postcode,
    price_aud: Number((unitAmount / 100).toFixed(2)),
    stripeLineItem: unitAmount > 0
      ? {
          quantity: 1,
          price_data: {
            currency: CHECKOUT_CURRENCY,
            unit_amount: unitAmount,
            product_data: { name: `Shipping — ${name} (AusPost)` },
          },
        }
      : null, // free shipping: nothing to charge, still recorded on the order
  };
}

// ── Money rules — mirror of tests/money-rules.mjs, keep in sync ────────────
// All in integer cents. GST and the card fee are each either charged on top
// ('added') or disclosed as a component of the price ('absorbed'), per the
// saved settings. Order of operations: goods → shipping → GST → card fee.
const DEFAULT_GST_RATE_PERCENT = 6.5;
const DEFAULT_FREE_SHIPPING_THRESHOLD_AUD = 150;
const DEFAULT_CARD_FEE_PERCENT = 1.75;
const DEFAULT_CARD_FEE_FIXED_AUD = 0.3;

const toCents = (aud: unknown) => Math.round(Number(aud || 0) * 100);
const fromCents = (cents: number) => Number((cents / 100).toFixed(2));

const clampPercent = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : fallback;
};

// deno-lint-ignore no-explicit-any
function gstSettings(settings: any) {
  return {
    enabled: settings?.gst_enabled !== false,
    ratePercent: clampPercent(settings?.gst_rate_percent, DEFAULT_GST_RATE_PERCENT),
    mode: settings?.gst_mode === 'absorbed' ? 'absorbed' : 'added',
    label: String(settings?.gst_label || 'GST').trim() || 'GST',
  };
}

// deno-lint-ignore no-explicit-any
function cardFeeSettings(settings: any) {
  const fixed = Number(settings?.card_fee_fixed_aud);
  return {
    enabled: settings?.card_fee_enabled === true,
    percent: clampPercent(settings?.card_fee_percent, DEFAULT_CARD_FEE_PERCENT),
    fixedCents: Number.isFinite(fixed) && fixed >= 0 ? toCents(fixed) : toCents(DEFAULT_CARD_FEE_FIXED_AUD),
    mode: settings?.card_fee_mode === 'added' ? 'added' : 'absorbed',
    label: String(settings?.card_fee_label || 'Card processing fee').trim() || 'Card processing fee',
  };
}

// deno-lint-ignore no-explicit-any
function freeShippingThresholdAud(settings: any) {
  const threshold = Number(settings?.free_shipping_threshold_aud);
  return Number.isFinite(threshold) && threshold >= 0 ? threshold : DEFAULT_FREE_SHIPPING_THRESHOLD_AUD;
}

// 'absorbed' is the tax already inside the price: rate/(100+rate), not rate/100.
// deno-lint-ignore no-explicit-any
function computeGstCents(taxableCents: number, settings: any) {
  const { enabled, ratePercent, mode } = gstSettings(settings);
  if (!enabled || ratePercent <= 0) return 0;
  const base = Math.max(0, taxableCents);
  return mode === 'absorbed'
    ? Math.round((base * ratePercent) / (100 + ratePercent))
    : Math.round((base * ratePercent) / 100);
}

// 'added' is grossed up: Stripe's percentage applies to the final amount
// including the surcharge, so percent x base under-recovers on every order.
// deno-lint-ignore no-explicit-any
function computeCardFeeCents(baseCents: number, settings: any) {
  const { enabled, percent, fixedCents, mode } = cardFeeSettings(settings);
  if (!enabled) return 0;
  const base = Math.max(0, baseCents);
  if (base <= 0) return 0;
  if (mode === 'added') {
    const rate = percent / 100;
    if (rate >= 1) return 0;
    return Math.max(0, Math.round((base + fixedCents) / (1 - rate)) - base);
  }
  return Math.round((base * percent) / 100) + fixedCents;
}

// deno-lint-ignore no-explicit-any
function orderTotals({ subtotalCents, shippingCents = 0, settings, isPickup = false }: any) {
  const goods = Math.max(0, Math.round(Number(subtotalCents) || 0));
  const quoted = isPickup ? 0 : Math.max(0, Math.round(Number(shippingCents) || 0));
  const freeShippingApplied = !isPickup && goods >= toCents(freeShippingThresholdAud(settings));
  const shipping = freeShippingApplied ? 0 : quoted;

  const gst = gstSettings(settings);
  const taxable = goods + shipping;
  const gstCents = computeGstCents(taxable, settings);
  const gstIncluded = gst.mode === 'absorbed';
  const afterTax = taxable + (gstIncluded ? 0 : gstCents);

  const card = cardFeeSettings(settings);
  const cardFeeCents = computeCardFeeCents(afterTax, settings);
  const cardFeeIncluded = card.mode !== 'added';

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

// ── Signed shipping quotes ────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
function cartFingerprint(items: any[]) {
  return (items || [])
    .map((i) => `${String(i?.productId ?? i?.product_id ?? '').trim()}:${Math.max(1, Math.floor(Number(i?.quantity) || 1))}`)
    .filter((s) => !s.startsWith(':'))
    .sort()
    .join(',');
}

function quotePayload(code: string, priceCents: number, postcode: string, cartHash: string, expiresAt: number) {
  return [code, priceCents, postcode, cartHash, expiresAt].join('|');
}

/** Constant-time compare so a wrong signature leaks nothing through timing. */
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyQuoteSignature(payload: string, signature: string) {
  const secret = Deno.env.get('SHIPPING_QUOTE_SECRET');
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(expected, String(signature).trim().toLowerCase());
}

// ── Parcel-size rules — mirror of tests/parcel-rules.mjs, keep in sync ──────
// auspostRates filters oversized packaging out of the quote; this is the
// server-side half of that rule, applied to whatever the client sends back.
export const PARCEL_RANK: Record<string, number> = { satchel: 0, small: 1, medium: 2, large: 3 };
const DEFAULT_PARCEL_SIZE = 'satchel';

const normalizeParcelSize = (value: unknown) => {
  const size = String(value ?? '').trim().toLowerCase();
  return size in PARCEL_RANK ? size : DEFAULT_PARCEL_SIZE;
};

// The qualifier (small/medium/large) is the capacity; a bare "satchel" is the
// baseline. Largest-first so "extra large" never matches as "large".
const SIZE_WORDS: [string, string][] = [
  ['extra large', 'large'],
  ['extralarge', 'large'],
  ['large', 'large'],
  ['medium', 'medium'],
  ['small', 'small'],
  ['satchel', 'satchel'],
];

// deno-lint-ignore no-explicit-any
function serviceParcelSize(service: any): string | null {
  const haystack = `${service?.code ?? ''} ${service?.name ?? ''}`.toLowerCase();
  for (const [word, size] of SIZE_WORDS) {
    if (haystack.includes(word)) return size;
  }
  return null; // weight-priced — always legitimate for the real parcel
}

// Mirror of resolveFulfilment in tests/checkout-rules.mjs — keep in sync.
// Decides whether a (choice, country) pair may check out at all. The settings
// come from the DATABASE, never the request, so a client cannot enable pickup
// or dodge the Australia-only shipping rule by lying about the config.
const isAustralia = (country: unknown) => {
  const c = toTrimmedString(country).toUpperCase();
  return c === 'AU' || c === 'AUS' || c === 'AUSTRALIA';
};

// deno-lint-ignore no-explicit-any
function resolveFulfilment({ method, shipping, country, settings }: any) {
  const choice = toTrimmedString(method).toLowerCase() || 'shipping';
  const pickupEnabled = settings?.pickup_enabled === true;
  const audience = toTrimmedString(settings?.pickup_audience).toLowerCase() || 'international';
  const australian = isAustralia(country);

  if (choice === 'pickup') {
    if (!pickupEnabled) {
      return { ok: false, error: 'Collection in Las Vegas is not currently available.' };
    }
    if (audience === 'international' && australian) {
      return { ok: false, error: 'Collection is for international orders only — please choose a shipping method.' };
    }
    return { ok: true, method: 'pickup', shipping: null };
  }

  if (choice !== 'shipping') {
    return { ok: false, error: "Choose how you'd like to receive your order." };
  }

  if (country && !australian) {
    return {
      ok: false,
      error: pickupEnabled
        ? 'We only ship within Australia — choose collection in Las Vegas instead.'
        : 'We currently only ship within Australia.',
    };
  }

  const selection = buildShippingLineItem(shipping);
  if (!selection) {
    return { ok: false, error: 'A shipping option is required — please choose a shipping method.' };
  }
  return { ok: true, method: 'shipping', shipping: selection };
}

function resolveCheckoutOrigin(originHeader: unknown, allowlistEnv: unknown, fallback = DEFAULT_CHECKOUT_ORIGIN) {
  const fallbackOrigin = parseOrigin(fallback) || DEFAULT_CHECKOUT_ORIGIN;
  const requestedOrigin = parseOrigin(originHeader);
  if (!requestedOrigin) return fallbackOrigin;

  const allowedOrigins = new Set(
    String(allowlistEnv || fallbackOrigin)
      .split(',')
      .map(parseOrigin)
      .filter(Boolean)
  );
  allowedOrigins.add(fallbackOrigin);

  return allowedOrigins.has(requestedOrigin) ? requestedOrigin : fallbackOrigin;
}

// deno-lint-ignore no-explicit-any
function resolveCheckoutCustomer({ customerName = '', customerEmail = '', user = null }: any = {}) {
  return {
    name: toTrimmedString(customerName || user?.full_name),
    email: toTrimmedString(customerEmail || user?.email),
  };
}

// deno-lint-ignore no-explicit-any
function buildOrderMetadata({ appId, orderId, totalAud }: any) {
  return {
    rlt_app_id: toTrimmedString(appId),
    order_id: toTrimmedString(orderId),
    expected_total_aud: Number(totalAud || 0).toFixed(2),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const stripe = new Stripe(getStripeSecretKey());
    const { items, customerName = '', customerEmail = '', shipping, fulfilment, country } = await req.json();
    const normalizedItems = normalizeCheckoutItems(items);

    const user = await getCaller(req, svc);
    const { name: resolvedName, email: resolvedEmail } = resolveCheckoutCustomer({ customerName, customerEmail, user });

    if (!normalizedItems.length || !isEmail(resolvedEmail)) {
      return json({ error: 'Cart items and a valid email are required' }, 400);
    }

    // Fulfilment is decided against the SAVED settings, not the request, so a
    // client can't turn pickup on for itself or bypass Australia-only shipping.
    // An order can never reach Stripe without a valid shipping selection or an
    // allowed pickup.
    const { data: siteSettings } = await svc
      .from('site_settings')
      .select('pickup_enabled, pickup_audience, pickup_label, pickup_instructions, gst_enabled, gst_rate_percent, gst_mode, gst_label, card_fee_enabled, card_fee_percent, card_fee_fixed_aud, card_fee_mode, card_fee_label, free_shipping_threshold_aud')
      .order('updated_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const fulfilmentResult = resolveFulfilment({
      method: fulfilment,
      shipping,
      country,
      settings: siteSettings,
    });
    if (!fulfilmentResult.ok) {
      return json({ error: fulfilmentResult.error }, 400);
    }
    const isPickup = fulfilmentResult.method === 'pickup';
    // Pickup carries no shipping cost and no address to charge for.
    const shippingSelection = fulfilmentResult.shipping || { code: 'PICKUP', name: 'Collect in Las Vegas', postcode: '', price_aud: 0, stripeLineItem: null };

    const productsById = new Map();
    const unavailableProductIds = [];
    for (const item of normalizedItems) {
      const { data: product } = await svc.from('products').select('*').eq('id', item.productId).maybeSingle();
      if (!product) {
        unavailableProductIds.push(item.productId);
      } else {
        productsById.set(item.productId, product);
      }
    }

    if (unavailableProductIds.length > 0) {
      return json({
        error: 'Some items in your cart are no longer available. Please review your cart.',
        unavailableProductIds,
      }, 409);
    }

    // The storefront hides oversized packaging, but the rate list arrives from the
    // client, so the ceiling is re-derived from the saved products and enforced
    // here too. Without this a crafted request could still buy a Large box.
    if (!isPickup) {
      let requiredSize = DEFAULT_PARCEL_SIZE;
      for (const product of productsById.values()) {
        const size = normalizeParcelSize(product?.parcel_size);
        if (PARCEL_RANK[size] > PARCEL_RANK[requiredSize]) requiredSize = size;
      }
      const chosenSize = serviceParcelSize(shippingSelection);
      if (chosenSize !== null && PARCEL_RANK[chosenSize] > PARCEL_RANK[requiredSize]) {
        return json({
          error: 'That shipping option is too large for this order — please recalculate shipping.',
        }, 400);
      }
    }

    const lineItemResult = buildCheckoutLineItems(normalizedItems, (productId) => productsById.get(productId));
    if (!lineItemResult.ok) {
      return json({ error: lineItemResult.error }, lineItemResult.status);
    }

    const { lineItems, stripeLineItems } = lineItemResult;

    // ── Postage price comes from OUR signed quote, never the request ────────
    // auspostRates signs (service, price, postcode, cart, expiry). Re-deriving
    // the cart hash here means an edited cart or an edited price fails the
    // check. The free-shipping waiver is applied server-side too — it used to
    // be a hardcoded 150 in the browser, with the client simply sending 0.
    let quotedShippingCents = 0;
    if (!isPickup) {
      const claimedCents = toCents(shippingSelection.price_aud);
      const cartHash = cartFingerprint(normalizedItems);
      const expiresAt = Number(shipping?.expires_at);
      const payload = quotePayload(shippingSelection.code, claimedCents, shippingSelection.postcode, cartHash, expiresAt);
      const signatureValid = Number.isFinite(expiresAt)
        && await verifyQuoteSignature(payload, String(shipping?.signature || ''));

      if (!signatureValid) {
        return json({ error: 'Shipping quote could not be verified — please recalculate shipping.' }, 400);
      }
      if (Date.now() > expiresAt) {
        return json({ error: 'That shipping quote has expired — please recalculate shipping.' }, 400);
      }
      quotedShippingCents = claimedCents;
    }

    const subtotalCents = lineItems.reduce(
      (sum: number, item: { price_aud?: number; quantity?: number }) =>
        sum + toCents(item.price_aud) * Number(item.quantity || 0),
      0,
    );
    const totals = orderTotals({
      subtotalCents,
      shippingCents: quotedShippingCents,
      settings: siteSettings,
      isPickup,
    });
    const totalAud = fromCents(totals.totalCents);

    const origin = resolveCheckoutOrigin(
      req.headers.get('origin'),
      Deno.env.get('CHECKOUT_ALLOWED_ORIGINS'),
      Deno.env.get('CHECKOUT_DEFAULT_ORIGIN') || DEFAULT_CHECKOUT_ORIGIN
    );

    // Rebuild the postage line from the server's figure, so a waived or
    // re-derived amount is what actually reaches Stripe.
    const allStripeLineItems = [...stripeLineItems];
    if (totals.shippingCents > 0) {
      allStripeLineItems.push({
        quantity: 1,
        price_data: {
          currency: CHECKOUT_CURRENCY,
          unit_amount: totals.shippingCents,
          product_data: { name: `Shipping — ${shippingSelection.name} (AusPost)` },
        },
      });
    }
    // Absorbed amounts are already inside the prices above — only charge the
    // ones the shop has chosen to pass on.
    if (!totals.gstIncluded && totals.gstCents > 0) {
      allStripeLineItems.push({
        quantity: 1,
        price_data: {
          currency: CHECKOUT_CURRENCY,
          unit_amount: totals.gstCents,
          product_data: { name: `${totals.gstLabel} (${totals.gstRatePercent}%)` },
        },
      });
    }
    if (!totals.cardFeeIncluded && totals.cardFeeCents > 0) {
      allStripeLineItems.push({
        quantity: 1,
        price_data: {
          currency: CHECKOUT_CURRENCY,
          unit_amount: totals.cardFeeCents,
          product_data: { name: totals.cardFeeLabel },
        },
      });
    }

    const { data: order, error: orderError } = await svc
      .from('store_orders')
      .insert({
        customer_name: resolvedName,
        customer_email: resolvedEmail,
        status: 'pending',
        total_aud: totalAud,
        line_items: lineItems,
        user_email: user?.email || '',
        user_id: user?.id || '',
        customer_postcode: shippingSelection.postcode,
        shipping_service_code: shippingSelection.code,
        shipping_service_name: shippingSelection.name,
        // The server's figure, after the free-shipping waiver — not the claim.
        shipping_cost_aud: fromCents(totals.shippingCents),
        fulfilment_method: fulfilmentResult.method,
        // Rate and mode are stored with the amount so a later settings change
        // never rewrites the history of orders already placed.
        subtotal_aud: fromCents(totals.subtotalCents),
        gst_amount_aud: fromCents(totals.gstCents),
        gst_rate_percent: totals.gstRatePercent,
        gst_included: totals.gstIncluded,
        card_fee_aud: fromCents(totals.cardFeeCents),
        card_fee_included: totals.cardFeeIncluded,
        // A pickup order has no delivery address by design — record where to
        // collect so the admin (and the customer's confirmation) has it.
        ...(isPickup
          ? {
              shipping_address: siteSettings?.pickup_instructions
                || siteSettings?.pickup_label
                || 'Collect in Las Vegas at the event',
              customer_status_note: 'Collect in Las Vegas at the event — bring your order number and ID.',
            }
          : {}),
      })
      .select('id')
      .single();
    if (orderError) throw orderError;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: resolvedEmail,
      success_url: `${origin}/store?success=true`,
      cancel_url: `${origin}/store?cancelled=true`,
      line_items: allStripeLineItems,
      phone_number_collection: { enabled: true },
      // Domestic AU only — matches the AusPost rate calc, which only quotes
      // Australian postcodes. A pickup order is collected in person, so Stripe
      // must NOT ask for a delivery address it would never be shipped to.
      ...(isPickup ? {} : { shipping_address_collection: { allowed_countries: ['AU'] as const } }),
      metadata: buildOrderMetadata({
        appId: Deno.env.get('RLT_APP_ID') || 'rugby-league-takeover',
        orderId: order.id,
        totalAud,
      }),
    });

    await svc.from('store_orders').update({ stripe_session_id: session.id }).eq('id', order.id);
    return json({ url: session.url });
  } catch (error) {
    // Log the real cause server-side; never leak internals (Stripe keys, stack,
    // DB errors) to the browser.
    console.error('createCheckout error:', error);
    return json({ error: 'Checkout could not be started. Please try again.' }, 500);
  }
});
