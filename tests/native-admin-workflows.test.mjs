import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ORDER_FILTERS,
  ORDER_STATUSES,
  filterOrders,
  nextOrderActions,
  canCancelOrRefund,
  buildOrderStatusPayload,
  MOD_QUEUES,
  moderationQueue,
  moderationCounts,
  buildSoftDeletePayload,
  buildRestorePayload,
  fanThreadPath,
  filterRegistrations,
  registrationEmailTargets,
} from "../src/native/admin/workflows/workflow-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Orders: pipeline rules mirror the web manager ───────────────────────
test("order filters mirror the web pipeline groups", () => {
  assert.deepEqual(ORDER_FILTERS.map((f) => f.key), ["all", "unfulfilled", "packing", "shipped", "completed", "other"]);
  assert.deepEqual(ORDER_FILTERS.find((f) => f.key === "unfulfilled").statuses, ["paid"]);
  assert.deepEqual(ORDER_FILTERS.find((f) => f.key === "other").statuses, ["pending", "cancelled", "refunded"]);
  assert.equal(ORDER_STATUSES.length, 7);
});

test("order search matches id, names, emails and tracking", () => {
  const orders = [
    { id: "ord_ABC123", status: "paid", customer_name: "Deb", customer_email: "deb@x.com" },
    { id: "ord_ZZZ999", status: "shipped", tracking_number: "AP555", customer_name: "Mia" },
  ];
  assert.equal(filterOrders(orders, { query: "abc123" }).length, 1);
  assert.equal(filterOrders(orders, { query: "ap555" })[0].id, "ord_ZZZ999");
  assert.equal(filterOrders(orders, { filter: "unfulfilled" }).length, 1);
  assert.equal(filterOrders(orders, { filter: "shipped", query: "deb" }).length, 0);
});

test("fulfilment transitions follow paid → packing → shipped → delivered", () => {
  assert.deepEqual(nextOrderActions("paid").map((a) => a.to), ["packing", "shipped"]);
  assert.deepEqual(nextOrderActions("packing").map((a) => a.to), ["shipped"]);
  assert.deepEqual(nextOrderActions("shipped").map((a) => a.to), ["completed"]);
  assert.deepEqual(nextOrderActions("completed"), []);
  assert.ok(nextOrderActions("packing")[0].requiresTracking, "shipping requires tracking");
  assert.equal(canCancelOrRefund("paid"), true);
  assert.equal(canCancelOrRefund("completed"), false);
  assert.equal(canCancelOrRefund("refunded"), false);
});

test("status payloads match the web manager's writes", () => {
  const order = { id: "o1", status: "packing", timeline: [{ action: "created" }], tracking_number: "" };
  const shipped = buildOrderStatusPayload(order, "shipped", {
    actorEmail: "admin@rlt.com",
    tracking: { number: "AP1", url: "https://t.co/AP1", carrier: "AusPost" },
  });
  assert.equal(shipped.status, "shipped");
  assert.equal(shipped.tracking_number, "AP1");
  assert.equal(shipped.carrier, "AusPost");
  assert.ok(shipped.shipped_at, "shipped_at stamped");
  assert.equal(shipped.timeline.length, 2);
  assert.equal(shipped.timeline[1].actor, "admin@rlt.com");
  assert.match(shipped.timeline[1].action, /Status changed to Shipped/);

  const delivered = buildOrderStatusPayload({ ...order, status: "shipped" }, "completed", { actorEmail: "a" });
  assert.ok(delivered.delivered_at, "delivered_at stamped");
  assert.ok(!("tracking_number" in delivered), "non-shipping transitions don't touch tracking");
});

// ── Moderation: queues + payload parity ─────────────────────────────────
test("moderation queues mirror the web manager filters", () => {
  const posts = [
    { id: "1", is_published: false },
    { id: "2", is_published: true, reported_count: 2 },
    { id: "3", is_published: true },
    { id: "4", is_published: false, deleted_at: "2026-01-01" },
  ];
  assert.deepEqual(MOD_QUEUES.map((q) => q.key), ["pending", "reported", "live", "removed"]);
  assert.deepEqual(moderationQueue(posts, "pending").map((p) => p.id), ["1"]);
  assert.deepEqual(moderationQueue(posts, "reported").map((p) => p.id), ["2"]);
  assert.deepEqual(moderationQueue(posts, "live").map((p) => p.id), ["2", "3"]);
  assert.deepEqual(moderationQueue(posts, "removed").map((p) => p.id), ["4"]);
  assert.deepEqual(moderationCounts(posts), { pending: 1, reported: 1, live: 2, removed: 1 });
});

