import test from "node:test";
import assert from "node:assert/strict";

import { isPreviewLikeUrl, shouldEnablePwaForEnvironment } from "../src/lib/pwa-env.js";

test("detects preview and auth URLs that should not retain PWA caches", () => {
  assert.equal(isPreviewLikeUrl("https://rugbyleaguetakeover.com/?app_id=abc"), true);
  assert.equal(isPreviewLikeUrl("https://rugbyleaguetakeover.com/?access_token=abc"), true);
  assert.equal(isPreviewLikeUrl("http://localhost:5173/"), true);
  assert.equal(isPreviewLikeUrl("https://preview.base44.app/apps/123"), true);
  assert.equal(isPreviewLikeUrl("https://rugbyleaguetakeover.com/forum"), false);
});

test("enables PWA only for production browsers with service worker support", () => {
  assert.equal(shouldEnablePwaForEnvironment({
    href: "https://rugbyleaguetakeover.com/",
    mode: "production",
    hasServiceWorker: true,
  }), true);

  assert.equal(shouldEnablePwaForEnvironment({
    href: "https://rugbyleaguetakeover.com/",
    mode: "development",
    hasServiceWorker: true,
  }), false);

  assert.equal(shouldEnablePwaForEnvironment({
    href: "https://rugbyleaguetakeover.com/?app_id=abc",
    mode: "production",
    hasServiceWorker: true,
  }), false);

  assert.equal(shouldEnablePwaForEnvironment({
    href: "https://rugbyleaguetakeover.com/",
    mode: "production",
    hasServiceWorker: false,
  }), false);
});
