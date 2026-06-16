import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { detectOversoldItems } from "./checkout-rules.mjs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const schema = (name) => JSON.parse(read(`../base44/entities/${name}.jsonc`));

/* ── Checkout oversell detection ─────────────────────────────────────────── */
test("detectOversoldItems flags only items whose paid qty exceeds stock", () => {
  const products = {
    a: { id: "a", stock_quantity: 1 }, // oversold (ordered 2)
    b: { id: "b", stock_quantity: 5 }, // fine
    c: { id: "c" },                    // untracked → never oversold
  };
  const oversold = detectOversoldItems(
    [{ product_id: "a", quantity: 2 }, { product_id: "b", quantity: 3 }, { product_id: "c", quantity: 99 }],
    (id) => products[id],
  );
  assert.deepEqual(oversold, ["a"]);
});

test("stripeWebhook flags oversold orders for review (never silent)", () => {
  const src = read("../base44/functions/stripeWebhook/entry.ts");
  assert.match(src, /stock_oversold/, "must record an oversell flag on the order");
  assert.match(src, /oversoldItems\.push/, "must detect when purchased > available");
  assert.match(src, /Math\.max\(0, available - purchased\)/, "stock must never go negative");
});

test("StoreOrder has a stock_oversold field", () => {
  assert.ok(schema("StoreOrder").properties.stock_oversold, "StoreOrder must declare stock_oversold");
});

/* ── Server-side tipping lock ────────────────────────────────────────────── */
test("TippingEntry create is locked to the submitTip function (admin-only)", () => {
  const rls = schema("TippingEntry").rls;
  assert.notEqual(rls.create, true, "direct public create must be disabled");
  assert.match(JSON.stringify(rls.create), /admin/, "create must be admin/service-role only");
  assert.equal(rls.read, true, "entries stay publicly listable for the leaderboard");
});

test("submitTip enforces the kickoff deadline server-side", () => {
  const src = read("../base44/functions/submitTip/entry.ts");
  assert.match(src, /Matchup\.get/, "must read the authoritative kickoff from the Matchup");
  assert.match(src, /kickoffMs <= Date\.now\(\)/, "must reject tips after kickoff");
  assert.match(src, /status === 'finished' \|\| matchup\.status === 'live'/, "must reject live/finished games");
  assert.match(src, /findActiveBan/, "must honour bans like the other submit functions");
  assert.match(src, /margin < 1 \|\| margin > 60/, "must validate margin bounds");
});

test("ScorePredictor routes tips through submitTip, not a direct entity write", () => {
  const src = read("../src/components/forum/ScorePredictor.jsx");
  assert.match(src, /functions\.invoke\("submitTip"/, "tips must go through the submitTip function");
  assert.doesNotMatch(src, /entities\.TippingEntry\.create/, "must not write TippingEntry directly from the client");
});
