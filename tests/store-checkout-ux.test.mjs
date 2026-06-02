import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const storePath = new URL("../src/pages/Store.jsx", import.meta.url);

test("store checkout reports preview restrictions inline instead of blocking alerts", () => {
  const source = fs.readFileSync(storePath, "utf8");

  assert.ok(!source.includes("alert("), "checkout should not use blocking browser alerts");
  assert.ok(source.includes("setCheckoutError"), "checkout should report recoverable errors inline");
  assert.ok(source.includes("Checkout works from the published app"), "preview checkout guard should remain clear");
});