test("soft-delete and restore payloads are byte-compatible with the web", () => {
  const del = buildSoftDeletePayload("mod@rlt.com", "spam");
  assert.equal(del.deleted_by, "mod@rlt.com");
  assert.equal(del.is_published, false);
  assert.equal(del.moderation_reason, "spam");
  assert.ok(del.deleted_at);
  const delNoReason = buildSoftDeletePayload("mod@rlt.com");
  assert.ok(!("moderation_reason" in delNoReason));
  assert.deepEqual(buildRestorePayload(), { deleted_at: "", deleted_by: "", is_published: false });
});

test("moderated replies open their parent thread on the fan side", () => {
  assert.equal(fanThreadPath({ id: "root1" }), "/forum/thread/root1");
  assert.equal(fanThreadPath({ id: "reply9", parent_id: "root1" }), "/forum/thread/root1");
  assert.equal(fanThreadPath(null), "/forum");
});

// ── Registrations ───────────────────────────────────────────────────────
test("registration search + bcc targets mirror the web behavior", () => {
  const regs = [
    { id: "1", name: "Deb", email: "deb@x.com", trip_details: "Flying Friday" },
    { id: "2", name: "Mia", email: "mia@x.com", team_supported: "Storm" },
    { id: "3", name: "NoMail" },
    { id: "4", name: "Dup", email: "deb@x.com" },
  ];
  assert.deepEqual(filterRegistrations(regs, "storm").map((r) => r.id), ["2"]);
  assert.deepEqual(filterRegistrations(regs, "friday").map((r) => r.id), ["1"]);
  assert.equal(filterRegistrations(regs, "").length, 4);
  assert.deepEqual(registrationEmailTargets(regs), ["deb@x.com", "mia@x.com"], "deduped, blanks dropped");
});

// ── Wiring + safety contracts ───────────────────────────────────────────
test("registry routes the three priority modules to native workflows", () => {
  const registry = read("../src/native/admin/admin-modules.jsx");
  assert.ok(registry.includes("NativeOrdersList"), "orders → native workflow");
  assert.ok(registry.includes("NativeModerationQueue"), "forum → native workflow");
  assert.ok(registry.includes("NativeRegistrationsList"), "registrations → native workflow");
  for (const id of ["orders", "forum", "registrations"]) {
    assert.match(registry, new RegExp(`${id}: \\{[^}]*selfChrome: true`), `${id} marked self-chromed`);
  }
});

test("detail screens are URL-addressable", () => {
  const routes = read("../src/native/admin/NativeAdminRoutes.jsx");
  assert.ok(routes.includes('path="store/orders/:orderId"'), "order detail route");
  assert.ok(routes.includes('path="people/registrations/:regId"'), "registration detail route");
});

test("native workflows reuse existing write authority, no new rules", () => {
  const orders = read("../src/native/admin/workflows/NativeOrdersWorkflow.jsx");
  assert.ok(orders.includes("StoreOrder.update"), "orders write through the entity");
  assert.ok(orders.includes('invoke("auspostCreateLabel"') && orders.includes('invoke("auspostTrack"'), "label/track reuse edge fns");
  assert.ok(orders.includes("AdminConfirmSheet"), "state changes are confirmed");
  assert.ok(orders.includes("webhook"), "payment authority stated");
  const mod = read("../src/native/admin/workflows/NativeModerationWorkflow.jsx");
  assert.ok(mod.includes("ForumPost.update"), "moderation writes through the entity");
  assert.ok(mod.includes("Ban.create") && mod.includes("BanDialog"), "bans reuse the web dialog + shape");
  assert.ok(mod.includes("fanThreadPath"), "can open the fan thread");
  const regs = read("../src/native/admin/workflows/NativeRegistrationsWorkflow.jsx");
  assert.ok(!regs.includes(".update(") && !regs.includes(".delete("), "registrations stay read-only");
});

test("native workflows have no hover-only affordances", () => {
  for (const file of ["NativeOrdersWorkflow.jsx", "NativeModerationWorkflow.jsx", "NativeRegistrationsWorkflow.jsx"]) {
    const src = read(`../src/native/admin/workflows/${file}`);
    assert.ok(!src.includes("group-hover:"), `${file} must not hide actions behind hover`);
  }
});

test("PII surfaces stay off the native persistence layer", () => {
  const persistence = read("../src/lib/native/query-persistence.js");
  const allowMatch = persistence.match(/export const PERSIST_ALLOWLIST = \[([\s\S]*?)\]/);
  assert.ok(allowMatch, "persistence must be allowlist-based");
  for (const key of ["orders", "registrations", "bans", "users", "invites", "adminAttention"]) {
    assert.ok(!allowMatch[1].includes(`"${key}"`), `${key} must not be allowlisted`);
  }
});
