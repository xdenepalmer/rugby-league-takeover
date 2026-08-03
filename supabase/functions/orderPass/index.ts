// Collection passes for orders picked up at the Las Vegas event.
//
// AusPost is domestic-only, so every overseas order is collected in person.
// This issues the buyer a wallet pass and lets staff redeem it at the stand.
//
// Wallet credentials are the same ones membershipPass uses — see that function
// for the full list. Google Wallet additionally needs its own class for
// collection passes:
//   GOOGLE_WALLET_ORDER_CLASS_ID   (falls back to GOOGLE_WALLET_CLASS_ID)
//
// Apple is reported unavailable until a Pass Type ID certificate is provisioned.
// A .pkpass is a ZIP carrying a detached PKCS#7/CMS signature, which Deno's
// WebCrypto cannot assemble; shipping a half-built one would mean a button that
// fails on the day, at the stand, in front of a queue. Status reporting lets the
// app hide what it cannot honour.
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
  const classId = env('GOOGLE_WALLET_ORDER_CLASS_ID') || env('GOOGLE_WALLET_CLASS_ID');
  return issuerId && email && key && classId ? { issuerId, email, key, classId } : null;
}

const appleConfigured = () =>
  !!(env('APPLE_PASS_TYPE_ID') && env('APPLE_TEAM_ID') && env('APPLE_PASS_CERT_P12'));

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

// Crockford-ish base32: no I/L/O/U, so a code read aloud or typed by hand at a
// noisy stand doesn't collide on look-alike characters.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function newSerial() {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `RLT-${body.slice(0, 5)}-${body.slice(5, 10)}`;
}

