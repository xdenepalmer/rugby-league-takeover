import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const htmlPath = new URL("../index.html", import.meta.url);

test("app shell metadata uses local install assets and share metadata", () => {
  const html = fs.readFileSync(htmlPath, "utf8");

  assert.match(html, /<link rel="icon"[^>]+href="\/icons\/icon-192\.png"/);
  assert.match(html, /<link rel="apple-touch-icon"[^>]+href="\/icons\/icon-192\.png"/);
  assert.match(html, /<meta name="description" content="Rugby League Takeover Las Vegas news, forum, travel, events, and merch\." \/>/);
  assert.match(html, /<meta property="og:title" content="Rugby League Takeover" \/>/);
  // A 1200x630 landscape card, not the square icon — it fills the
  // summary_large_image tile shared to social on launch. Asset lives at
  // public/icons/og-image.png; width/height hint lets crawlers size it.
  assert.match(html, /<meta property="og:image" content="https:\/\/rugbyleaguetakeover\.com\/icons\/og-image\.png" \/>/);
  assert.match(html, /<meta property="og:image:width" content="1200" \/>/);
  assert.match(html, /<meta property="og:image:height" content="630" \/>/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/rugbyleaguetakeover\.com\/icons\/og-image\.png" \/>/);
});
