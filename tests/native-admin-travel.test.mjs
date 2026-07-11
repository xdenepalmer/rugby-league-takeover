import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EMPTY_TRAVEL_PACKAGE,
  TRAVEL_PACKAGE_FIELDS,
  buildPackageDraft,
  buildPackagePayload,
  canCreatePackage,
  filterPackages,
  packageStatusMeta,
  descriptionPreview,
} from "../src/native/admin/workflows/travel-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Travel: draft + payload parity with the web manager ─────────────────
test("empty draft matches the web manager's emptyPackage byte-for-byte", () => {
  assert.deepEqual(EMPTY_TRAVEL_PACKAGE, {
    name: "",
    description: "",
    image_url: "",
    booking_url: "",
    booking_label: "",
    is_coming_soon: true,
    sort_order: 1,
  });
  // The web source still declares the same literal — parity can't drift silently.
  const web = read("../src/components/admin/TravelPackagesManager.jsx");
  assert.match(
    web,
    /emptyPackage = \{ name: "", description: "", image_url: "", booking_url: "", booking_label: "", is_coming_soon: true, sort_order: 1 \}/,
    "web emptyPackage literal unchanged"
  );
});

test("edit draft seeds with the web PackageCard defaults", () => {
  const draft = buildPackageDraft({
    id: "p1",
    name: "Circa Stay",
    description: "Five nights",
    sort_order: 3,
    image_url: "https://img/x.jpg",
    booking_url: "https://book/x",
    booking_label: "Book Circa Rate",
    is_coming_soon: false,
  });
  assert.deepEqual(draft, {
    name: "Circa Stay",
    description: "Five nights",
    sort_order: 3,
    image_url: "https://img/x.jpg",
    booking_url: "https://book/x",
    booking_label: "Book Circa Rate",
    is_coming_soon: false,
  });
  // Web truthiness parity: unset/undefined is_coming_soon counts as coming soon.
  assert.equal(buildPackageDraft({}).is_coming_soon, true);
  assert.equal(buildPackageDraft({ is_coming_soon: true }).is_coming_soon, true);
  assert.equal(buildPackageDraft({}).sort_order, 1, "missing sort_order defaults to 1 like the web draft");
  assert.equal(buildPackageDraft(null).name, "", "null-safe for lazy seeding");
});

test("payload carries exactly the web field set — never more, never less", () => {
  const payload = buildPackagePayload({
    id: "p1", // must be dropped — the web never writes id inside data
    created_date: "2026-01-01", // ditto for server-managed fields
    name: "Circa Stay",
    description: "Five nights",
    image_url: "https://img/x.jpg",
    booking_url: "https://book/x",
    booking_label: "Book Circa Rate",
    is_coming_soon: false,
    sort_order: "4", // inputs coerce with Number() on the web
  });
  assert.deepEqual(Object.keys(payload).sort(), [...TRAVEL_PACKAGE_FIELDS].sort());
  assert.equal(payload.sort_order, 4);
  assert.equal(payload.is_coming_soon, false);
  assert.ok(!("id" in payload) && !("created_date" in payload), "no invented or server fields in the write");
  const empty = buildPackagePayload(EMPTY_TRAVEL_PACKAGE);
  assert.deepEqual(empty, { ...EMPTY_TRAVEL_PACKAGE }, "creating from the empty draft sends the web's exact create payload");
  assert.equal(buildPackagePayload({ sort_order: "" }).sort_order, 1, "blank sort order falls back to 1, not NaN");
});

test("create guard mirrors the web: name required, nothing else", () => {
  assert.equal(canCreatePackage(EMPTY_TRAVEL_PACKAGE), false);
  assert.equal(canCreatePackage({ ...EMPTY_TRAVEL_PACKAGE, name: "Vegas" }), true);
  assert.equal(canCreatePackage({ name: "Vegas" }), true, "description/image stay optional (web parity)");
  assert.equal(canCreatePackage(null), false);
});

test("search filters name, description and booking label", () => {
  const packages = [
    { id: "1", name: "Circa Stay", description: "Fremont Street", booking_label: "Book Circa Rate" },
    { id: "2", name: "Allegiant Weekend", description: "Game-day shuttle" },
  ];
  assert.deepEqual(filterPackages(packages, "fremont").map((p) => p.id), ["1"]);
  assert.deepEqual(filterPackages(packages, "circa rate").map((p) => p.id), ["1"]);
  assert.deepEqual(filterPackages(packages, "shuttle").map((p) => p.id), ["2"]);
  assert.equal(filterPackages(packages, "").length, 2);
  assert.equal(filterPackages(null, "x").length, 0);
});

