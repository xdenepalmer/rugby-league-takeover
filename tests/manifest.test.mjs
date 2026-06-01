import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const manifestPath = new URL("../public/manifest.webmanifest", import.meta.url);

test("web app manifest includes install-critical fields", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.equal(manifest.name, "Rugby League Takeover");
  assert.equal(manifest.short_name, "RLT Vegas");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok((manifest.display_override || []).includes("standalone"), "manifest should prefer standalone display on mobile");
  assert.ok((manifest.categories || []).includes("sports"), "manifest should classify the app for install surfaces");
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);

  const iconSizes = new Set((manifest.icons || []).map((icon) => icon.sizes));
  assert.ok(iconSizes.has("192x192"), "manifest is missing a 192x192 icon");
  assert.ok(iconSizes.has("512x512"), "manifest is missing a 512x512 icon");
  assert.ok((manifest.icons || []).some((icon) => String(icon.purpose || "").includes("maskable")), "manifest is missing a maskable icon");
});

test("web app manifest exposes admin and fan shortcuts", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const shortcutUrls = new Set((manifest.shortcuts || []).map((shortcut) => shortcut.url));

  assert.ok(shortcutUrls.has("/admin"), "manifest is missing an admin shortcut");
  assert.ok(shortcutUrls.has("/forum"), "manifest is missing a forum shortcut");
  assert.ok(shortcutUrls.has("/store"), "manifest is missing a store shortcut");
});
