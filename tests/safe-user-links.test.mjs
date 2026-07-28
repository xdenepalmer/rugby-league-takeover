import test from "node:test";
import assert from "node:assert/strict";
import { safeUserHref } from "../src/lib/safe-url.js";

test("forum links allow only safe web, email, local, and fragment destinations", () => {
  assert.equal(safeUserHref("https://example.com/path?q=1"), "https://example.com/path?q=1");
  assert.equal(safeUserHref("http://example.com"), "http://example.com/");
  assert.equal(safeUserHref("mailto:support@example.com"), "mailto:support@example.com");
  assert.equal(safeUserHref("/forum?thread=123"), "/forum?thread=123");
  assert.equal(safeUserHref("#replies"), "#replies");
});

test("forum links reject executable and browser-confusing destinations", () => {
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "//evil.example/path",
    "https:\\\\evil.example",
    "file:///etc/passwd",
    "blob:https://example.com/id",
  ]) {
    assert.equal(safeUserHref(href), "", href);
  }
});
