import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const schema = (name) => JSON.parse(read(`../base44/entities/${name}.jsonc`));

const isAdminOnly = (rule) =>
  rule && rule !== true && JSON.stringify(rule).includes('"role":"admin"');

/* Server-authoritative write paths: these entities are only ever created via
 * service-role backend functions (submitForumPost, submitRegistration,
 * createCheckout, subscribeProductRelease) which bypass RLS. Public create:true
 * here would let clients bypass ban/profanity/price/bot checks by writing the
 * entity directly — keep create locked down (audit RLT-AUDIT-1). */
test("function-backed entities do not allow direct public create", () => {
  for (const name of ["ForumPost", "InterestRegistration", "StoreOrder", "ProductReleaseSubscription"]) {
    const e = schema(name);
    assert.notEqual(e.rls.create, true, `${name}.rls.create must not be public`);
    assert.ok(isAdminOnly(e.rls.create), `${name}.rls.create must be admin-only`);
  }
});

test("TippingEntry reporter PII is not publicly readable", () => {
  const e = schema("TippingEntry");
  // Entries stay publicly listable for the leaderboard…
  assert.equal(e.rls.read, true);
  // …but identity fields are admin-only at the field level.
  for (const field of ["user_email", "user_id"]) {
    const rls = e.properties[field]?.rls;
    assert.ok(isAdminOnly(rls?.read), `TippingEntry.${field} read must be admin-only`);
  }
});

test("Product and NewsArticle declare explicit RLS (no platform defaults)", () => {
  for (const name of ["Product", "NewsArticle"]) {
    const e = schema(name);
    assert.ok(e.rls, `${name} must declare an rls block`);
    assert.equal(e.rls.read, true, `${name} read should stay public`);
    for (const op of ["create", "update", "delete"]) {
      assert.ok(isAdminOnly(e.rls[op]), `${name}.rls.${op} must be admin-only`);
    }
  }
});

test("notifyProductRelease verifies the product server-side (untrusted caller)", () => {
  const src = read("../base44/functions/notifyProductRelease/entry.ts");
  assert.match(src, /asServiceRole\.entities\.Product\.get\(productId\)/, "must re-fetch the product server-side");
  assert.doesNotMatch(src, /const product = payload\?\.data;/, "must not trust caller-supplied product fields");
});

test("npm test stays CI-portable (no shell-dependent glob)", () => {
  const pkg = JSON.parse(read("../package.json"));
  assert.equal(pkg.scripts.test, "node --test", "quoted globs break node --test on CI (Node<21 / Linux)");
});
