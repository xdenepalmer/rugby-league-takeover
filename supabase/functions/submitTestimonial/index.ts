// Public visitors can submit a testimonial; it is created UNPUBLISHED so an
// admin can moderate it before it appears on the homepage.
import { json, preflight, serviceClient, getCaller, trimToLength, isLikelyBot, resolveClientIp, findActiveBan } from './shared.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const input = await req.json();

    if (isLikelyBot(input)) return json({ ok: true });

    const author_name = trimToLength(input?.author_name, 80);
    const quote = trimToLength(input?.quote, 1000);
    if (!author_name) return json({ error: 'Name is required' }, 400);
    if (!quote) return json({ error: 'Testimonial text is required' }, 400);

    const user = await getCaller(req, svc);
    const ip = resolveClientIp(req);
    const ban = await findActiveBan(svc, { ip, emails: [user?.email], userId: user?.id });
    if (ban) {
      return json({ error: 'Your account or connection has been blocked.', code: 'blocked' }, 403);
    }

    let rating = Number(input?.rating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) rating = 0;

    await svc.from('testimonials').insert({
      author_name,
      author_role: trimToLength(input?.author_role, 120),
      quote,
      avatar_url: '',
      rating: Math.round(rating),
      sort_order: 100,
      is_published: false,
      ip_address: ip,
      user_email: user?.email || '',
      user_id: user?.id || '',
    });

    return json({ ok: true });
  } catch (error) {
    console.error('submitTestimonial error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
