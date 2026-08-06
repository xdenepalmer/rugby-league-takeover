// Jersey Swap board writes: create / withdraw / confirm.
//
// Reads never come here — the storefront queries swap_listings_view directly.
// Completion is TWO-sided: each owner names the other's listing, and only the
// reciprocal pair finalises (via the finalize_swap RPC, which flips both
// listings, pays both owners and bumps both swap counts atomically under row
// locks). One side alone proves nothing and pays nothing, so the reward
// cannot be farmed solo.
//
// The linked forum thread is created by the CLIENT through submitForumPost
// first (reusing its auth, rate limits, bans, profanity and media rules),
// then handed here — this function only verifies the thread really is the
// caller's own published top-level post before attaching it.
import { json, preflight, serviceClient, getCaller, trimToLength, safeForumMediaUrl } from './shared.ts';

const MAX_ACTIVE_LISTINGS = 5;
const MAX_WANTS = 6;

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Kids'];
const CONDITIONS = ['New with tags', 'Excellent', 'Good', 'Well-loved'];

const cleanSize = (value: unknown) => {
  const size = trimToLength(value, 8);
  return SIZES.includes(size) ? size : '';
};

const cleanStringArray = (value: unknown, itemLength: number, max: number) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    const item = trimToLength(raw, itemLength);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const input = await req.json().catch(() => ({}));
    const action = trimToLength(input?.action, 20);

    const me = await getCaller(req, svc);
    if (!me) return json({ error: 'Sign in to use the swap board' }, 401);

    // ── create ─────────────────────────────────────────────────────────────
    if (action === 'create') {
      const haveTeam = trimToLength(input?.haveTeam, 48);
      if (!haveTeam) return json({ error: 'Tell us what jersey you have' }, 400);

      const { count } = await svc
        .from('swap_listings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', me.id)
        .eq('status', 'active');
      if ((count ?? 0) >= MAX_ACTIVE_LISTINGS) {
        return json({ error: `You already have ${MAX_ACTIVE_LISTINGS} active listings — complete or withdraw one first`, code: 'listing_cap' }, 400);
      }

      // The thread must be the caller's own live top-level post; anything else
      // (someone else's thread, a reply, an unpublished draft) is refused
      // rather than silently attached.
      let threadId: string | null = null;
      const claimedThread = trimToLength(input?.threadId, 120);
      if (claimedThread) {
        const { data: thread } = await svc
          .from('forum_posts')
          .select('id, user_id, parent_id, is_published, deleted_at')
          .eq('id', claimedThread)
          .maybeSingle();
        if (!thread || thread.user_id !== me.id || thread.parent_id || !thread.is_published || thread.deleted_at) {
          return json({ error: 'That forum thread cannot be linked to this listing' }, 400);
        }
        threadId = thread.id;
      }

      const { data: listing, error: insertError } = await svc
        .from('swap_listings')
        .insert({
          user_id: me.id,
          user_email: me.email || '',
          display_name: trimToLength(me.full_name, 60) || 'RLT Fan',
          have_team: haveTeam,
          have_size: cleanSize(input?.haveSize),
          have_condition: CONDITIONS.includes(trimToLength(input?.haveCondition, 20)) ? trimToLength(input?.haveCondition, 20) : '',
          have_description: trimToLength(input?.haveDescription, 500),
          image_url: safeForumMediaUrl(input?.imageUrl),
          want_teams: cleanStringArray(input?.wantTeams, 48, MAX_WANTS),
          want_sizes: cleanStringArray(input?.wantSizes, 8, MAX_WANTS).filter((size) => SIZES.includes(size)),
          thread_id: threadId,
        })
        .select('id')
        .maybeSingle();
      if (insertError || !listing) {
        console.error('swapBoard create failed:', insertError);
        return json({ error: 'Could not create the listing — try again' }, 500);
      }
      return json({ ok: true, id: listing.id });
    }

    // ── withdraw ───────────────────────────────────────────────────────────
    if (action === 'withdraw') {
      const listingId = trimToLength(input?.listingId, 120);
      if (!listingId) return json({ error: 'A listing is required' }, 400);
      let query = svc
        .from('swap_listings')
        .update({ status: 'withdrawn', updated_date: new Date().toISOString() })
        .eq('id', listingId)
        .eq('status', 'active');
      if (me.role !== 'admin') query = query.eq('user_id', me.id);
      const { data: withdrawn, error: withdrawError } = await query.select('id').maybeSingle();
      if (withdrawError) {
        console.error('swapBoard withdraw failed:', withdrawError);
        return json({ error: 'Could not withdraw the listing — try again' }, 500);
      }
      if (!withdrawn) return json({ error: 'Listing not found, not yours, or no longer active' }, 404);
      return json({ ok: true });
    }

    // ── confirm ────────────────────────────────────────────────────────────
    if (action === 'confirm') {
      const mineId = trimToLength(input?.listingId, 120);
      const theirsId = trimToLength(input?.counterpartListingId, 120);
      if (!mineId || !theirsId) return json({ error: 'Both listings are required' }, 400);
      if (mineId === theirsId) return json({ error: 'A listing cannot swap with itself' }, 400);

      const { data: mine } = await svc
        .from('swap_listings').select('id, user_id, status').eq('id', mineId).maybeSingle();
      if (!mine || mine.user_id !== me.id) return json({ error: 'That listing is not yours' }, 403);
      if (mine.status !== 'active') return json({ error: 'Your listing is no longer active' }, 409);

      const { data: theirs } = await svc
        .from('swap_listings').select('id, user_id, status').eq('id', theirsId).maybeSingle();
      if (!theirs) return json({ error: 'Swap partner listing not found' }, 404);
      if (theirs.user_id === me.id) return json({ error: 'You cannot swap with your own listing' }, 400);
      if (theirs.status !== 'active') return json({ error: 'That listing is no longer active' }, 409);

      // Record my side. The unique pair key makes a repeat click idempotent.
      const { error: confirmError } = await svc
        .from('swap_confirmations')
        .upsert(
          { listing_id: mine.id, counterpart_listing_id: theirs.id, user_id: me.id },
          { onConflict: 'listing_id,counterpart_listing_id', ignoreDuplicates: true },
        );
      if (confirmError) {
        console.error('swapBoard confirm write failed:', confirmError);
        return json({ error: 'Could not record your confirmation — try again' }, 500);
      }

      // Reciprocal side present (and genuinely written by the other owner)?
      const { data: reciprocal } = await svc
        .from('swap_confirmations')
        .select('id')
        .eq('listing_id', theirs.id)
        .eq('counterpart_listing_id', mine.id)
        .eq('user_id', theirs.user_id)
        .maybeSingle();

      if (!reciprocal) {
        return json({ ok: true, state: 'waiting', message: 'Confirmed on your side — the swap completes when your partner confirms too.' });
      }

      const { data: result, error: rpcError } = await svc.rpc('finalize_swap', { p_a: mine.id, p_b: theirs.id });
      if (rpcError) {
        console.error('finalize_swap failed:', rpcError);
        return json({ error: 'Could not complete the swap — try again' }, 500);
      }
      if (!result?.ok) {
        return json({ error: 'This swap can no longer be completed', code: result?.reason || 'not_active' }, 409);
      }
      return json({ ok: true, state: 'completed', reward: { chips: 150, xp: 50, badge: 'jersey_swapper' } });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('swapBoard error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
