import test from "node:test";
import assert from "node:assert/strict";
import { shouldEnablePwaForEnvironment } from "../src/lib/pwa-env.js";
import { getInstallPromptMode } from "../src/lib/install-prompt.js";
import { mapUrlToRoute } from "../src/lib/native/deep-links.js";
import { canonicalizeShareUrl } from "../src/lib/native/share.js";

// ── Service worker / update prompt gate ────────────────────────────────
test("PWA is disabled inside the native shell regardless of host", () => {
  assert.equal(
    shouldEnablePwaForEnvironment({
      href: "https://rugbyleaguetakeover.com/",
      mode: "production",
      hasServiceWorker: true,
      isNative: true,
    }),
    false
  );
});

test("PWA still enabled on the production web host when not native", () => {
  assert.equal(
    shouldEnablePwaForEnvironment({
      href: "https://rugbyleaguetakeover.com/",
      mode: "production",
      hasServiceWorker: true,
      isNative: false,
    }),
    true
  );
});

test("omitting isNative preserves the pre-native behavior", () => {
  assert.equal(
    shouldEnablePwaForEnvironment({
      href: "https://rugbyleaguetakeover.com/",
      mode: "production",
      hasServiceWorker: true,
    }),
    true
  );
});

// ── Install nudge gate ─────────────────────────────────────────────────
test("install prompt is hidden inside the native shell", () => {
  // Even with an iPhone Safari-like UA (WKWebView UAs can include Safari).
  assert.equal(
    getInstallPromptMode({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Safari/605.1.15",
      isNativeShell: true,
    }),
    "hidden"
  );
  assert.equal(getInstallPromptMode({ hasBeforeInstallPrompt: true, isNativeShell: true }), "hidden");
});

// ── Deep-link route mapping ────────────────────────────────────────────
test("universal links on the canonical domain map to router paths", () => {
  assert.equal(mapUrlToRoute("https://rugbyleaguetakeover.com/forum?thread=abc"), "/forum?thread=abc");
  assert.equal(mapUrlToRoute("https://www.rugbyleaguetakeover.com/news"), "/news");
  assert.equal(mapUrlToRoute("https://rugbyleaguetakeover.com/store?success=true"), "/store?success=true");
  assert.equal(mapUrlToRoute("capacitor://localhost/account"), "/account");
});

test("foreign hosts are not hijacked into the router", () => {
  assert.equal(mapUrlToRoute("https://checkout.stripe.com/c/pay/x"), null);
  assert.equal(mapUrlToRoute("https://evil.example.com/forum"), null);
  assert.equal(mapUrlToRoute(""), null);
});

// ── Share URL canonicalization ─────────────────────────────────────────
test("capacitor origin share links are rewritten to the public domain", () => {
  assert.equal(
    canonicalizeShareUrl("capacitor://localhost/forum?thread=abc"),
    "https://rugbyleaguetakeover.com/forum?thread=abc"
  );
});

test("https share links pass through untouched", () => {
  assert.equal(
    canonicalizeShareUrl("https://rugbyleaguetakeover.com/news"),
    "https://rugbyleaguetakeover.com/news"
  );
});

test("relative paths resolve against the canonical origin", () => {
  assert.equal(canonicalizeShareUrl("/gallery"), "https://rugbyleaguetakeover.com/gallery");
});
