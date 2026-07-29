import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  requiredParcelSize,
  serviceParcelSize,
  allowedServices,
  isServiceAllowed,
  normalizeParcelSize,
} from "./parcel-rules.mjs";

// Reproduces the checkout screenshot: one small item, and AusPost offering
// Medium/Large boxes and satchels alongside the correct Parcel Post price.
const REAL_QUOTE = [
  { code: "AUS_PARCEL_REGULAR", name: "Parcel Post", price_aud: 11.7 },
  { code: "AUS_PARCEL_EXPRESS", name: "Express Post", price_aud: 15.2 },
  { code: "AUS_PARCEL_REGULAR_MEDIUM", name: "Medium", price_aud: 16.0 },
  { code: "AUS_PARCEL_EXPRESS_MEDIUM", name: "Medium", price_aud: 20.0 },
  { code: "AUS_PARCEL_REGULAR_LARGE", name: "Large", price_aud: 20.7 },
  { code: "AUS_PARCEL_REGULAR_SATCHEL_MEDIUM", name: "Medium satchel", price_aud: 20.7 },
  { code: "AUS_PARCEL_EXPRESS_LARGE", name: "Large", price_aud: 25.2 },
  { code: "AUS_PARCEL_EXPRESS_SATCHEL_MEDIUM", name: "Medium satchel", price_aud: 25.2 },
];

test("a satchel-sized cart is never offered a box", () => {
  const kept = allowedServices(REAL_QUOTE, "satchel");
  assert.deepEqual(kept.map((s) => s.name), ["Parcel Post", "Express Post"]);
  // The $25.20 Large that prompted this change is gone.
  assert.ok(!kept.some((s) => s.price_aud === 25.2));
});

test("a medium cart keeps medium options but not large ones", () => {
  const kept = allowedServices(REAL_QUOTE, "medium");
  assert.ok(kept.some((s) => s.name === "Medium"), "medium must survive");
  assert.ok(kept.some((s) => s.name === "Medium satchel"), "medium satchel must survive");
  assert.ok(!kept.some((s) => s.name === "Large"), "large must be filtered out");
});

test("a large cart keeps everything", () => {
  assert.equal(allowedServices(REAL_QUOTE, "large").length, REAL_QUOTE.length);
});

test("weight-priced services are never filtered away", () => {
  // Even if a cart somehow has no matching flat rate, the customer must still
  // have something to choose.
  const kept = allowedServices(REAL_QUOTE, "satchel");
  assert.ok(kept.length >= 2, "calculated services always remain");
  assert.equal(serviceParcelSize({ code: "AUS_PARCEL_REGULAR", name: "Parcel Post" }), null);
});

test("the cart takes the largest item's size, not the first or the average", () => {
  assert.equal(requiredParcelSize([{ parcel_size: "satchel" }, { parcel_size: "large" }]), "large");
  assert.equal(requiredParcelSize([{ parcel_size: "medium" }, { parcel_size: "small" }]), "medium");
  assert.equal(requiredParcelSize([]), "satchel");
});

test("missing or junk sizes fall back to satchel rather than large", () => {
  // Failing open to "large" would reintroduce the expensive options for every
  // product that predates this column.
  assert.equal(normalizeParcelSize(undefined), "satchel");
  assert.equal(normalizeParcelSize("HUGE"), "satchel");
  assert.equal(requiredParcelSize([{ parcel_size: null }, {}]), "satchel");
});

test("'extra large' is not mistaken for 'large'", () => {
  assert.equal(serviceParcelSize({ code: "X", name: "Extra Large satchel" }), "large");
});

test("a hand-crafted request cannot select a filtered-out service", () => {
  // The UI hides the Large option; this is the server-side half of that rule.
  assert.equal(isServiceAllowed("AUS_PARCEL_EXPRESS_LARGE", REAL_QUOTE, "satchel"), false);
  assert.equal(isServiceAllowed("AUS_PARCEL_REGULAR", REAL_QUOTE, "satchel"), true);
  assert.equal(isServiceAllowed("", REAL_QUOTE, "large"), false);
});

// ── Mirror check ────────────────────────────────────────────────────────
test("the edge functions carry the same rules as this module", () => {
  const legacyRates = readFileSync(new URL("../supabase/functions/auspostRates/index.ts", import.meta.url), "utf8");
  const checkout = readFileSync(new URL("../supabase/functions/createCheckout/index.ts", import.meta.url), "utf8");
  assert.ok(legacyRates.includes("PARCEL_RANK"), "the retained legacy rate function still classifies parcels");
  assert.ok(!checkout.includes("auspostRates"), "active checkout must not call the legacy carrier-rate function");
  assert.ok(!checkout.includes("serviceParcelSize"), "flat shipping does not accept client-selected parcel services");
  assert.ok(checkout.includes("FLAT_DOMESTIC_SHIPPING_CENTS = 1_500"), "active checkout charges the $15 policy");
  assert.ok(checkout.includes("FREE_DOMESTIC_SHIPPING_THRESHOLD_CENTS = 15_000"), "active checkout enforces free shipping at $150");
});

// ── Non-shippable stock + the placeholder weight ────────────────────────
test("a digital-only cart is never charged postage", () => {
  const rates = readFileSync(new URL("../supabase/functions/auspostRates/index.ts", import.meta.url), "utf8");
  const checkout = readFileSync(new URL("../supabase/functions/createCheckout/index.ts", import.meta.url), "utf8");
  const store = readFileSync(new URL("../src/pages/Store.jsx", import.meta.url), "utf8");

  assert.ok(rates.includes("shipping_required === false"), "rate calc must skip non-shippable items");
  assert.ok(rates.includes("shippingRequired: false"), "must tell the cart there is no parcel");
  // Enforced server-side too: the client decides what to show, the server
  // decides what is charged.
  assert.ok(checkout.includes("requiresShipping"), "checkout must re-derive this from saved products");
  assert.ok(checkout.includes("fulfilment.method === 'shipping'"), "no-parcel orders must skip postage and address collection");
  assert.ok(store.includes("cartNeedsShipping"), "storefront must hide the shipping block");
});

test("weight is per-unit and the placeholder is surfaced, not hidden", () => {
  const rates = readFileSync(new URL("../supabase/functions/auspostRates/index.ts", import.meta.url), "utf8");
  // The bug: `weight_grams || 300` silently invented 300g per unit, so two ~40g
  // stubbie coolers declared 600g and crossed AusPost's 500g bracket — $11.70
  // became $16.00. The assumption stays (checkout must not hard-fail) but it is
  // now named, logged, and flagged rather than applied invisibly.
  assert.ok(!/weight_grams \|\| 300/.test(rates), "must not silently default the weight inline");
  assert.ok(rates.includes("ASSUMED_ITEM_WEIGHT_G"), "the assumption must be named");
  assert.ok(rates.includes("missingWeight"), "products lacking a weight must be recorded");
});
