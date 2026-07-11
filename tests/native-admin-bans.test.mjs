import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BAN_TYPES,
  banTypeMeta,
  isBanExpired,
  banStatus,
  banStatusMeta,
  BAN_FILTERS,
  filterBans,
  banCounts,
  canSubmitBan,
  buildCreateBanPayload,
  buildLiftBanPayload,
  banCreateLogText,
  banLiftLogText,
} from "../src/native/admin/workflows/bans-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Status derivation mirrors the web BansManager ────────────────────────
test("ban types mirror the web select options", () => {
  assert.deepEqual(BAN_TYPES.map((t) => t.key), ["ip", "email", "user"]);
  assert.equal(banTypeMeta("email").label, "Email");
  assert.equal(banTypeMeta("nonsense").key, "ip", "unknown types fall back to ip (web typeConfig fallback)");
});

test("expiry and status follow the web rules: lifted wins, then expired, then active", () => {
  const now = new Date("2026-07-10T00:00:00Z").getTime();
  const active = { is_active: true };
  const expired = { is_active: true, expires_at: "2026-07-01T00:00:00Z" };
  const future = { is_active: true, expires_at: "2026-08-01T00:00:00Z" };
  const lifted = { is_active: false, expires_at: "2026-07-01T00:00:00Z" };
  assert.equal(isBanExpired(active, now), false, "no expires_at → never expired (permanent)");
  assert.equal(isBanExpired(expired, now), true);
  assert.equal(isBanExpired(future, now), false);
  assert.equal(banStatus(active, now), "active");
  assert.equal(banStatus(expired, now), "expired");
  assert.equal(banStatus(future, now), "active");
  assert.equal(banStatus(lifted, now), "lifted", "lifted beats expired");
  assert.equal(banStatusMeta("nonsense").label, "Active", "unknown status falls back to active tone");
});

test("search matches value, reason and type like the web filter; chips bucket by status", () => {
  const now = new Date("2026-07-10T00:00:00Z").getTime();
  const bans = [
    { id: "1", ban_type: "ip", value: "10.0.0.1", reason: "Spam bot", is_active: true },
    { id: "2", ban_type: "email", value: "troll@x.com", reason: "Abuse", is_active: true, expires_at: "2026-01-01T00:00:00Z" },
    { id: "3", ban_type: "user", value: "u_99", reason: "", is_active: false },
  ];
  assert.deepEqual(BAN_FILTERS.map((f) => f.key), ["all", "active", "expired", "lifted"]);
  assert.deepEqual(filterBans(bans, { query: "spam" }, now).map((b) => b.id), ["1"]);
  assert.deepEqual(filterBans(bans, { query: "TROLL@X.COM" }, now).map((b) => b.id), ["2"], "case-insensitive");
  assert.deepEqual(filterBans(bans, { query: "email" }, now).map((b) => b.id), ["2"], "type is searchable (web parity)");
  assert.equal(filterBans(bans, {}, now).length, 3, "empty query matches everything");
  assert.deepEqual(filterBans(bans, { status: "active" }, now).map((b) => b.id), ["1"]);
  assert.deepEqual(filterBans(bans, { status: "expired" }, now).map((b) => b.id), ["2"]);
  assert.deepEqual(filterBans(bans, { status: "lifted" }, now).map((b) => b.id), ["3"]);
  assert.deepEqual(banCounts(bans, now), { all: 3, active: 1, expired: 1, lifted: 1 });
});

// ── Payload parity: byte-identical writes ────────────────────────────────
test("create payload is byte-compatible with the web addBan mutation", () => {
  const payload = buildCreateBanPayload({
    banType: "email",
    value: "  Troll@X.COM ",
    reason: "  Repeated spam ",
    actorEmail: "admin@rlt.com",
  });
  assert.deepEqual(payload, {
    ban_type: "email",
    value: "troll@x.com",
    reason: "Repeated spam",
    banned_by: "admin@rlt.com",
    is_active: true,
  });
  assert.deepEqual(Object.keys(payload).sort(), ["ban_type", "banned_by", "is_active", "reason", "value"], "no invented fields (web sets no expires_at on create)");
});

test("create payload defaults mirror the web: reason fallback + empty banned_by", () => {
  const payload = buildCreateBanPayload({ banType: "ip", value: "10.0.0.1", reason: "  " });
  assert.equal(payload.reason, "Added by admin");
  assert.equal(payload.banned_by, "");
});

