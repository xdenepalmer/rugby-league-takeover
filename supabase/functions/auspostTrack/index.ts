// Admin-only: poll AusPost's public Track API for an order's tracking
// number and refresh its status. Uses only AUSPOST_API_KEY (no account
// number needed — the Track API is separate from the Shipping API and
// works for any AusPost consignment/article number).
//
// ⚠️ Unverified against a live AusPost account — see auspostCreateLabel for
// the same caveat. The Track API is the most stable/simple part of AusPost's
// public surface, but confirm the response shape once you have a real key.
import { json, preflight, serviceClient, getCaller } from './shared.ts';

const TRACK_BASE = 'https://digitalapi.auspost.com.au/track.json';

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
    if (!order.tracking_number) return json({ error: 'This order has no tracking number yet' }, 400);

    const key = Deno.env.get('AUSPOST_API_KEY');
    if (!key) return json({ error: 'AusPost is not configured (missing AUSPOST_API_KEY)' }, 503);

    const res = await fetch(`${TRACK_BASE}?tracking_ids=${encodeURIComponent(order.tracking_number)}`, {
      headers: { 'AUTH_KEY': key },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('AusPost track error:', res.status, body);
      return json({ error: 'Unable to fetch tracking status right now' }, 502);
    }
    const data = await res.json();
    const result = data?.tracking_results?.[0];
    const item = result?.trackable_items?.[0];
    const status = item?.status || result?.status || 'Unknown';
    const events = item?.events || [];
    const latestEvent = events[0]?.description || null;
    const isDelivered = /delivered/i.test(status);

    await svc.from('store_orders').update({
      customer_status_note: latestEvent || order.customer_status_note,
      ...(isDelivered && !order.delivered_at ? { delivered_at: new Date().toISOString(), status: 'completed' } : {}),
    }).eq('id', orderId);

    return json({ ok: true, status, latest_event: latestEvent, events });
  } catch (error) {
    console.error('auspostTrack error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
