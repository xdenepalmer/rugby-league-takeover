import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LS_KEYS,
  REGISTRATION_COLUMNS,
  ORDER_COLUMNS,
  FORUM_COLUMNS,
  EXPORT_DATASETS,
  todayStamp,
  formatTimestamp,
  datasetFilename,
  datasetHeaders,
  datasetRows,
  toCsvString,
  recordCount,
} from "../src/native/admin/workflows/export-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const WEB = read("../src/components/admin/DataExporter.jsx");
const NATIVE = read("../src/native/admin/workflows/NativeExportWorkflow.jsx");

// ── localStorage keys mirror the web verbatim ─────────────────────────────
test("localStorage keys match the web DataExporter exactly", () => {
  assert.deepEqual(LS_KEYS, {
    registrations: "rlt_export_ts_registrations",
    orders: "rlt_export_ts_orders",
    forum: "rlt_export_ts_forum",
  });
  for (const key of Object.values(LS_KEYS)) {
    assert.ok(WEB.includes(`"${key}"`), `web writes localStorage key ${key}`);
  }
});

// ── Column definitions mirror the web verbatim ────────────────────────────
test("column labels/keys match the web column definitions", () => {
  assert.deepEqual(REGISTRATION_COLUMNS, [
    { key: "email", label: "Email" },
    { key: "full_name", label: "Full Name" },
    { key: "supporter_group", label: "Supporter Group" },
    { key: "created_date", label: "Created Date" },
  ]);
  assert.deepEqual(FORUM_COLUMNS, [
    { key: "id", label: "ID" },
    { key: "author_name", label: "Author Name" },
    { key: "title", label: "Title" },
    { key: "created_date", label: "Created Date" },
    { key: "is_published", label: "Published" },
    { key: "likes_count", label: "Likes" },
  ]);
  assert.deepEqual(
    ORDER_COLUMNS.map((c) => [c.key, c.label]),
    [
      ["id", "ID"],
      ["customer_email", "Customer Email"],
      ["status", "Status"],
      ["total_aud", "Total (AUD)"],
      ["created_date", "Created Date"],
      ["items", "Items Summary"],
    ]
  );
  // Every label the native emits must exist in the web source (no invented columns).
  for (const col of [...REGISTRATION_COLUMNS, ...ORDER_COLUMNS, ...FORUM_COLUMNS]) {
    assert.ok(WEB.includes(`label: "${col.label}"`), `web declares column ${col.label}`);
    if (!col.accessor) assert.ok(WEB.includes(`key: "${col.key}"`), `web declares key ${col.key}`);
  }
});

// ── Order items accessor mirrors the web summariser ───────────────────────
test("order items accessor summarises line_items like the web (name xqty; joined)", () => {
  const items = ORDER_COLUMNS.find((c) => c.key === "items");
  assert.equal(
    items.accessor({ line_items: [{ name: "Tee", quantity: 2 }, { title: "Cap" }] }),
    "Tee x2; Cap x1"
  );
  assert.equal(items.accessor({ line_items: [{ quantity: 3 }] }), "Item x3");
  assert.equal(items.accessor({}), "", "no line_items → empty");
  assert.equal(items.accessor({ line_items: "nope" }), "", "non-array line_items → empty");
});

