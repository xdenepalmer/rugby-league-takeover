import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { canUseGoogleOAuth } from "../src/lib/native/auth-guards.js";
import { classifyHref } from "../src/lib/native/open-external.js";

// ── Google OAuth native guard ──────────────────────────────────────────
test("Google OAuth is hidden inside the native shell, available on web", () => {
  assert.equal(canUseGoogleOAuth({ isNative: true }), false);
  assert.equal(canUseGoogleOAuth({ isNative: false }), true);
  assert.equal(canUseGoogleOAuth(), true);
});

test("Login and Register gate the Google button on the guard", () => {
  for (const page of ["Login", "Register"]) {
    const src = readFileSync(new URL(`../src/pages/${page}.jsx`, import.meta.url), "utf8");
    assert.ok(src.includes("canUseGoogleOAuth"), `${page}.jsx must use canUseGoogleOAuth`);
    assert.ok(src.includes("googleAvailable && ("), `${page}.jsx must conditionally render the Google block`);
  }
});

// ── Link classification for the shell interceptor ──────────────────────
test("classifyHref routes each scheme to the right handler", () => {
  assert.equal(classifyHref("https://tickets.example.com/x"), "http");
  assert.equal(classifyHref("http://example.com"), "http");
  assert.equal(classifyHref("mailto:info@rugbyleaguetakeover.com"), "mailto");
  assert.equal(classifyHref("tel:+61400000000"), "tel");
  assert.equal(classifyHref("sms:+61400000000"), "sms");
  assert.equal(classifyHref("/forum"), "other");
  assert.equal(classifyHref("#travel"), "other");
  assert.equal(classifyHref(""), "other");
});

// ── Capacitor stays out of the preloaded web bundle ─────────────────────
test("vite config exempts @capacitor from the vendor-misc catch-all", () => {
  const config = readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");
  assert.ok(
    /@capacitor\/'\)\)\s*\{\s*return undefined/.test(config.replace(/\n/g, " ")) ||
      config.includes("'/node_modules/@capacitor/'"),
    "manualChunks must special-case @capacitor"
  );
  const capacitorRule = config.indexOf("@capacitor/");
  const catchAll = config.indexOf("return 'vendor-misc'");
  assert.ok(capacitorRule !== -1 && capacitorRule < catchAll, "@capacitor rule must run before the catch-all");
});

test("no static @capacitor imports anywhere in src (dynamic-only contract)", () => {
  // A static import would drag the Capacitor runtime into the preloaded
  // entry graph. Scan every js/jsx source file for every STATIC edge form —
  // named/default imports, bare side-effect imports, and `export … from`
  // re-exports. Only dynamic `import("@capacitor/…")` is allowed.
  const srcDir = fileURLToPath(new URL("../src", import.meta.url));
  const offenders = [];
  const staticEdge = new RegExp(
    [
      String.raw`import\s[^;]*from\s+["']@capacitor\/`, // import x / { x } from "@capacitor/…"
      String.raw`import\s+["']@capacitor\/`, // side-effect: import "@capacitor/…"
      String.raw`export\s[^;]*from\s+["']@capacitor\/`, // re-export: export … from "@capacitor/…"
    ].join("|")
  );
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (/\.(js|jsx|mjs)$/.test(name)) {
        const source = readFileSync(path, "utf8");
        if (staticEdge.test(source)) offenders.push(path);
      }
    }
  };
  walk(srcDir);
  assert.deepEqual(offenders, [], `static @capacitor import found in: ${offenders.join(", ")}`);
});

// ── Self-hosted fonts ───────────────────────────────────────────────────
test("brand fonts are self-hosted, not Google CDN", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(!html.includes("fonts.googleapis.com"), "index.html must not load fonts from Google CDN");
  const main = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
  for (const weight of ["inter/400", "inter/500", "inter/600", "inter/700", "inter/800", "oswald/500", "oswald/600", "oswald/700"]) {
    assert.ok(main.includes(`@fontsource/${weight}.css`), `main.jsx must import @fontsource/${weight}`);
  }
});

// ── AppDelegate push forwarding hooks (native plumbing only) ────────────
test("AppDelegate forwards APNs tokens to Capacitor", () => {
  const swift = readFileSync(new URL("../ios/App/App/AppDelegate.swift", import.meta.url), "utf8");
  assert.ok(swift.includes("didRegisterForRemoteNotificationsWithDeviceToken"));
  assert.ok(swift.includes(".capacitorDidRegisterForRemoteNotifications"));
  assert.ok(swift.includes(".capacitorDidFailToRegisterForRemoteNotifications"));
});
