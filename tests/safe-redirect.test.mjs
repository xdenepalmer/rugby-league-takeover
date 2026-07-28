import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { safeInternalPath } from "../src/lib/safe-redirect.js";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

test("same-origin paths pass through", () => {
  assert.equal(safeInternalPath("/admin/store"), "/admin/store");
  assert.equal(safeInternalPath("/account?tab=orders"), "/account?tab=orders");
});

test("off-origin targets fall back", () => {
  for (const hostile of [
    "https://evil.com",
    "//evil.com",
    "/\\evil.com", // browsers normalise the backslash: resolves to //evil.com
    "/\\/evil.com",
    "/path\\evil.com",
    "/\tevil.com", // control chars are stripped while parsing
    "javascript:alert(1)",
    "",
    null,
    undefined,
    42,
  ]) {
    assert.equal(safeInternalPath(hostile), "/account", `${JSON.stringify(hostile)} must not be followed`);
  }
  assert.equal(safeInternalPath("//evil.com", "/"), "/");
});

test("post-auth redirects are validated, never raw query values", () => {
  for (const file of ["../src/pages/Login.jsx", "../src/pages/Register.jsx"]) {
    const src = read(file);
    assert.match(src, /safeInternalPath\(searchParams\.get\("next"\)\)/, `${file} must sanitise ?next=`);
  }
  const client = read("../src/api/base44Client.js");
  assert.match(client, /const next = safeInternalPath\(nextUrl\)/, "OAuth redirect target must be sanitised");
  assert.match(client, /window\.location\.assign\(safeInternalPath\(redirectUrl, '\/'\)\)/, "logout redirect must be sanitised");
});
