import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseLegalContent } from "../src/lib/legal-content.js";

test("legal headings parse when followed immediately by body copy", () => {
  assert.deepEqual(
    parseLegalContent("[Information we collect]\nWe collect account details.\n\nAnother paragraph."),
    [
      { type: "heading", text: "Information we collect" },
      { type: "paragraph", text: "We collect account details." },
      { type: "paragraph", text: "Another paragraph." },
    ],
  );
});

test("legal parser normalises CRLF and preserves intentional paragraph line breaks", () => {
  assert.deepEqual(
    parseLegalContent("Intro line\r\ncontinues here\r\n[Contact]\r\nsupport@example.com"),
    [
      { type: "paragraph", text: "Intro line\ncontinues here" },
      { type: "heading", text: "Contact" },
      { type: "paragraph", text: "support@example.com" },
    ],
  );
});

test("empty or malformed heading-like content remains safe plain text", () => {
  assert.deepEqual(parseLegalContent(" \n\n"), []);
  assert.deepEqual(parseLegalContent("[Not closed\nText"), [
    { type: "paragraph", text: "[Not closed\nText" },
  ]);
});

test("fallback policies are dated, contactable, and contain no placeholder warning", async () => {
  const [privacy, terms] = await Promise.all([
    readFile(new URL("../src/pages/Privacy.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/Terms.jsx", import.meta.url), "utf8"),
  ]);

  for (const source of [privacy, terms]) {
    assert.match(source, /Effective date: 28 July 2026/);
    assert.match(source, /support@rugbyleaguetakeover\.com/);
    assert.doesNotMatch(source, /placeholder content/i);
    assert.doesNotMatch(source, /review it with your own legal advisor/i);
  }
});
