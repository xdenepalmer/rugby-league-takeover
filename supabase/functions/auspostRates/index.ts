// Live shipping rate calculation for checkout, using AusPost's Postage
// Assessment Calculator (PAC) API. Public/anonymous — called from the cart
// before payment, so shoppers see a real AusPost price before checkout.
//
// ⚠️ UNVERIFIED AGAINST A LIVE AUSPOST ACCOUNT. The request/response shape
// below reflects AusPost's publicly documented PAC contract, but this
// project has no live AUSPOST_API_KEY to test against. Smoke-test with a
// real key before relying on this in production — see MIGRATION-SUPABASE.md.
//
// Flow: GET .../parcel/domestic/service.json to discover which services are
// available for this parcel (weight/dims/postcodes), then GET
// .../parcel/domestic/calculate.json per service code to get its price + ETA.
import { json, preflight, serviceClient, serverError } from './shared.ts';

const PAC_BASE = 'https://digitalapi.auspost.com.au/postage/parcel/domestic';
const DEFAULT_SATCHEL_CM = { length: 35, width: 25, height: 2 }; // small satchel fallback
// Only used when a product has no weight recorded. Multiplied by quantity, so it
// overcharges multi-item orders — products missing a weight are logged and
// flagged in the admin rather than left to quietly distort quotes.
const ASSUMED_ITEM_WEIGHT_G = 300;

const isPostcode = (value: unknown) => /^\d{4}$/.test(String(value || '').trim());

// ── Parcel-size rules — mirror of tests/parcel-rules.mjs, keep in sync ──────
// service.json returns every product that fits the declared dimensions: the two
// weight-priced services plus every flat rate at or above that size. Offering all
// of them let a shopper pick a $25.20 Large box for a single t-shirt, so anything
// bigger than the cart's largest item is dropped here rather than in the UI.
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
  return null; // weight-priced (Parcel Post / Express Post) — always legitimate
}

// ── Signed quotes — mirror of tests/money-rules.mjs, keep in sync ──────────
// Each quote is signed over (service, price, postcode, cart, expiry) so
// createCheckout can charge the price WE quoted rather than the one the browser
// hands back. Without this a crafted request names its own postage.
const QUOTE_TTL_MS = 30 * 60 * 1000;

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

