// Apple / Google Wallet membership passes.
//
// STATUS: this function is fully wired but INERT until the club provisions
// wallet credentials. `action: 'status'` reports which wallets are available
// so the app can hide buttons it cannot honour — a dead "Add to Apple Wallet"
// button is a promise the app can't keep.
//
// Google Wallet needs (set as Edge Function secrets):
//   GOOGLE_WALLET_ISSUER_ID          numeric issuer id from the Google Pay & Wallet Console
//   GOOGLE_WALLET_SA_EMAIL           service-account email with Wallet issuer access
//   GOOGLE_WALLET_SA_PRIVATE_KEY     that service account's PEM private key
//   GOOGLE_WALLET_CLASS_ID           the generic class created for RLT membership
//
// Apple Wallet needs a Pass Type ID certificate and its private key, and a
// .pkpass is a ZIP carrying a detached PKCS#7/CMS signature. Deno's WebCrypto
// can hash and sign but cannot assemble a CMS SignedData structure, so Apple
// support is deliberately reported as unavailable rather than half-built
// against an API shape nobody has verified on-device.
import { json, preflight, serviceClient, getCaller, trimToLength } from './shared.ts';

const encoder = new TextEncoder();

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64urlText = (text: string) => b64url(encoder.encode(text));

const env = (name: string) => (Deno.env.get(name) || '').trim();

function googleConfig() {
  const issuerId = env('GOOGLE_WALLET_ISSUER_ID');
  const email = env('GOOGLE_WALLET_SA_EMAIL');
  const key = env('GOOGLE_WALLET_SA_PRIVATE_KEY');
  const classId = env('GOOGLE_WALLET_CLASS_ID');
  return issuerId && email && key && classId ? { issuerId, email, key, classId } : null;
}

// Apple is considered configured only when BOTH the identifiers and the
// signing material are present.
function appleConfigured() {
  return !!(env('APPLE_PASS_TYPE_ID') && env('APPLE_TEAM_ID') && env('APPLE_PASS_CERT_P12'));
}

function pemToBytes(pem: string) {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

async function signRs256(payload: string, privateKeyPem: string) {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(payload));
  return b64url(new Uint8Array(sig));
}

const isActive = (expiresAt: string | null) =>
  !!expiresAt && new Date(expiresAt).getTime() > Date.now();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const input = await req.json().catch(() => ({}));
    const action = trimToLength(input?.action, 20) || 'status';
    const google = googleConfig();

    if (action === 'status') {
      return json({ ok: true, apple: appleConfigured(), google: !!google });
    }

    if (action !== 'issue') return json({ error: 'Unknown action' }, 400);

    const me = await getCaller(req, svc);
    if (!me) return json({ error: 'Sign in required' }, 401);

    const { data: profile } = await svc
      .from('profiles')
      .select('id, full_name, membership_number, membership_expires_at')
      .eq('id', me.id)
      .maybeSingle();
    if (!profile || !isActive(profile.membership_expires_at)) {
      return json({ error: 'No active membership', code: 'not_a_member' }, 403);
    }

    const wallet = trimToLength(input?.wallet, 10);

    if (wallet === 'apple') {
      return json({
        error: 'Apple Wallet passes are not provisioned yet.',
        code: 'apple_unconfigured',
      }, 501);
    }

    if (wallet === 'google') {
      if (!google) {
        return json({ error: 'Google Wallet is not provisioned yet.', code: 'google_unconfigured' }, 501);
      }
      // A member-number barcode, not a session token: a wallet pass is stored
      // for a year and cannot be re-signed each time it's shown, so the
      // scannable value has to be stable. Staff verification always re-reads
      // membership from the database, so a stale pass on a lapsed member
      // fails the check at the bar.
      const memberNumber = String(profile.membership_number || '').trim();
      const objectId = `${google.issuerId}.rlt-${profile.id}`.replace(/[^a-zA-Z0-9._-]/g, '');
      const expiry = new Date(profile.membership_expires_at as string).toISOString();

      const genericObject = {
        id: objectId,
        classId: google.classId,
        genericType: 'GENERIC_MEMBERSHIP',
        state: 'ACTIVE',
        cardTitle: { defaultValue: { language: 'en-AU', value: 'Rugby League Takeover' } },
        header: { defaultValue: { language: 'en-AU', value: profile.full_name || 'RLT Member' } },
        subheader: { defaultValue: { language: 'en-AU', value: 'Member' } },
        barcode: { type: 'QR_CODE', value: memberNumber, alternateText: memberNumber },
        hexBackgroundColor: '#0b0b0f',
        validTimeInterval: { end: { date: expiry } },
        textModulesData: [
          { id: 'member_number', header: 'Member No.', body: memberNumber },
          { id: 'valid_until', header: 'Valid until', body: expiry.slice(0, 10) },
        ],
      };

      const header = b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
      const claims = b64urlText(JSON.stringify({
        iss: google.email,
        aud: 'google',
        typ: 'savetowallet',
        iat: Math.floor(Date.now() / 1000),
        origins: [env('PUBLIC_SITE_ORIGIN') || 'https://www.rugbyleaguetakeover.com'],
        payload: { genericObjects: [genericObject] },
      }));
      const signature = await signRs256(`${header}.${claims}`, google.key);

      return json({
        ok: true,
        wallet: 'google',
        url: `https://pay.google.com/gp/v/save/${header}.${claims}.${signature}`,
      });
    }

    return json({ error: 'Unknown wallet' }, 400);
  } catch (error) {
    console.error('membershipPass error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