const summarise = (order: Record<string, unknown>) => ({
  id: order.id,
  serial: order.pass_serial,
  customerName: order.customer_name,
  customerEmail: order.customer_email,
  totalAud: order.total_aud,
  status: order.status,
  lineItems: order.line_items,
  redeemedAt: order.pass_redeemed_at,
  redeemedBy: order.pass_redeemed_by,
});

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

    const me = await getCaller(req, svc);
    if (!me) return json({ error: 'Sign in required' }, 401);

    // ── Redeem: staff only ─────────────────────────────────────────────────
    if (action === 'redeem') {
      if (me.role !== 'admin') return json({ error: 'Admins only' }, 403);
      const serial = trimToLength(input?.serial, 40).toUpperCase();
      if (!serial) return json({ error: 'A pass code is required' }, 400);

      const { data: order } = await svc
        .from('store_orders')
        .select('id, customer_name, customer_email, total_aud, status, line_items, pass_serial, pass_redeemed_at, pass_redeemed_by, fulfilment_method')
        .eq('pass_serial', serial)
        .maybeSingle();
      if (!order) return json({ error: 'No order matches that pass', code: 'not_found' }, 404);

      // Already used: report it rather than silently succeeding, so a duplicated
      // or screenshotted pass is caught at the stand.
      if (order.pass_redeemed_at) {
        return json({
          error: 'This pass has already been collected',
          code: 'already_redeemed',
          order: summarise(order),
        }, 409);
      }
      if (!['paid', 'packing', 'shipped', 'completed'].includes(String(order.status))) {
        return json({
          error: `This order is ${order.status} — not ready to collect`,
          code: 'not_collectable',
          order: summarise(order),
        }, 409);
      }

      // Guarded update: only claims the row if it is STILL unredeemed, so two
      // staff scanning at once cannot both succeed.
      const { data: claimed, error: claimError } = await svc
        .from('store_orders')
        .update({
          pass_redeemed_at: new Date().toISOString(),
          pass_redeemed_by: me.email || me.id,
          status: 'completed',
        })
        .eq('id', order.id)
        .is('pass_redeemed_at', null)
        .select('id, customer_name, customer_email, total_aud, status, line_items, pass_serial, pass_redeemed_at, pass_redeemed_by')
        .maybeSingle();

      if (claimError) {
        console.error('orderPass redeem write failed:', claimError);
        return json({ error: 'Could not record the collection — try again' }, 500);
      }
      if (!claimed) {
        return json({ error: 'This pass has already been collected', code: 'already_redeemed' }, 409);
      }
      return json({ ok: true, order: summarise(claimed) });
    }

    if (action !== 'issue') return json({ error: 'Unknown action' }, 400);

    // ── Issue: the buyer's own order only ──────────────────────────────────
    const orderId = trimToLength(input?.orderId, 64);
    if (!orderId) return json({ error: 'An order is required' }, 400);

    const { data: order } = await svc
      .from('store_orders')
      .select('id, user_id, user_email, customer_email, customer_name, total_aud, status, fulfilment_method, pass_serial, pass_redeemed_at')
      .eq('id', orderId)
      .maybeSingle();
    if (!order) return json({ error: 'Order not found' }, 404);

    const owns = (order.user_id && order.user_id === me.id)
      || (order.user_email && order.user_email.toLowerCase() === String(me.email || '').toLowerCase())
      || (order.customer_email && order.customer_email.toLowerCase() === String(me.email || '').toLowerCase());
    if (!owns && me.role !== 'admin') return json({ error: 'Not your order' }, 403);

    if (order.fulfilment_method !== 'pickup') {
      return json({ error: 'This order is being shipped, not collected', code: 'not_pickup' }, 400);
    }
    if (!['paid', 'packing', 'shipped', 'completed'].includes(String(order.status))) {
      return json({ error: 'This order is not paid yet', code: 'unpaid' }, 400);
    }

    // Generate once and reuse. Re-issuing must return the SAME code, or a buyer
    // who adds the pass to both phones ends up with two barcodes and staff can
    // only redeem one of them.
    let serial = String(order.pass_serial || '');
    if (!serial) {
      serial = newSerial();
      const { error: serialError } = await svc
        .from('store_orders')
        .update({ pass_serial: serial })
        .eq('id', order.id)
        .is('pass_serial', null);
      if (serialError) {
        console.error('orderPass serial write failed:', serialError);
        return json({ error: 'Could not prepare the pass — try again' }, 500);
      }
      // Re-read: if another request won the race its serial is the real one.
      const { data: fresh } = await svc
        .from('store_orders').select('pass_serial').eq('id', order.id).maybeSingle();
      serial = String(fresh?.pass_serial || serial);
    }

    const wallet = trimToLength(input?.wallet, 10);

    if (wallet === 'apple') {
      return json({ error: 'Apple Wallet passes are not provisioned yet.', code: 'apple_unconfigured' }, 501);
    }

    if (wallet === 'google') {
      if (!google) {
        return json({ error: 'Google Wallet is not provisioned yet.', code: 'google_unconfigured' }, 501);
      }
      const objectId = `${google.issuerId}.rltorder-${order.id}`.replace(/[^a-zA-Z0-9._-]/g, '');
      const { data: settings } = await svc
        .from('site_settings')
        .select('pickup_label, pickup_instructions')
        .order('updated_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const genericObject = {
        id: objectId,
        classId: google.classId,
        genericType: 'GENERIC_TYPE_UNSPECIFIED',
        state: 'ACTIVE',
        cardTitle: { defaultValue: { language: 'en-AU', value: 'Rugby League Takeover' } },
        header: { defaultValue: { language: 'en-AU', value: 'Order collection' } },
        subheader: { defaultValue: { language: 'en-AU', value: order.customer_name || 'Collect at the event' } },
        barcode: { type: 'QR_CODE', value: serial, alternateText: serial },
        hexBackgroundColor: '#0b0b0f',
        textModulesData: [
          { id: 'pass_code', header: 'Pass code', body: serial },
          { id: 'order_total', header: 'Order total', body: `A$${Number(order.total_aud || 0).toFixed(2)}` },
          {
            id: 'where',
            header: 'Where',
            body: trimToLength(settings?.pickup_instructions || settings?.pickup_label || 'Collect at the RLT stand', 500),
          },
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
        serial,
        url: `https://pay.google.com/gp/v/save/${header}.${claims}.${signature}`,
      });
    }

    // No wallet requested — hand back the code so the buyer can still show it.
    return json({ ok: true, serial });
  } catch (error) {
    console.error('orderPass error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
