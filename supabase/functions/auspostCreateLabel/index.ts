// Admin-only: create an AusPost shipment for a paid order and fetch its
// shipping label. Uses AusPost's Shipping & Tracking API (the same API
// contract used by both MyPost Business — once API access is enabled on the
// account — and Enterprise/eParcel accounts).
//
// ⚠️ HIGHEST-RISK, LEAST-VERIFIED PART OF THIS INTEGRATION. This project has
// no live AusPost account to test against. Before relying on this for a real
// order:
//   1. Confirm API access is enabled on the MyPost Business account (AusPost
//      support may need to switch this on — it isn't always automatic).
//   2. Test end-to-end with a real (or AusPost sandbox) order first.
//   3. Verify the request/response field names below against what your
//      account's actual API responses look like — AusPost's public docs
//      describe this contract, but this code has not been run against a
//      live key. See MIGRATION-SUPABASE.md.
import { json, preflight, serviceClient, getCaller } from './shared.ts';

const SHIPPING_BASE = 'https://digitalapi.auspost.com.au/shipping/v1';
const LABEL_POLL_ATTEMPTS = 4;
const LABEL_POLL_DELAY_MS = 1500;

function authHeaders() {
  const key = Deno.env.get('AUSPOST_API_KEY');
  const account = Deno.env.get('AUSPOST_ACCOUNT_NUMBER');
  if (!key || !account) throw new Error('AusPost shipping is not configured (missing AUSPOST_API_KEY or AUSPOST_ACCOUNT_NUMBER)');
  return { 'Authorization': key, 'Account-Number': account, 'Content-Type': 'application/json' };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const me = await getCaller(req, svc);
    if (!me || me.role !== 'admin') {
      return json({ error: 'Admin access required' }, 403);
    }

    const { orderId } = await req.json().catch(() => ({}));
    if (!orderId) return json({ error: 'orderId is required' }, 400);

    const { data: order } = await svc.from('store_orders').select('*').eq('id', orderId).maybeSingle();
    if (!order) return json({ error: 'Order not found' }, 404);
    if (order.status !== 'paid' && order.status !== 'packing') {
      return json({ error: 'Order must be paid before a label can be created' }, 400);
    }
    if (!order.shipping_postcode || !order.shipping_address_line1) {
      return json({ error: 'Order has no structured shipping address on file yet' }, 400);
    }
    // A label already exists for this order. If AusPost hosts it directly
    // (a real http(s) URL), it's reusable as-is. If we generated it ourselves
    // (stored as a bare storage path, since signed URLs expire in an hour),
    // mint a fresh signed URL instead of erroring — this makes "create label"
    // effectively idempotent and safe to click again once the last link expired.
    if (order.shipping_label_url) {
      if (/^https?:\/\//i.test(order.shipping_label_url)) {
        return json({ ok: true, status: 'ready', tracking_number: order.tracking_number, tracking_url: order.tracking_url, shipping_label_url: order.shipping_label_url });
      }
      const { data: signed, error: signError } = await svc.storage.from('labels').createSignedUrl(order.shipping_label_url, 60 * 60);
      if (signError) return json({ error: 'Could not refresh the label link' }, 500);
      return json({ ok: true, status: 'ready', tracking_number: order.tracking_number, tracking_url: order.tracking_url, shipping_label_url: signed?.signedUrl || null });
    }

    const { data: settings } = await svc.from('site_settings').select('*').limit(1).maybeSingle();
    if (!settings?.shipping_sender_postcode || !settings?.shipping_sender_address_line1) {
      return json({ error: 'Sender address is not configured yet — set it in Site Settings' }, 503);
    }

    // Recompute total parcel weight/dimensions from the order's line items,
    // same approach as auspostRates.
    let totalGrams = 0;
    let length = 0, width = 0, height = 0;
    for (const item of order.line_items || []) {
      if (!item.product_id) continue;
      const { data: product } = await svc
        .from('products')
        .select('weight_grams, length_cm, width_cm, height_cm')
        .eq('id', item.product_id)
        .maybeSingle();
      if (!product) continue;
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      totalGrams += Number(product.weight_grams || 300) * quantity;
      length = Math.max(length, Number(product.length_cm) || 0);
      width = Math.max(width, Number(product.width_cm) || 0);
      height = Math.max(height, Number(product.height_cm) || 0);
    }
    const weightKg = Math.max(0.01, (totalGrams || 300) / 1000);

    const headers = authHeaders();

    const shipmentPayload = {
      shipments: [
        {
          shipment_reference: order.id,
          from: {
            name: settings.shipping_sender_name || settings.shipping_sender_business_name || 'Rugby League Takeover',
            business_name: settings.shipping_sender_business_name || undefined,
            lines: [settings.shipping_sender_address_line1, settings.shipping_sender_address_line2].filter(Boolean),
            suburb: settings.shipping_sender_suburb,
            state: settings.shipping_sender_state,
            postcode: settings.shipping_sender_postcode,
            phone: undefined,
          },
          to: {
            name: order.shipping_name || order.customer_name || 'Customer',
            lines: [order.shipping_address_line1, order.shipping_address_line2].filter(Boolean),
            suburb: order.shipping_suburb,
            state: order.shipping_state,
            postcode: order.shipping_postcode,
            phone: undefined,
          },
          items: [
            {
              item_reference: order.id,
              product_id: 'PARCEL_POST', // standard AusPost domestic parcel product
              length: length || 35,
              width: width || 25,
              height: height || 2,
              weight: weightKg,
            },
          ],
        },
      ],
    };

    const shipmentRes = await fetch(`${SHIPPING_BASE}/shipments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(shipmentPayload),
    });
    if (!shipmentRes.ok) {
      const body = await shipmentRes.text().catch(() => '');
      console.error('AusPost create shipment error:', shipmentRes.status, body);
      return json({ error: 'AusPost rejected the shipment request', details: body }, 502);
    }
    const shipmentData = await shipmentRes.json();
    const shipment = shipmentData?.shipments?.[0];
    const shipmentId = shipment?.shipment_id;
    const trackingNumber = shipment?.items?.[0]?.tracking_details?.article_id || shipment?.items?.[0]?.tracking_details?.consignment_id || null;

    if (!shipmentId) {
      console.error('AusPost create shipment: no shipment_id in response', JSON.stringify(shipmentData));
      return json({ error: 'AusPost did not return a shipment id' }, 502);
    }

    // Request the label. This can be synchronous or return a pending job —
    // poll briefly for the label to become available.
    let labelUrl: string | null = null;
    let labelBase64: string | null = null;

    const requestLabel = async () => {
      const labelRes = await fetch(`${SHIPPING_BASE}/labels`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          shipments: [{ shipment_id: shipmentId }],
          preferences: [{ type: 'PRINT', format: 'PDF', groups: [{ group: 1, layout: 'A4-1pp' }] }],
        }),
      });
      if (!labelRes.ok) {
        const body = await labelRes.text().catch(() => '');
        console.error('AusPost label request error:', labelRes.status, body);
        return null;
      }
      return labelRes.json();
    };

    let labelData = await requestLabel();
    for (let attempt = 0; attempt < LABEL_POLL_ATTEMPTS && labelData; attempt++) {
      const label = labelData?.labels?.[0];
      if (label?.url) { labelUrl = label.url; break; }
      if (label?.content) { labelBase64 = label.content; break; }
      if (label?.status && String(label.status).toLowerCase() !== 'pending') break;
      await sleep(LABEL_POLL_DELAY_MS);
      labelData = await requestLabel();
    }

    if (!labelUrl && !labelBase64) {
      // Shipment was created even though the label isn't ready yet — persist
      // the tracking number now so it isn't lost, and let the admin retry
      // label creation shortly (AusPost sometimes needs longer to render).
      await svc.from('store_orders').update({
        tracking_number: trackingNumber,
        carrier: 'Australia Post',
      }).eq('id', orderId);
      return json({ ok: true, status: 'processing', tracking_number: trackingNumber, message: 'Shipment created; label is still rendering — try again shortly.' });
    }

    // What we persist to shipping_label_url: an AusPost-hosted URL is stored
    // verbatim (permanent, reusable); a self-uploaded PDF is stored as its
    // bare storage PATH, not a signed URL, since signed URLs expire in an
    // hour — the "already exists" branch above mints a fresh one on demand.
    let storedLabelValue = labelUrl;
    let responseLabelUrl = labelUrl;
    if (!labelUrl && labelBase64) {
      const bytes = Uint8Array.from(atob(labelBase64), (c) => c.charCodeAt(0));
      const path = `${orderId}.pdf`;
      const { error: uploadError } = await svc.storage.from('labels').upload(path, bytes, {
        contentType: 'application/pdf',
        upsert: true,
      });
      if (uploadError) {
        console.error('Label upload error:', uploadError);
        return json({ error: 'Label was generated but could not be stored' }, 500);
      }
      storedLabelValue = path;
      const { data: signed } = await svc.storage.from('labels').createSignedUrl(path, 60 * 60);
      responseLabelUrl = signed?.signedUrl || null;
    }

    const trackingUrl = trackingNumber
      ? `https://auspost.com.au/mypost/track/#/details/${trackingNumber}`
      : null;

    await svc.from('store_orders').update({
      tracking_number: trackingNumber,
      tracking_url: trackingUrl,
      carrier: 'Australia Post',
      shipping_label_url: storedLabelValue,
      status: order.status === 'paid' ? 'packing' : order.status,
      timeline: [
        ...(Array.isArray(order.timeline) ? order.timeline : []),
        { action: 'label_created', timestamp: new Date().toISOString(), note: `AusPost label created (tracking ${trackingNumber || 'pending'})`, actor: me.email },
      ],
    }).eq('id', orderId);

    return json({ ok: true, status: 'ready', tracking_number: trackingNumber, tracking_url: trackingUrl, shipping_label_url: responseLabelUrl });
  } catch (error) {
    console.error('auspostCreateLabel error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
