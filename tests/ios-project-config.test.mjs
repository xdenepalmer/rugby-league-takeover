import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The iOS project is built in the cloud (Codemagic) with no Xcode UI, so
// entitlements / Info.plist strings / privacy manifest must live in git and
// stay wired into the pbxproj. These text-level guards catch a `cap sync` or
// hand-edit silently dropping them.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("Info.plist declares the camera/mic/photo usage strings", () => {
  const plist = read("ios/App/App/Info.plist");
  for (const key of ["NSCameraUsageDescription", "NSMicrophoneUsageDescription", "NSPhotoLibraryUsageDescription"]) {
    assert.ok(plist.includes(`<key>${key}</key>`), `Info.plist missing ${key}`);
  }
});

test("App.entitlements claims the associated domain for universal links", () => {
  const ent = read("ios/App/App/App.entitlements");
  assert.ok(ent.includes("com.apple.developer.associated-domains"));
  assert.ok(ent.includes("applinks:rugbyleaguetakeover.com"));
  // Push (aps-environment) is intentionally deferred to the push story — the
  // <key> must be absent even though a comment may reference it.
  assert.ok(!ent.includes("<key>aps-environment</key>"), "aps-environment should be deferred to the push story");
});

test("privacy manifest declares the required-reason API categories", () => {
  const priv = read("ios/App/App/PrivacyInfo.xcprivacy");
  for (const reason of ["CA92.1", "C617.1", "35F9.1"]) {
    assert.ok(priv.includes(reason), `PrivacyInfo.xcprivacy missing reason ${reason}`);
  }
  assert.ok(priv.includes("NSPrivacyTracking"));
});

test("pbxproj wires entitlements into both configs and the privacy manifest into resources", () => {
  const pbx = read("ios/App/App.xcodeproj/project.pbxproj");
  const entMatches = pbx.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g) || [];
  assert.equal(entMatches.length, 2, "entitlements must be set on Debug and Release");
  assert.ok(pbx.includes("PrivacyInfo.xcprivacy in Resources"), "privacy manifest must be in the Resources build phase");
});

test("AASA carries the real Team ID, not the placeholder", () => {
  const aasa = read("public/.well-known/apple-app-site-association");
  assert.ok(aasa.includes("25R438YK9F.com.rugbyleaguetakeover.app"));
  assert.ok(!aasa.includes("TEAMID"), "TEAMID placeholder must be replaced");
});