// ── Dataset descriptors + filenames ───────────────────────────────────────
test("datasets map to the shared query-key props and the web filenames", () => {
  assert.deepEqual(EXPORT_DATASETS.map((d) => d.id), ["registrations", "orders", "forum"]);
  assert.deepEqual(EXPORT_DATASETS.map((d) => d.dataKey), ["registrations", "orders", "forumPosts"]);
  const stamp = todayStamp();
  assert.match(stamp, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(datasetFilename(EXPORT_DATASETS[0]), `rlt-registrations-${stamp}.csv`);
  assert.equal(datasetFilename(EXPORT_DATASETS[1]), `rlt-orders-${stamp}.csv`);
  assert.equal(datasetFilename(EXPORT_DATASETS[2]), `rlt-forum-posts-${stamp}.csv`);
  // Filename prefixes exist in the web filename builders.
  assert.ok(WEB.includes("rlt-registrations-") && WEB.includes("rlt-orders-") && WEB.includes("rlt-forum-posts-"));
});

// ── CSV building ──────────────────────────────────────────────────────────
test("headers + rows apply accessors and null→'' like the web convertToCSV", () => {
  const headers = datasetHeaders(REGISTRATION_COLUMNS);
  assert.deepEqual(headers, ["Email", "Full Name", "Supporter Group", "Created Date"]);
  const rows = datasetRows(REGISTRATION_COLUMNS, [
    { email: "a@b.com", full_name: "Ann Bee", supporter_group: null, created_date: "2026-01-01" },
  ]);
  assert.deepEqual(rows, [["a@b.com", "Ann Bee", "", "2026-01-01"]]);
  assert.deepEqual(datasetRows(REGISTRATION_COLUMNS, null), [], "no data → no rows");
});

test("toCsvString quotes every cell and doubles embedded quotes (@/lib/csv parity)", () => {
  const csv = toCsvString(["A", "B"], [["x", 'has "quote", comma'], ["", "y"]]);
  assert.equal(csv, '"A","B"\n"x","has ""quote"", comma"\n"","y"');
});

test("recordCount is web parity: Array.isArray(data) ? length : 0", () => {
  assert.equal(recordCount([1, 2, 3]), 3);
  assert.equal(recordCount([]), 0);
  assert.equal(recordCount(null), 0);
  assert.equal(recordCount(undefined), 0);
  assert.equal(recordCount("nope"), 0);
});

test("formatTimestamp returns null for empty input and a string otherwise", () => {
  assert.equal(formatTimestamp(null), null);
  assert.equal(formatTimestamp(""), null);
  assert.equal(typeof formatTimestamp("2026-07-13T04:00:00.000Z"), "string");
});

// ── Source contracts: shared cache, read-only, share path, UX ─────────────
test("native reads the same three query keys as the web ExportModule wrapper", () => {
  assert.ok(NATIVE.includes('queryKey: ["registrations"]'), "registrations key");
  assert.ok(NATIVE.includes('queryKey: ["orders"]'), "orders key");
  assert.ok(NATIVE.includes('queryKey: ["forumPosts"]'), "forumPosts key");
  assert.ok(NATIVE.includes("base44.entities.InterestRegistration.list"), "registrations read");
  assert.ok(NATIVE.includes("base44.entities.StoreOrder.list"), "orders read");
  assert.ok(NATIVE.includes("base44.entities.ForumPost.list"), "forum read");
});

test("export is read-only: no entity writes, no edge functions, no invented audit events", () => {
  assert.ok(!/\.(create|update|delete)\(/.test(NATIVE), "no entity mutations");
  assert.ok(!NATIVE.includes("functions.invoke"), "no edge-function calls (web parity)");
  assert.ok(!WEB.includes("rlt_admin_log") && !WEB.includes("emitAdminLog"), "web dispatches no export audit events");
  assert.ok(!NATIVE.includes("emitAdminLog") && !NATIVE.includes("dispatchEvent"), "native matches: no audit events");
});

test("native writes the same localStorage timestamp keys the web writes", () => {
  for (const key of Object.values(LS_KEYS)) {
    assert.ok(NATIVE.includes(key) || NATIVE.includes("LS_KEYS"), `native records ${key}`);
  }
  assert.ok(NATIVE.includes("localStorage.setItem"), "native persists the last-export timestamp");
  assert.ok(NATIVE.includes("localStorage.getItem"), "native reads the last-export timestamp");
});

test("native CSV delivery uses the share sheet natively and @/lib/csv on web", () => {
  assert.ok(NATIVE.includes("isNativeApp"), "branches on native shell");
  assert.ok(NATIVE.includes('import("@capacitor/share")'), "native path shares via @capacitor/share");
  assert.ok(NATIVE.includes("downloadCsv"), "web path reuses @/lib/csv downloadCsv");
  assert.ok(!/from ["']@capacitor/.test(NATIVE), "no static @capacitor imports (dynamic import only)");
});

test("native export UX contracts: chrome, haptics, loading/empty, no hover-only affordances", () => {
  assert.ok(NATIVE.includes("NativeTopBar") && NATIVE.includes('fallback="/admin/more"'), "self-chromed with hub fallback");
  assert.ok(NATIVE.includes("PullToRefresh"), "pull to refresh the export queries");
  assert.ok(NATIVE.includes("NativeSkeleton"), "loading skeletons");
  assert.ok(NATIVE.includes("NativeEmptyState"), "empty state");
  assert.ok(NATIVE.includes("min-h-11"), "44pt touch target on the export button");
  assert.ok(NATIVE.includes("emitHaptic"), "haptics present");
  for (const event of ["action.primary", "save.success", "mutation.error"]) {
    assert.ok(NATIVE.includes(`"${event}"`), `haptic event ${event} used`);
  }
  assert.ok(!NATIVE.includes("group-hover:"), "no hover-only affordances");
});
