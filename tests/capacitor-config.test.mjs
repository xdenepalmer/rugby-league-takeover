import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Neither eslint nor tsc looks at capacitor.config.json, so this text-level
// contract is the only automated guard on the native shell configuration.
const config = JSON.parse(readFileSync(new URL("../capacitor.config.json", import.meta.url), "utf8"));

test("app identity is stable", () => {
  assert.equal(config.appId, "com.rugbyleaguetakeover.app");
  assert.equal(config.appName, "Rugby League Takeover");
});

test("web assets come from the Vite build output", () => {
  assert.equal(config.webDir, "dist");
});

test("splash matches the anti-white-flash brand background and is JS-hidden", () => {
  assert.equal(config.plugins.SplashScreen.backgroundColor, "#030712");
  assert.equal(config.plugins.SplashScreen.launchAutoHide, false);
});

test("status bar overlays the webview so safe-area insets keep working", () => {
  assert.equal(config.plugins.StatusBar.overlaysWebView, true);
  assert.equal(config.plugins.StatusBar.style, "DARK");
});

test("no remote server override sneaks in", () => {
  assert.equal(config.server?.url, undefined);
});
