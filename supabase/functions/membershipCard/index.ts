// Membership card: issue the signed payload a member shows at the bar, and
// verify one that's been scanned.
//
// The card's QR carries a SHORT-LIVED SIGNED TOKEN, not a bare member number.
// A bare number is trivially copied off a photo of someone else's card and
// stays valid forever; a token that expires and is signed with a server secret
// can be checked offline-ish by staff and can't be forged or replayed for long.
// Membership itself is always re-read from the database at verify time, so a
// refunded or revoked member fails the check immediately regardless of what
// their phone is showing.
//
// Actions:
//   issue  — (member, authenticated) mint a token for MY card
//   verify — (staff: admin/moderator) check a scanned token
import { json, preflight, serviceClient, getCaller, trimToLength } from './shared.ts';

// Long enough to walk from the door to the bar with a screenshot-proof margin,
// short enough that a photographed code is useless by the time it's shared.
const TOKEN_TTL_SECONDS = 15 * 60;

const encoder = new TextEncoder();

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromB64url = (value: string) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

function cardSecret() {
  // Falls back to the service-role key so the feature works before a dedicated
  // secret is configured — it is server-only and never leaves the function.
  const secret = Deno.env.get('MEMBERSHIP_CARD_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) throw new Error('Membership cards are not configured');
  return secret;
}

async function hmac(payload: string) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(cardSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return b64url(new Uint8Array(sig));
}

// Constant-time compare — a length-sensitive early return leaks signature
// bytes to anyone willing to time the endpoint.
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const isActive = (expiresAt: string | null) =>
  !!expiresAt && new Date(expiresAt).getTime() > Date.now();

async function issueToken(profileId: string, memberNumber: string) {
  const body = b64url(encoder.encode(JSON.stringify({
    v: 1,
    id: profileId,
    n: memberNumber,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  })));
  return `${body}.${await hmac(body)}`;
}

async function readToken(token: string) {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature) return { error: 'Not an RLT membership code' };
  if (!safeEqual(signature, await hmac(body))) return { error: 'This code has been altered' };
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromB64url(body)));
  } catch {
    return { error: 'Not an RLT membership code' };
  }
  if (!payload?.id) return { error: 'Not an RLT membership code' };
  if (Number(payload.exp) * 1000 <= Date.now()) {
    return { error: 'This code has expired — ask them to refresh their card' };
  }
  return { payload };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const input = await req.json().catch(() => ({}));
    const action = trimToLength(input?.action, 20) || 'issue';
    const me = await getCaller(req, svc);
    if (!me) return json({ error: 'Sign in required' }, 401);

    if (action === 'issue') {
      const { data: profile } = await svc
        .from('profiles')
        .select('id, full_name, membership_number, membership_started_at, membership_expires_at')
        .eq('id', me.id)
        .maybeSingle();
      if (!profile) return json({ error: 'Profile not found' }, 404);
      if (!isActive(profile.membership_expires_at)) {
        return json({ error: 'No active membership', code: 'not_a_member' }, 403);
      }
      // A member who predates the number allocator (or an admin comp) may not
      // have one yet — mint it on first card view rather than failing.
      let memberNumber = String(profile.membership_number || '').trim();
      if (!memberNumber) {
        // ensure_membership_number, NOT grant_membership — the latter clamps
        // months to a minimum of 1 and would quietly extend their term.
        const { data: assigned } = await svc.rpc('ensure_membership_number', { p_profile_id: profile.id });
        memberNumber = String(assigned || '').trim();
      }
      return json({
        ok: true,
        token: await issueToken(profile.id, memberNumber),
        expires_in: TOKEN_TTL_SECONDS,
        member: {
          name: profile.full_name || 'RLT Member',
          number: memberNumber,
          started_at: profile.membership_started_at,
          expires_at: profile.membership_expires_at,
        },
      });
    }

    if (action === 'verify') {
      // Bar-side check. Staff only — this reveals whether a given person is a
      // paying member, which is not public information about them.
      if (me.role !== 'admin' && me.role !== 'moderator') {
        return json({ error: 'Staff only' }, 403);
      }
      // Two ways in: a scanned token, or a member number typed by hand when a
      // code won't scan. Both resolve to the same live database check.
      const memberNumber = trimToLength(input?.number, 40).toUpperCase();
      let profileId = '';
      if (memberNumber) {
        const { data: byNumber } = await svc
          .from('profiles')
          .select('id')
          .eq('membership_number', memberNumber)
          .maybeSingle();
        if (!byNumber) return json({ ok: true, valid: false, reason: 'No member with that number' });
        profileId = byNumber.id;
      } else {
        const { payload, error } = await readToken(trimToLength(input?.token, 2000));
        if (error) return json({ ok: true, valid: false, reason: error });
        profileId = payload.id;
      }

      // The token proves WHO, never WHETHER — membership is re-read live so a
      // revoked or refunded card stops working the moment it's revoked.
      const { data: profile } = await svc
        .from('profiles')
        .select('id, full_name, membership_number, membership_expires_at, disabled')
        .eq('id', profileId)
        .maybeSingle();
      if (!profile || profile.disabled) {
        return json({ ok: true, valid: false, reason: 'No such member' });
      }
      if (!isActive(profile.membership_expires_at)) {
        return json({
          ok: true,
          valid: false,
          reason: 'Membership expired',
          member: { name: profile.full_name, number: profile.membership_number, expires_at: profile.membership_expires_at },
        });
      }
      return json({
        ok: true,
        valid: true,
        member: {
          name: profile.full_name || 'RLT Member',
          number: profile.membership_number,
          expires_at: profile.membership_expires_at,
        },
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('membershipCard error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
