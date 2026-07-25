// Cancel a store order (admin-only). Per the shop policy this does NOT issue a
// refund — the admin refunds separately via stripeRefund if money needs to go
// back. It DOES return stock for a paid order (the goods won't ship), guarded
// by restocked_at so a later refund can't double-restock.
//
// Request: { orderId, reason?, restock? }
import { json, preflight, serviceClient, getCaller } from './shared.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const me = await getCaller(req, svc);
    if (!me) return json({ error: 'Sign in required' }, 401);
    if (me.role !== 'admin') return json({ error: 'Admins only' }, 403);

    const { orderId, reason, restock = true } = await req.json().catch(() => ({}));
    const id = String(orderId || '').trim();
    if (!id) return json({ error: 'orderId is required' }, 400);

    const { data: order } = await svc.from('store_orders').select('*').eq('id', id).maybeSingle();
    if (!order) return json({ error: 'Order not found' }, 404);
    if (order.status === 'cancelled') return json({ error: 'Order is already cancelled' }, 400);
    if (order.status === 'refunded') return json({ error: 'A fully refunded order cannot be cancelled' }, 400);

    const wasPaid = ['paid', 'packing', 'shipped', 'completed', 'partially_refunded'].includes(order.status);
    const nowIso = new Date().toISOString();

    // Return stock once — only for a paid order (stock was decremented at
    // payment) that hasn't already been restocked by a refund/cancel.
    let restocked = false;
    if (restock && wasPaid && !order.restocked_at) {
      for (const item of order.line_items || []) {
        if (!item.product_id) continue;
        const { data: product } = await svc.from('products').select('id, stock_quantity').eq('id', item.product_id).maybeSingle();
        if (!product) continue;
        const stock = Number(product.stock_quantity);
        if (!Number.isFinite(stock)) continue; // untracked stock
        const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        await svc.from('products').update({ stock_quantity: Math.max(0, Math.floor(stock) + qty) }).eq('id', product.id);
      }
      restocked = true;
    }

    const timeline = [
      ...(Array.isArray(order.timeline) ? order.timeline : []),
      {
        action: 'cancelled',
        timestamp: nowIso,
        actor: me.email || 'admin',
        note: `Order cancelled${reason ? ` — ${reason}` : ''}${restocked ? ' · items restocked' : ''}` +
          (wasPaid ? ' · paid order: issue a refund separately if money is owed' : ''),
      },
    ];

    await svc.from('store_orders').update({
      status: 'cancelled',
      cancelled_at: nowIso,
      cancel_reason: reason || '',
      ...(restocked ? { restocked_at: nowIso } : {}),
      timeline,
    }).eq('id', id);

    return json({ ok: true, restocked, wasPaid });
  } catch (error) {
    console.error('cancelOrder error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
