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
import { json, preflight, serviceClient } from './shared.ts';

const PAC_BASE = 'https://digitalapi.auspost.com.au/postage/parcel/domestic';
const DEFAULT_SATCHEL_CM = { length: 35, width: 25, height: 2 }; // small satchel fallback

const isPostcode = (value: unknown) => /^\d{4}$/.test(String(value || '').trim());

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

    // Sum weight across the cart; approximate a single parcel using the
    // largest per-item footprint (a satchel/box that the whole order fits
    // in), falling back to a small satchel when products have no dimensions.
    let totalGrams = 0;
    let length = 0, width = 0, height = 0;
    for (const item of cart) {
      const productId = String(item?.productId || '').trim();
      const quantity = Math.max(1, Math.floor(Number(item?.quantity) || 1));
      if (!productId) continue;
      const { data: product } = await svc
        .from('products')
        .select('weight_grams, length_cm, width_cm, height_cm')
        .eq('id', productId)
        .maybeSingle();
      if (!product) continue;
      totalGrams += Number(product.weight_grams || 300) * quantity;
      length = Math.max(length, Number(product.length_cm) || 0);
      width = Math.max(width, Number(product.width_cm) || 0);
      height = Math.max(height, Number(product.height_cm) || 0);
    }
    if (totalGrams <= 0) totalGrams = 300;
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
    const availableServices = serviceData?.services?.service
      ? (Array.isArray(serviceData.services.service) ? serviceData.services.service : [serviceData.services.service])
      : [];

    if (!availableServices.length) {
      return json({ ok: true, services: [] });
    }

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
        rated.push({
          code,
          name: svcOption?.name || code,
          price_aud: Number(result.total_cost || result.total_cost_ex_gst || 0),
          delivery_time: result.delivery_time || null,
        });
      } catch (error) {
        console.error(`AusPost calculate.json error for ${code}:`, error);
      }
    }

    rated.sort((a, b) => a.price_aud - b.price_aud);
    return json({ ok: true, services: rated });
  } catch (error) {
    console.error('auspostRates error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
