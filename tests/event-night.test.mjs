import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { formatVegasDate, LAS_VEGAS_TIME_ZONE } from "../src/lib/vegas-time.js";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

/* Event-night critical-path guards. The pure checkout/webhook logic is unit
 * tested in checkout-rules.test.mjs; these guards ensure the DEPLOYED Deno
 * functions still wire that logic in — auto-sync rewrites have silently dropped
 * safeguards on this repo before, and these must not break on match night. */

test("stripeWebhook verifies the Stripe signature (no spoofed payments)", () => {
  const src = read("../base44/functions/stripeWebhook/entry.ts");
  assert.match(src, /constructEventAsync\(\s*body\s*,\s*signature\s*,/, "must verify the webhook signature");
  assert.match(src, /STRIPE_WEBHOOK_SECRET/, "must use the signing secret");
});

test("stripeWebhook is idempotent and amount-verified", () => {
  const src = read("../base44/functions/stripeWebhook/entry.ts");
  // Replay guard: an already-paid order must not re-process / re-decrement stock.
  assert.match(src, /status === 'paid'|payment_verified_at/, "must short-circuit already-paid orders");
  // Tampering guard: paid amount must equal the order total.
  assert.match(src, /amount_total/, "must compare the Stripe amount to the order total");
});

test("createCheckout prices from the server-side product, not the client", () => {
  const src = read("../base44/functions/createCheckout/entry.ts");
  assert.match(src, /asServiceRole\.entities\.Product\.get/, "must re-fetch products server-side");
  assert.match(src, /toMoneyCents\(product\.price_aud\)/, "unit price must come from the stored product");
  assert.match(src, /MAX_CHECKOUT_QUANTITY/, "must cap quantity");
  assert.match(src, /Not enough stock/, "must reject oversell at checkout");
});

test("tipping locks at kickoff (no tips after a game starts)", () => {
  // Source guards: the lock must stay in getStatus AND stay wired to disable the UI.
  const helpers = read("../src/components/forum/tipping/tipHelpers.js");
  assert.match(helpers, /if \(diff < 0\) return \{ label: "Locked"/, "getStatus must return Locked past kickoff");
  const predictor = read("../src/components/forum/ScorePredictor.jsx");
  assert.match(predictor, /timeLocked\s*=\s*status\.label === "Locked"/, "UI must treat Locked as locked");
  assert.match(predictor, /canInteract\s*=\s*!timeLocked/, "tip controls must be disabled once locked");

  // Behavioural replica of the getStatus thresholds.
  const label = (kickoff, apiStatus) => {
    if (apiStatus === "live") return "Live";
    if (apiStatus === "finished") return "Final";
    if (!kickoff) return "Open";
    const diff = new Date(kickoff).getTime() - Date.now();
    if (diff < 0) return "Locked";
    if (diff < 3600000) return "Closing";
    if (diff < 86400000) return "Hot";
    return "Open";
  };
  assert.equal(label(new Date(Date.now() + 3 * 86400000).toISOString()), "Open");
  assert.equal(label(new Date(Date.now() + 30 * 60000).toISOString()), "Closing");
  assert.equal(label(new Date(Date.now() - 60000).toISOString()), "Locked");
  assert.equal(label(new Date().toISOString(), "finished"), "Final");
});

test("countdown clamps to a 'done' state at zero (no negative timer on the night)", () => {
  const src = read("../src/components/public/CountdownTimer.jsx");
  assert.match(src, /if \(diff <= 0\) return \{ done: true/, "getRemaining must clamp at zero");
  // Behavioural replica of the clamp.
  const getRemaining = (target) => {
    const diff = target - Date.now();
    if (diff <= 0) return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
    return { done: false };
  };
  assert.equal(getRemaining(Date.now() - 1000).done, true);
  assert.equal(getRemaining(Date.now() + 60000).done, false);
});

test("Las Vegas times render in Pacific (no manual offset math)", () => {
  assert.equal(LAS_VEGAS_TIME_ZONE, "America/Los_Angeles");
  const formatted = formatVegasDate("2027-03-01");
  assert.match(formatted, /2027/);
  assert.match(formatted, /Mar/);
});
