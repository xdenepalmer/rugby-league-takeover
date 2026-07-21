import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const manifest = read("../android/app/src/main/AndroidManifest.xml");
const appGradle = read("../android/app/build.gradle");
const variables = read("../android/variables.gradle");

test("Android identity and current Play target are stable", () => {
  assert.match(appGradle, /applicationId\s+"com\.rugbyleaguetakeover\.app"/);
  const target = Number(variables.match(/targetSdkVersion\s*=\s*(\d+)/)?.[1]);
  assert.ok(target >= 35, `targetSdkVersion must be at least 35, received ${target}`);
});

test("Android release signing only reads Codemagic environment variables", () => {
  for (const name of ["CM_KEYSTORE_PATH", "CM_KEYSTORE_PASSWORD", "CM_KEY_ALIAS", "CM_KEY_PASSWORD"]) {
    assert.ok(appGradle.includes(name), `missing ${name} signing input`);
  }
  assert.doesNotMatch(appGradle, /storePassword\s+["'][^"']+["']/);
  assert.doesNotMatch(appGradle, /keyPassword\s+["'][^"']+["']/);
});

test("Android app links cover every production host", () => {
  assert.match(manifest, /android:autoVerify="true"/);
  for (const host of [
    "rugbyleaguetakeover.com",
    "www.rugbyleaguetakeover.com",
    "rugbyleaguetakeover.com.au",
    "www.rugbyleaguetakeover.com.au",
  ]) {
    assert.ok(manifest.includes(`android:host="${host}"`), `missing app-link host ${host}`);
  }
});

test("Android backups and cleartext traffic are disabled", () => {
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.ok(existsSync(new URL("../android/app/src/main/res/xml/data_extraction_rules.xml", import.meta.url)));
});

test("branded launcher and splash assets are committed", () => {
  for (const path of [
    "../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",
    "../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png",
    "../android/app/src/main/res/drawable/splash.png",
  ]) {
    assert.ok(existsSync(new URL(path, import.meta.url)), `missing ${path}`);
  }
});
