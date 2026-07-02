// Server-side ad analytics. AdSlot enforces viewability + frequency/click caps
// client-side, then calls this to durably aggregate counts on the site_ads row.
// Body: { adId: string, type: 'impressions' | 'clicks' }
import { json, preflight, serviceClient, num } from './shared.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const { adId, type } = await req.json().catch(() => ({}));
    const id = String(adId || '').trim();

    if (!id) return json({ error: 'adId is required' }, 400);
    if (type !== 'impressions' && type !== 'clicks') {
      return json({ error: 'type must be "impressions" or "clicks"' }, 400);
    }

    const svc = serviceClient();
    const { data: ad } = await svc.from('site_ads').select('*').eq('id', id).maybeSingle();
    if (!ad) return json({ error: 'Ad not found' }, 404);

    const field = type === 'clicks' ? 'click_count' : 'impression_count';
    const next = num(ad[field]) + 1;
    await svc.from('site_ads').update({ [field]: next }).eq('id', id);

    return json({ ok: true, [field]: next });
  } catch (error) {
    console.error('recordAdEvent error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
