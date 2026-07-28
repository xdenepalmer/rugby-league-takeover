import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("checkout creation is server-priced, bounded, idempotent, and verifies variants", async () => {
  const source = await read("supabase/functions/createCheckout/index.ts");
  assert.match(source, /claim_checkout_attempt/);
  assert.match(source, /checkoutRequestId/);
  assert.match(source, /idempotencyKey/);
  assert.match(source, /client_reference_id/);
  assert.match(source, /\{CHECKOUT_SESSION_ID\}/);
  assert.match(source, /variant\.stock_quantity < item\.quantity/);
  assert.match(source, /CHECKOUT_SESSION_SECONDS = 30 \* 60/);
  assert.match(source, /sessionId:\s*(?:existingSession|session)\.id/);
  assert.doesNotMatch(source, /Access-Control-Allow-Origin['"]:\s*['"]\*/);
});

test("webhook verifies paid sessions and atomically reconciles lifecycle events", async () => {
  const source = await read("supabase/functions/stripeWebhook/index.ts");
  assert.match(source, /constructEventAsync/);
  assert.match(source, /process_store_order_payment/);
  assert.match(source, /checkout\.session\.async_payment_succeeded/);
  assert.match(source, /checkout\.session\.async_payment_failed/);
  assert.match(source, /checkout\.session\.expired/);
  assert.match(source, /refund\.updated/);
  assert.match(source, /charge\.refunded/);
  assert.match(source, /Boolean\(session\.livemode\) !== expectedLiveMode/);
});

test("refund command performs an authenticated Stripe refund", async () => {
  const source = await read("supabase/functions/refundOrder/index.ts");
  assert.match(source, /caller\.role !== 'admin'/);
  assert.match(source, /stripe\.refunds\.create/);
  assert.match(source, /idempotencyKey/);
  assert.match(source, /finalize_store_order_refund/);
});

test("database hardening protects money fields and private site settings", async () => {
  const source = await read("supabase/migrations/0010_store_payments_hardening.sql");
  const fulfilmentGuard = await read("supabase/migrations/0013_store_fulfilment_address_guard.sql");
  assert.match(source, /create or replace function public\.process_store_order_payment/);
  assert.match(source, /for update/);
  assert.match(source, /create trigger store_orders_protect_integrity/);
  assert.match(source, /create or replace view public\.site_settings_view/);
  assert.match(source, /revoke all on table public\.checkout_rate_limits/);
  assert.match(fulfilmentGuard, /A usable Australian shipping address is required before shipping/);
  assert.match(fulfilmentGuard, /shipping_country[\s\S]*'AU'/);
});

test("store verifies the returned session before clearing the cart", async () => {
  const source = await read("src/pages/Store.jsx");
  assert.match(source, /functions\.invoke\("checkoutStatus"/);
  assert.match(source, /if \(!isVerifiedPaid\) return/);
  assert.match(source, /checkoutRequestId: crypto\.randomUUID\(\)/);
  assert.match(source, /\["success", "processing"\]\.includes\(checkoutReturn\)/);
  assert.match(source, /setSearchParams\(\{ checkout: "processing", session_id: returnedSessionId \}\)/);
  assert.doesNotMatch(source, /searchParams\.get\("success"\) === "true"/);
});

test("checkout creation returns the Stripe session ID for native verification", async () => {
  const source = await read("supabase/functions/createCheckout/index.ts");
  assert.match(source, /sessionId:\s*session\.id/);
});

test("iOS universal links include both production hostnames", async () => {
  const source = await read("ios/App/App/App.entitlements");
  assert.match(source, /applinks:rugbyleaguetakeover\.com/);
  assert.match(source, /applinks:www\.rugbyleaguetakeover\.com/);
});

test("cart items can be removed directly or by decrementing the last unit", async () => {
  const source = await read("src/pages/Store.jsx");
  assert.match(source, /change < 0 && item\.quantity <= 1/);
  assert.match(source, /String\(item\.cartItemId \|\| ""\) !== normalizedCartItemId/);
  assert.match(source, /Remove \$\{item\.name\} from cart/);
});

test("admin refunds use the server workflow instead of directly changing payment state", async () => {
  const source = await read("src/components/admin/OrdersManager.jsx");
  assert.match(source, /functions\.invoke\("refundOrder"/);
  assert.doesNotMatch(source, /status:\s*"refunded"/);
  assert.match(source, /Tracking links must be a full HTTPS URL/);
  assert.match(source, /Shipping address required/);
  assert.match(source, /!hasShippingAddress/);
});
