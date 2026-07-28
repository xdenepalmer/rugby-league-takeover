import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isRetryableSyncError } from "../src/lib/tip-sync-queue.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ── Tip sync: retry transient failures, surface definitive rejections ──────
test("only transient failures stay queued for retry", () => {
  assert.equal(isRetryableSyncError(new Error("Failed to fetch")), true, "network errors retry");
  assert.equal(isRetryableSyncError({ status: 500 }), true, "server errors retry");
  assert.equal(isRetryableSyncError({ status: 408 }), true, "timeouts retry");
  assert.equal(isRetryableSyncError({ status: 429 }), true, "rate limits retry");
  assert.equal(isRetryableSyncError({ response: { status: 503 } }), true, "axios-shaped status read");
  assert.equal(isRetryableSyncError({ status: 400 }), false, "validation rejections are permanent");
  assert.equal(isRetryableSyncError({ status: 401 }), false, "auth rejections are permanent");
  assert.equal(isRetryableSyncError({ status: 409 }), false, "duplicates are permanent");
});

test("queued tips rejected by the server are dropped and reported", () => {
  const sp = read("src/components/forum/ScorePredictor.jsx");
  assert.ok(sp.includes("isRetryableSyncError"), "flush must classify failures");
  assert.ok(
    /isRetryableSyncError\(err\)[\s\S]{0,400}removeTipFromQueue\(payload\.game_id\)/.test(sp),
    "permanently rejected tips must leave the queue instead of retrying forever",
  );
  assert.ok(!/\.catch\(\(\) => \{ \/\* still unreachable/.test(sp), "flush must not swallow errors");
});

// ── Auth: failures must never look like a successful downgrade ────────────
test("profile read errors propagate instead of falling back to a default user", () => {
  const client = read("src/api/base44Client.js");
  const fetchProfile = client.slice(
    client.indexOf("async function fetchProfile"),
    client.indexOf("const auth = {"),
  );
  assert.ok(fetchProfile.includes("throwIf(error)"), "a failed profile read must throw, not return null");
});

test("session and sign-out failures are propagated", () => {
  const client = read("src/api/base44Client.js");
  const isAuthenticated = client.slice(
    client.indexOf("async isAuthenticated()"),
    client.indexOf("async me()"),
  );
  assert.ok(isAuthenticated.includes("throwIf(error)"), "getSession errors must not be ignored");

  const logout = client.slice(client.indexOf("async logout(redirectUrl)"), client.indexOf("redirectToLogin("));
  assert.ok(logout.includes("throwIf(error)"), "signOut errors must not be ignored");
  assert.ok(
    logout.indexOf("throwIf(error)") < logout.indexOf("window.location.assign"),
    "must not redirect as if signed out when the session is still live",
  );
});

test("sign-out is routed through the reporting helper, not fire-and-forget", () => {
  const helper = read("src/lib/sign-out.js");
  assert.ok(helper.includes("toast("), "failed sign-out must be surfaced to the user");
  for (const file of [
    "src/components/public/SiteNav.jsx",
    "src/components/admin/AdminLayout.jsx",
    "src/components/account/SecurityTab.jsx",
    "src/lib/AuthContext.jsx",
  ]) {
    assert.ok(!read(file).includes("auth.logout("), `${file} must use signOut() so errors are reported`);
  }
});

test("auth bootstrap failure still resolves the auth gate", () => {
  const ctx = read("src/lib/AuthContext.jsx");
  const catchBlock = ctx.slice(ctx.indexOf("console.error('Unexpected error:'"), ctx.indexOf("}, [checkUserAuth]);"));
  assert.ok(catchBlock.includes("setAuthChecked(true)"), "guards would hang on a loading screen otherwise");
});
