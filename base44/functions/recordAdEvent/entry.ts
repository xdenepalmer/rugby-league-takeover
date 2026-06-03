import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';

// Server-side ad analytics. AdSlot enforces viewability + frequency/click caps
// client-side, then calls this to durably aggregate counts on the SiteAd record
// via service role access.
//
// Body: { adId: string, type: 'impressions' | 'clicks' }

Deno.serve(async (req) => {
  try {
    const { adId, type } = await req.json().catch(() => ({}));

    const id = String(adId || '').trim();

    if (!id) {
      return Response.json({ error: 'adId is required' }, { status: 400 });
    }

    if (type !== 'impressions' && type !== 'clicks') {
      return Response.json(
        { error: 'type must be "impressions" or "clicks"' },
        { status: 400 }
      );
    }

    const base44 = createClientFromRequest(req);

    const ad = await base44.asServiceRole.entities.SiteAd.get(id).catch(() => null);

    if (!ad) {
      return Response.json({ error: 'Ad not found' }, { status: 404 });
    }

    const field = type === 'clicks' ? 'click_count' : 'impression_count';
    const next = Number(ad[field] || 0) + 1;

    await base44.asServiceRole.entities.SiteAd.update(id, {
      [field]: next
    });

    return Response.json({
      ok: true,
      [field]: next
    });
  } catch (error) {
    console.error('recordAdEvent error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});