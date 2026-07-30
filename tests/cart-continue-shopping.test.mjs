import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// Owner report: "when you go to purchase an item there's no way to go back to
// shop and buy more things." Both carts offered "Continue Shopping" ONLY in the
// empty state — exactly when it is useless. With items in the cart the sole way
// back to the products was a small Close/X, while the free-shipping meter was
// actively telling the buyer to add more. That suppresses basket size.

test("the web cart offers a way back to the products WITH items in it", () => {
  const src = read("../src/pages/Store.jsx");
  // The non-empty branch of the cart list must carry its own continue-shopping
  // control, not just the empty-state one.
  const nonEmptyBranch = src.split("Your cart is empty")[1] || "";
  assert.ok(
    /continue shopping/i.test(nonEmptyBranch),
    "the populated cart renders a continue-shopping control"
  );
  const controls = src.match(/continue shopping/gi) || [];
  assert.ok(
    controls.length >= 2,
    `both the empty and populated carts offer it (found ${controls.length})`
  );
});

test("the native cart sheet offers the same escape hatch", () => {
  const src = read("../src/native/screens/store/NativeCartSheet.jsx");
  assert.ok(/continue shopping/i.test(src), "populated native cart can return to the store");
  assert.ok(/Browse merch/i.test(src), "empty native cart has a CTA, not just an X");
  // Both must dismiss the sheet rather than navigate, so the shopper lands back
  // on the store scroll position they came from.
  assert.ok(
    /onClick=\{onClose\}[\s\S]{0,400}Continue shopping/i.test(src) ||
      /Continue shopping[\s\S]{0,400}onClick=\{onClose\}/i.test(src),
    "continue-shopping closes the sheet"
  );
});

test("the post-purchase screen routes back to the store", () => {
  const src = read("../src/pages/CheckoutReturn.jsx");
  assert.ok(/to="\/store"/.test(src), "checkout return links back to the store");
});
