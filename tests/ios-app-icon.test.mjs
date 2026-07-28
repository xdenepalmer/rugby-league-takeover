import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const asset = (p) => readFileSync(new URL(`../ios/App/App/Assets.xcassets/${p}`, import.meta.url));
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

// Build 39 shipped to TestFlight wearing the stock Capacitor logo, because
// `cap add ios` scaffolds placeholder art and nothing ever replaced it. These
// pin the branded assets so a re-scaffold or a bad merge can't quietly ship
// someone else's logo again.

// The exact bytes of the Capacitor template art, as committed by the iOS
// foundation PR. Any real artwork differs; only a revert to stock matches.
const STOCK_ICON = "29e4777e319de3ee5a52c3a8004ec19d0568414004257e36d7c94a077d71c93b";
const STOCK_SPLASH = "1b5002b74a5500e697298ced06ca2811ac33f2771f236f3c720ff23243890530";

// Minimal IHDR reader — PNG signature is 8 bytes, then a 25-byte IHDR chunk.
function pngHeader(buf) {
  assert.equal(buf.subarray(1, 4).toString("ascii"), "PNG", "not a PNG");
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colourType: buf.readUInt8(25), // 2 = RGB, 4 = grey+alpha, 6 = RGBA
  };
}

test("the app icon is the RLT logo, not the Capacitor placeholder", () => {
  assert.notEqual(sha(asset("AppIcon.appiconset/AppIcon-512@2x.png")), STOCK_ICON,
    "app icon is still the stock Capacitor artwork");
});

test("the app icon is 1024x1024 and fully opaque", () => {
  const { width, height, colourType } = pngHeader(asset("AppIcon.appiconset/AppIcon-512@2x.png"));
  assert.equal(width, 1024, "App Store Connect requires a 1024x1024 marketing icon");
  assert.equal(height, 1024);
  // An alpha channel is an automatic rejection at upload ("Invalid large app
  // icon ... can't be transparent nor contain an alpha channel").
  assert.ok(colourType !== 6 && colourType !== 4, `icon has an alpha channel (colour type ${colourType})`);
});

test("the launch screen is branded, not the Capacitor placeholder", () => {
  for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
    assert.notEqual(sha(asset(`Splash.imageset/${name}`)), STOCK_SPLASH, `${name} is still stock artwork`);
  }
});

test("the launch screen matches the dark background the app declares", () => {
  // capacitor.config.json sets SplashScreen.backgroundColor #030712. A white
  // splash against a dark app is the flash of white on every cold start.
  const config = JSON.parse(readFileSync(new URL("../capacitor.config.json", import.meta.url), "utf8"));
  assert.equal(config.plugins?.SplashScreen?.backgroundColor?.toLowerCase(), "#030712");

  const buf = asset("Splash.imageset/splash-2732x2732.png");
  const { width, height, colourType } = pngHeader(buf);
  assert.equal(width, 2732, "Capacitor centre-crops a 2732 square to every device aspect");
  assert.equal(height, 2732);
  assert.ok(colourType !== 6 && colourType !== 4, "splash should be flattened onto the brand background");
});
