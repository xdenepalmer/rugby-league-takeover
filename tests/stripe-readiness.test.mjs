import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

/* ── RLT-STRIPE-001: platform readiness for live Stripe operation ─────────
   Static contracts on the edge functions + admin wiring, so a refactor can't
   silently drop a lifecycle event, an auth gate, or the honest-labeling rules
   the 003O review locked in. The behavioural rules themselves are unit-tested
   via tests/checkout-rules.mjs (the canonical copies). */

test("stripeWebhook handles the full checkout + refund lifecycle", () => {
  const src = read("../supabase/functions/stripeWebhook/index.ts");
  for (const eventType of [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
    "charge.refunded",
  ]) {
    assert.ok(src.includes(`'${eventType}'`), `webhook must handle ${eventType}`);
  }
  // Async settling is acknowledged, never 400d — a non-2xx would make Stripe
  // retry a healthy event for days and flag the endpoint unhealthy.
  assert.match(src, /outcome === 'pending'[\s\S]*?received: true, pending: true/, "unpaid-but-valid sessions are acked as pending");
  // Late/duplicate events can't clobber paid state.
  assert.match(src, /order\.status \|\| 'pending'\) !== 'pending' \|\| order\.payment_verified_at/, "expiry/failure only ever touches a still-pending order");
  assert.match(src, /stripe_payment_intent_id/, "paid orders record their payment intent for refunds");
  assert.match(src, /getStripeWebhookSecrets\(\)/, "verifies against every configured signing secret (test+live coexistence)");
  assert.match(src, /amount_refunded/, "charge.refunded reconciles the cumulative refunded amount");
});

test("stripeRefund is admin-gated, idempotent, and never leaks raw errors", () => {
  const src = read("../supabase/functions/stripeRefund/index.ts");
  assert.match(src, /caller\.role !== 'admin'/, "server-side admin check");
  assert.match(src, /Admin access required/, "403 for non-admins");
  assert.match(src, /idempotencyKey: `rlt-refund-\$\{order\.id\}-\$\{check\.amountCents\}`/, "order+amount idempotency key — a double-click can never double-refund");
  assert.match(src, /reason: 'requested_by_customer'/, "refunds carry a Stripe reason code");
  assert.match(src, /no_stripe_payment/, "orders without a Stripe payment signal the record-only fallback");
  assert.match(src, /console\.error\('stripeRefund/, "raw errors are logged server-side");
  assert.doesNotMatch(src, /json\(\{ error: \(error as Error\)\.message/, "raw error messages must never be echoed to the client");
  // The money-moved-but-record-failed case must be surfaced, not swallowed.
  assert.match(src, /warning/, "a post-refund record failure warns the admin explicitly");
});

test("refund validation matches between the server and the shared UI helper", () => {
  const serverSrc = read("../supabase/functions/stripeRefund/index.ts");
  const canonical = read("./checkout-rules.mjs");
  // Both round to cents FIRST (the 003O rule), then bound the value.
  for (const src of [serverSrc, canonical]) {
    assert.match(src, /Number\(raw\.toFixed\(2\)\)/, "cents-first rounding");
    assert.match(src, /< 0\.01/, "must refund at least one cent");
  }
  assert.match(serverSrc, /remaining/, "server caps at the remaining refundable balance");
});

test("orders schema carries the payment intent binding (migration 0011)", () => {
  const migration = read("../supabase/migrations/0011_store_orders_payment_intent.sql");
  assert.match(migration, /add column if not exists stripe_payment_intent_id text/, "column added");
  assert.match(migration, /create unique index if not exists store_orders_stripe_payment_intent_idx/, "unique partial index for charge.refunded reconciliation");
  assert.match(migration, /where stripe_payment_intent_id is not null/, "index is partial (nulls exempt)");
});

test("both admin surfaces issue real Stripe refunds, keeping record-only as the honest fallback", () => {
  const web = read("../src/components/admin/OrdersManager.jsx");
  const native = read("../src/native/admin/workflows/NativeOrdersWorkflow.jsx");
  for (const [name, src] of [["web", web], ["native", native]]) {
    assert.match(src, /functions\.invoke\("stripeRefund"/, `${name} surface calls the stripeRefund function`);
    assert.match(src, /canStripeRefundOrder/, `${name} surface picks the path from what the order carries`);
    assert.match(src, /no_stripe_payment/, `${name} surface falls back to record-only when the server says there is no Stripe payment`);
  }
  // The record-only path still writes the honest "no money moved here" trail.
  assert.match(web, /Issue the Stripe refund separately/, "web record-only trail stays honest");
  const helpers = read("../src/native/admin/workflows/workflow-helpers.js");
  assert.match(helpers, /Issue the Stripe refund separately/, "shared record-only payload stays honest");
});

test("the go-live runbook lists every webhook event the endpoint handles", () => {
  const doc = read("../docs/STRIPE_GO_LIVE.md");
  for (const eventType of [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
    "charge.refunded",
  ]) {
    assert.ok(doc.includes(eventType), `runbook must tell the operator to subscribe ${eventType}`);
  }
  assert.match(doc, /functions\/v1\/stripeWebhook/, "runbook names the exact endpoint URL");
  assert.match(doc, /STRIPE_MODE/, "runbook covers the test/live toggle");
});
