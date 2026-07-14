import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// RLT-IOS-005 native-feel layer (canitickit-benchmark polish). Everything here
// is either native-scoped or config, so the web/PWA build is untouched.

test("the native class is stamped before React mounts (no first-paint flash)", () => {
  const main = read("../src/main.jsx");
  const stampIdx = main.indexOf('classList.add(\'is-native-app\')');
  const mountIdx = main.indexOf("createRoot");
  assert.ok(stampIdx > -1, "main.jsx stamps is-native-app");
  assert.ok(stampIdx < mountIdx, "the stamp happens before React mounts");
  assert.ok(/if \(isNativeApp\(\)\)[\s\S]*?is-native-app/.test(main), "the stamp is native-guarded (web never gets it)");
});

test("native press-dip and overscroll lock are scoped to html.is-native-app", () => {
  const css = read("../src/index.css");
  assert.ok(css.includes("html.is-native-app button:not(:disabled):not(.no-press):active"), "global press-dip on native buttons");
  assert.ok(/html\.is-native-app a\[href\]:not\(\.no-press\):active/.test(css), "press-dip on native links");
  assert.ok(css.includes("transform: scale(0.97)"), "the dip scales down");
  assert.ok(/html\.is-native-app[\s\S]*?overscroll-behavior: none/.test(css), "native kills the rubber-band bounce");
  // Web safety: the rules must be under the native class, never bare selectors.
  assert.ok(!/\n\s*button:not\(:disabled\):not\(\.no-press\):active/.test(css), "press-dip is never a bare (web-affecting) selector");
});

test("splash/launch background is pinned to the brand near-black", () => {
  const cfg = JSON.parse(read("../capacitor.config.json"));
  assert.equal(cfg.backgroundColor, "#030712", "top-level webview bg is brand dark (no white reveal)");
  assert.equal(cfg.ios.backgroundColor, "#030712", "iOS container bg is brand dark");
  assert.equal(cfg.plugins.SplashScreen.backgroundColor, "#030712", "splash bg unchanged");
});

test("the native shell animates page transitions and shows a skeleton, not a spinner", () => {
  const shell = read("../src/native/app/NativePublicShell.jsx");
  assert.ok(shell.includes("AnimatePresence") && shell.includes('mode="wait"'), "route transitions wrap the outlet");
  assert.ok(shell.includes("key={location.pathname}"), "transition keys off the path");
  assert.ok(shell.includes("NativeRouteSkeleton"), "lazy screens fall back to a native skeleton");
  assert.ok(/<Suspense fallback=\{<NativeRouteSkeleton \/>\}>[\s\S]*?<Outlet \/>/.test(shell), "the skeleton wraps the outlet, replacing the app-level spinner for fan screens");
  const skeleton = read("../src/native/components/NativeRouteSkeleton.jsx");
  assert.ok(skeleton.includes("NativeSkeleton"), "the skeleton is built from the shimmer primitive");
});

test("the admin command centre shell transitions and skeletons IDENTICALLY to the fan shell", () => {
  const shell = read("../src/native/admin/NativeAdminShell.jsx");
  assert.ok(shell.includes("AnimatePresence") && shell.includes('mode="wait"'), "admin route transitions wrap the outlet");
  assert.ok(shell.includes("key={pathname}"), "admin transition keys off the path");
  assert.ok(/<Suspense fallback=\{<NativeRouteSkeleton \/>\}>[\s\S]*?<Outlet \/>/.test(shell), "the skeleton wraps the admin outlet, so a module chunk load never flashes the full-screen spinner");
  // Both shells must pull the SAME motion constants, so admin nav can't drift
  // from the fan nav's feel — this is what fixes the 'dodgy/inconsistent' report.
  assert.ok(shell.includes('from "../components/native-page-motion.js"'), "admin shell imports the shared motion constants");
  const fan = read("../src/native/app/NativePublicShell.jsx");
  assert.ok(fan.includes('from "../components/native-page-motion.js"'), "fan shell imports the shared motion constants");
});

test("the shared native page-motion constants are a quick slide-fade", () => {
  const motion = read("../src/native/components/native-page-motion.js");
  assert.ok(motion.includes("export const pageVariants"), "exports pageVariants");
  assert.ok(motion.includes("export const pageTransition"), "exports pageTransition");
  assert.ok(/duration:\s*0\.18/.test(motion), "the transition is the quick 0.18s canitickit slide-fade");
});
