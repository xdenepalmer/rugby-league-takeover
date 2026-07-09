import test from "node:test";
import assert from "node:assert/strict";
import { resolveTokenUpsert } from "../src/lib/native/push-registration.js";

// ── APNs token reconciliation (unique index on `token`) ────────────────
test("resolveTokenUpsert inserts when the token is unknown", () => {
  const r = resolveTokenUpsert([], {
    userId: "u1",
    token: "apns-tok",
    platform: "ios",
    nowIso: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(r.action, "create");
  assert.ok(!("id" in r));
  assert.deepEqual(r.payload, {
    user_id: "u1",
    token: "apns-tok",
    platform: "ios",
    enabled: true,
    last_seen_date: "2026-01-01T00:00:00.000Z",
  });
});

test("resolveTokenUpsert updates and re-enables a previously seen token", () => {
  const r = resolveTokenUpsert([{ id: "row1", enabled: false }], {
    userId: "u2",
    token: "apns-tok",
    platform: "ios",
    nowIso: "2026-02-02T00:00:00.000Z",
  });
  assert.equal(r.action, "update");
  assert.equal(r.id, "row1");
  assert.equal(r.payload.enabled, true);
  assert.equal(r.payload.user_id, "u2");
  assert.equal(r.payload.last_seen_date, "2026-02-02T00:00:00.000Z");
});

test("resolveTokenUpsert tolerates a null match result", () => {
  const r = resolveTokenUpsert(null, {
    userId: "u3",
    token: "t",
    platform: "ios",
    nowIso: "x",
  });
  assert.equal(r.action, "create");
});