test("lift payload matches the web liftBan write exactly", () => {
  assert.deepEqual(buildLiftBanPayload(), { is_active: false });
});

test("submit gate matches the web: only a non-empty value is required", () => {
  assert.equal(canSubmitBan("10.0.0.1"), true);
  assert.equal(canSubmitBan("   "), false);
  assert.equal(canSubmitBan(""), false);
  assert.equal(canSubmitBan(undefined), false);
});

// ── rlt_admin_log parity ─────────────────────────────────────────────────
test("audit strings match the web BansManager dispatches character-for-character", () => {
  const payload = buildCreateBanPayload({ banType: "ip", value: " 10.0.0.1 ", reason: "" });
  assert.equal(
    banCreateLogText(payload),
    "[BAN-ACTION] Blocklist target registered: 10.0.0.1 (Reason: Added by admin)"
  );
  assert.equal(banLiftLogText("ban_123"), "[BAN-ACTION] Blocklist rules lifted for target ID: ban_123");
});

// ── Source contracts: entity writes, audit events, native UX rules ───────
test("native bans write through the same entity, key and audit bus as the web", () => {
  const src = read("../src/native/admin/workflows/NativeBansWorkflow.jsx");
  assert.ok(src.includes("Ban.create"), "create goes through the Ban entity");
  assert.ok(src.includes("Ban.update"), "lift goes through the Ban entity");
  assert.ok(src.includes('queryKey: ["bans"]'), "reads share the web's [\"bans\"] cache key");
  assert.ok(src.includes('base44.entities.Ban.list("-created_date", 500)'), "same list call as the web manager");
  assert.ok(src.includes('invalidateQueries({ queryKey: ["bans"] })'), "mutations invalidate the shared key");
  assert.ok(src.includes("emitAdminLog"), "audit events go through the shared helper");
  assert.ok(src.includes("banCreateLogText") && src.includes("banLiftLogText"), "both web [BAN-ACTION] events are emitted");
  assert.ok(src.includes("buildCreateBanPayload") && src.includes("buildLiftBanPayload"), "writes go through the shared payload builders");
});

test("native bans keep server authority — no invented endpoints or fields", () => {
  const src = read("../src/native/admin/workflows/bans-helpers.js") + read("../src/native/admin/workflows/NativeBansWorkflow.jsx");
  assert.ok(!src.includes("functions.invoke"), "bans use entity RLS, never an edge function (web parity)");
  assert.ok(!src.includes(".delete("), "bans are lifted (is_active: false), never hard-deleted");
  assert.ok(!("expires_at" in buildCreateBanPayload({ banType: "ip", value: "x" })), "create never writes expires_at — the web form doesn't either");
  assert.ok(!src.includes("@capacitor"), "no static capacitor imports");
});

test("native bans follow the house mobile UX rules", () => {
  const src = read("../src/native/admin/workflows/NativeBansWorkflow.jsx");
  assert.ok(!src.includes("group-hover:"), "no hover-only affordances");
  assert.ok(src.includes("AdminConfirmSheet"), "lifting a ban is confirmed");
  assert.ok(src.includes("MobileActionDrawer"), "the add-ban form is a native sheet");
  assert.ok(src.includes("mutateAsync"), "the add-ban sheet awaits settlement before closing");
  assert.ok(src.includes("NativeEmptyState") && src.includes("NativeSkeleton"), "loading/empty states are native");
  assert.ok(src.includes('restoreKey: "admin-bans"'), "long lists are windowed with scroll restoration");
  assert.ok(src.includes("PullToRefresh"), "pull to refresh the bans cache");
  assert.ok(src.includes("Search bans"), "search carried over from the web manager");
  for (const haptic of ["tab.select", "action.primary", "mutation.warning", "save.success", "mutation.error"]) {
    assert.ok(src.includes(`"${haptic}"`), `emits ${haptic} haptic`);
  }
});

test("detail screen is URL-addressable under the people section", () => {
  const src = read("../src/native/admin/workflows/NativeBansWorkflow.jsx");
  assert.ok(src.includes("export function NativeBanDetail"), "named detail export for the router");
  assert.ok(src.includes("/admin/people/bans/"), "list rows navigate to the detail route");
  assert.ok(src.includes("useParams"), "detail reads its ban id from the URL");
});