async function signQuote(payload: string) {
  const secret = Deno.env.get('SHIPPING_QUOTE_SECRET');
  if (!secret) throw new Error('Shipping quotes are not configured (missing SHIPPING_QUOTE_SECRET)');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// deno-lint-ignore no-explicit-any
function allowedServices(services: any[], required: string) {
  const ceiling = PARCEL_RANK[normalizeParcelSize(required)];
  return (services || []).filter((service) => {
    const size = serviceParcelSize(service);
    if (size === null) return true;
    return PARCEL_RANK[size] <= ceiling;
  });
}

function authHeaders() {
  const key = Deno.env.get('AUSPOST_API_KEY');
  if (!key) throw new Error('AusPost is not configured (missing AUSPOST_API_KEY)');
  return { 'AUTH_KEY': key };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const { toPostcode, cart } = await req.json().catch(() => ({}));
    const destination = String(toPostcode || '').trim();

    if (!isPostcode(destination)) {
      return json({ error: 'A valid 4-digit postcode is required' }, 400);
    }
    if (!Array.isArray(cart) || cart.length === 0) {
      return json({ error: 'Cart is empty' }, 400);
    }

    const { data: settings } = await svc.from('site_settings').select('shipping_sender_postcode').limit(1).maybeSingle();
    const origin = String(settings?.shipping_sender_postcode || '').trim();
    if (!isPostcode(origin)) {
      return json({ error: 'Shipping is not configured yet — set a sender postcode in Site Settings' }, 503);
    }

    // Everything goes in ONE parcel: weights add up, the footprint is the
    // largest single item (whatever satchel or box the order fits in).
    // Non-shippable items (memberships, anything digital) are skipped entirely
    // so they neither add weight nor force a postage charge.
    let totalGrams = 0;
    let length = 0, width = 0, height = 0;
    let requiredSize = DEFAULT_PARCEL_SIZE;
    let shippableUnits = 0;
    const missingWeight: string[] = [];
    for (const item of cart) {
      const productId = String(item?.productId || '').trim();
      const quantity = Math.max(1, Math.floor(Number(item?.quantity) || 1));
      if (!productId) continue;
      const { data: product } = await svc
        .from('products')
        .select('name, weight_grams, length_cm, width_cm, height_cm, parcel_size, shipping_required')
        .eq('id', productId)
        .maybeSingle();
      if (!product) continue;
      if (product.shipping_required === false) continue;

      shippableUnits += quantity;
      // A missing weight used to become 300g per unit silently, which is how two
      // ~40g stubbie coolers declared 600g and crossed AusPost's 500g bracket.
      // The assumption is still made (checkout must not hard-fail on a config
      // gap) but it is now recorded and surfaced instead of hidden.
      const grams = Number(product.weight_grams);
      if (!Number.isFinite(grams) || grams <= 0) {
        missingWeight.push(String(product.name || productId));
        totalGrams += ASSUMED_ITEM_WEIGHT_G * quantity;
      } else {
        totalGrams += grams * quantity;
      }
      length = Math.max(length, Number(product.length_cm) || 0);
      width = Math.max(width, Number(product.width_cm) || 0);
      height = Math.max(height, Number(product.height_cm) || 0);
      const size = normalizeParcelSize(product.parcel_size);
      if (PARCEL_RANK[size] > PARCEL_RANK[requiredSize]) requiredSize = size;
    }

    // Nothing physical in the cart — there is no parcel to price.
    if (shippableUnits === 0) {
      return json({ ok: true, services: [], shippingRequired: false });
    }
    if (missingWeight.length) {
      console.warn('auspostRates: products missing weight_grams, quote is an estimate:', missingWeight.join(', '));
    }

    if (totalGrams <= 0) totalGrams = ASSUMED_ITEM_WEIGHT_G;
    length = length || DEFAULT_SATCHEL_CM.length;
    width = width || DEFAULT_SATCHEL_CM.width;
    height = height || DEFAULT_SATCHEL_CM.height;
    const weightKg = Math.max(0.01, totalGrams / 1000);

    const dimParams = `&length=${length}&width=${width}&height=${height}&weight=${weightKg.toFixed(2)}`;
    const serviceUrl = `${PAC_BASE}/service.json?from_postcode=${origin}&to_postcode=${destination}${dimParams}`;

    const serviceRes = await fetch(serviceUrl, { headers: authHeaders() });
    if (!serviceRes.ok) {
      const body = await serviceRes.text().catch(() => '');
      console.error('AusPost service.json error:', serviceRes.status, body);
      return json({ error: 'Unable to fetch shipping services right now' }, 502);
    }
    const serviceData = await serviceRes.json();
    const allServices = serviceData?.services?.service
      ? (Array.isArray(serviceData.services.service) ? serviceData.services.service : [serviceData.services.service])
      : [];

    // Filter BEFORE pricing: each surviving service costs one calculate.json
    // round-trip, so dropping the oversized ones here also cuts the request count.
    const availableServices = allowedServices(allServices, requiredSize);

    if (!availableServices.length) {
      return json({ ok: true, services: [], parcelSize: requiredSize });
    }

    const cartHash = cartFingerprint(cart);
    const expiresAt = Date.now() + QUOTE_TTL_MS;

    const rated = [];
    for (const svcOption of availableServices) {
      const code = svcOption?.code;
      if (!code) continue;
      try {
        const calcUrl = `${PAC_BASE}/calculate.json?from_postcode=${origin}&to_postcode=${destination}${dimParams}&service_code=${encodeURIComponent(code)}`;
        const calcRes = await fetch(calcUrl, { headers: authHeaders() });
        if (!calcRes.ok) continue;
        const calcData = await calcRes.json();
        const result = calcData?.postage_result;
        if (!result) continue;
        const priceAud = Number(result.total_cost || result.total_cost_ex_gst || 0);
        const priceCents = Math.round(priceAud * 100);
        rated.push({
          code,
          name: svcOption?.name || code,
          price_aud: priceAud,
          delivery_time: result.delivery_time || null,
          expires_at: expiresAt,
          signature: await signQuote(quotePayload(code, priceCents, destination, cartHash, expiresAt)),
        });
      } catch (error) {
        console.error(`AusPost calculate.json error for ${code}:`, error);
      }
    }

    rated.sort((a, b) => a.price_aud - b.price_aud);
    return json({ ok: true, services: rated, parcelSize: requiredSize });
  } catch (error) {
    return serverError('auspostRates', error);
  }
});