test("status badge follows the web is_coming_soon !== false rule", () => {
  assert.equal(packageStatusMeta({ is_coming_soon: true }).key, "coming_soon");
  assert.equal(packageStatusMeta({}).key, "coming_soon", "unset counts as coming soon (web parity)");
  assert.equal(packageStatusMeta({ is_coming_soon: false }).key, "available");
  assert.equal(descriptionPreview("a".repeat(120)).length, 101, "100 chars + ellipsis, like the web card");
  assert.equal(descriptionPreview("short"), "short");
});

// ── Wiring + safety contracts ───────────────────────────────────────────
test("travel workflow writes through the same entity + query key as the web", () => {
  const src = read("../src/native/admin/workflows/NativeTravelWorkflow.jsx");
  assert.ok(src.includes("TravelPackage.create"), "create goes through the entity");
  assert.ok(src.includes("TravelPackage.update"), "update goes through the entity");
  assert.ok(src.includes("TravelPackage.delete"), "delete goes through the entity");
  assert.ok(src.includes('TravelPackage.list("sort_order", 200)'), "same list query as the web wrapper");
  assert.ok(src.includes('queryKey: ["packages"]'), "shares the web cache key");
  assert.ok(src.includes('invalidateQueries({ queryKey: ["packages"] })'), "every write invalidates the shared key");
  assert.ok(src.includes("buildPackagePayload"), "all writes flow through the parity payload builder");
});

test("travel uploads reuse the web ImageField (same base44 upload call)", () => {
  const src = read("../src/native/admin/workflows/NativeTravelWorkflow.jsx");
  assert.ok(src.includes('from "@/components/admin/ImageField"'), "same upload control as the web manager");
  assert.ok(!src.includes("UploadFile"), "no duplicate upload path — ImageField owns the client call");
});

test("travel workflow invents no authority: no edge functions, storage or logs", () => {
  const src = read("../src/native/admin/workflows/NativeTravelWorkflow.jsx");
  assert.ok(!src.includes("functions.invoke"), "web manager calls no edge functions — native must not either");
  assert.ok(!src.includes("localStorage"), "module has no local config");
  assert.ok(!src.includes("emitAdminLog"), "web manager dispatches no rlt_admin_log events for travel");
  assert.ok(!/from ["']@capacitor/.test(src), "no static capacitor imports");
});

test("travel delete is confirmed, awaited and destructive-styled", () => {
  const src = read("../src/native/admin/workflows/NativeTravelWorkflow.jsx");
  assert.ok(src.includes("AdminConfirmSheet"), "delete goes through the confirm sheet");
  assert.ok(src.includes("deleteMutation.mutateAsync"), "confirm awaits settlement before navigating");
  assert.ok(src.includes('variant="destructive"'), "sheet is styled destructive");
  assert.ok(src.includes('emitHaptic("mutation.warning")'), "destructive intent haptic");
  assert.ok(src.includes('emitHaptic("save.success")') && src.includes('emitHaptic("mutation.error")'), "outcome haptics");
});

test("travel screens follow the native UX contract", () => {
  const src = read("../src/native/admin/workflows/NativeTravelWorkflow.jsx");
  assert.ok(!src.includes("group-hover:"), "no hover-only affordances");
  assert.ok(src.includes("useWindowedList"), "long lists are windowed");
  assert.ok(src.includes("restoreKey"), "window depth survives remounts for scroll restore");
  assert.ok(src.includes("NativeSkeleton") && src.includes("NativeEmptyState"), "loading + empty states");
  assert.ok(src.includes("NativeTopBar") && src.includes('fallback="/admin/content"'), "self-chromed with a hub fallback");
  assert.ok(src.includes("PullToRefresh"), "pull to refresh the shared query");
  assert.ok(src.includes("MobileActionDrawer"), "create form lives in a sheet");
  assert.ok(src.includes("/admin/content/travel/"), "list rows deep-link to the URL-addressable editor");
  assert.ok(src.includes("export function NativeTravelPackageDetail"), "detail screen is a named export for routing");
});
