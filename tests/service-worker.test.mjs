import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sw = fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const viteConfig = fs.readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");

test("service worker is build-stamped so updates are detectable", () => {
  assert.ok(sw.includes("__BUILD_ID__"), "sw.js must keep the __BUILD_ID__ placeholder for per-build stamping");
  assert.ok(/CACHE_NAME\s*=\s*`rlt-\$\{BUILD_ID\}`/.test(sw), "cache name must be derived from BUILD_ID");
  assert.ok(viteConfig.includes("__BUILD_ID__"), "vite config must replace __BUILD_ID__ at build time");
});

test("service worker supports a controlled update (no auto skip-waiting)", () => {
  assert.ok(/addEventListener\(\s*["']message["']/.test(sw), "sw.js must listen for messages");
  assert.ok(sw.includes("SKIP_WAITING"), "sw.js must handle the SKIP_WAITING message");

  // The install handler must NOT call skipWaiting() — the new worker should wait
  // for the user's go-ahead via the update prompt.
  const installBlock = sw.slice(sw.indexOf('addEventListener("install"'), sw.indexOf('addEventListener("activate"'));
  assert.ok(!/self\.skipWaiting\(\)/.test(installBlock), "install must not auto skipWaiting");
});
