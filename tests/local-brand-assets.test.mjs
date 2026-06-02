import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const files = [
  "../src/components/public/HeroSection.jsx",
  "../src/components/public/SiteNav.jsx",
  "../src/components/admin/SiteSettingsManager.jsx",
  "../index.html",
  "../public/manifest.webmanifest",
];

test("core shell brand assets are bundled locally for PWA reliability", () => {
  for (const file of files) {
    const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
    assert.ok(!source.includes("24c67d277_LASVEGAS.png"), `${file} should not depend on the remote Base44 logo`);
  }
});
