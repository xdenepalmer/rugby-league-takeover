import test from "node:test";
import assert from "node:assert/strict";
import { detectNativePlatform, detectPlatform, CANONICAL_WEB_ORIGIN } from "../src/lib/native/native-env.js";

test("no Capacitor global means web", () => {
  assert.equal(detectNativePlatform(undefined), false);
  assert.equal(detectNativePlatform(null), false);
  assert.equal(detectNativePlatform({}), false);
  assert.equal(detectPlatform(undefined), "web");
});

test("a web Capacitor bridge (isNativePlatform false) stays web", () => {
  const bridge = { isNativePlatform: () => false, getPlatform: () => "web" };
  assert.equal(detectNativePlatform(bridge), false);
  assert.equal(detectPlatform(bridge), "web");
});

test("a native iOS bridge is detected", () => {
  const bridge = { isNativePlatform: () => true, getPlatform: () => "ios" };
  assert.equal(detectNativePlatform(bridge), true);
  assert.equal(detectPlatform(bridge), "ios");
});

test("a native Android bridge is detected", () => {
  const bridge = { isNativePlatform: () => true, getPlatform: () => "android" };
  assert.equal(detectNativePlatform(bridge), true);
  assert.equal(detectPlatform(bridge), "android");
});

test("a throwing bridge fails safe to web", () => {
  const bridge = { isNativePlatform: () => { throw new Error("boom"); } };
  assert.equal(detectNativePlatform(bridge), false);
  assert.equal(detectPlatform(bridge), "web");
});

test("canonical web origin is the production domain", () => {
  assert.equal(CANONICAL_WEB_ORIGIN, "https://rugbyleaguetakeover.com");
});
