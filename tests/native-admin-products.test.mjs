import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LOW_STOCK,
  EMPTY_PRODUCT,
  PRODUCT_FILTERS,
  stockStatus,
  productCounts,
  filterProducts,
  productFilterCounts,
  toNumberField,
  toDimensionField,
  normalizeSizeVariant,
  addSizeVariant,
  setSizeVariant,
  removeSizeVariant,
  canCreateProduct,
} from "../src/native/admin/workflows/products-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Create-draft shape parity ────────────────────────────────────────────
test("EMPTY_PRODUCT is byte-compatible with the web emptyProduct shape", () => {
  assert.deepEqual(EMPTY_PRODUCT, {
    name: "",
    description: "",
    details: "",
    image_url: "",
    image_url_2: "",
    price_aud: 0,
    stock_quantity: 0,
    sizes: [],
    is_active: true,
    sort_order: 1,
    weight_grams: 300,
    length_cm: null,
    width_cm: null,
    height_cm: null,
  });
  // Every field of the native draft must exist in the web manager's source —
  // the native create can never invent a field the web doesn't write.
  const web = read("../src/components/admin/ProductsManager.jsx");
  for (const field of Object.keys(EMPTY_PRODUCT)) {
    assert.ok(web.includes(field), `web ProductsManager writes ${field}`);
  }
});

test("create requires a name, exactly like the web disabled state", () => {
  assert.equal(canCreateProduct(EMPTY_PRODUCT), false);
  assert.equal(canCreateProduct({ ...EMPTY_PRODUCT, name: "Takeover Tee" }), true);
  assert.equal(canCreateProduct(null), false);
});

// ── Stock rules mirror the web badge + header math ───────────────────────
test("stock badge thresholds mirror the web (out ≤ 0 < low ≤ 5 < in)", () => {
  assert.equal(LOW_STOCK, 5);
  assert.equal(stockStatus(0).key, "out");
  assert.equal(stockStatus(-2).key, "out");
  assert.equal(stockStatus("abc").key, "out", "non-numeric stock reads as out (web parity)");
  assert.equal(stockStatus(null).key, "out");
  assert.equal(stockStatus(1).key, "low");
  assert.equal(stockStatus(5).key, "low");
  assert.equal(stockStatus(6).key, "in");
  assert.match(stockStatus(3).label, /Low · 3 left/);
  assert.match(stockStatus(12).label, /12 in stock/);
});

test("header counts mirror the web active/low/out computations", () => {
  const products = [
    { id: "1", stock_quantity: 10 }, // active (is_active undefined ⇒ active), in stock
    { id: "2", stock_quantity: 3, is_active: true }, // low
    { id: "3", stock_quantity: 0, is_active: false }, // hidden, out
    { id: "4", stock_quantity: "nope" }, // out (web: !(Number > 0))
  ];
  assert.deepEqual(productCounts(products), { total: 4, active: 3, low: 1, out: 2 });
  assert.deepEqual(productCounts([]), { total: 0, active: 0, low: 0, out: 0 });
});

// ── Native list facets (read-only; no write impact) ──────────────────────
test("product filters slice by active/hidden/stock and search name/description", () => {
  const products = [
    { id: "1", name: "Takeover Tee", description: "Black tee", stock_quantity: 10 },
    { id: "2", name: "Cap", details: "Snapback", stock_quantity: 2, is_active: true },
    { id: "3", name: "Old Hoodie", stock_quantity: 0, is_active: false },
  ];
  assert.deepEqual(PRODUCT_FILTERS.map((f) => f.key), ["all", "active", "hidden", "low", "out"]);
  assert.deepEqual(filterProducts(products, { filter: "active" }).map((p) => p.id), ["1", "2"]);
  assert.deepEqual(filterProducts(products, { filter: "hidden" }).map((p) => p.id), ["3"]);
  assert.deepEqual(filterProducts(products, { filter: "low" }).map((p) => p.id), ["2"]);
  assert.deepEqual(filterProducts(products, { filter: "out" }).map((p) => p.id), ["3"]);
  assert.deepEqual(filterProducts(products, { query: "black" }).map((p) => p.id), ["1"]);
  assert.deepEqual(filterProducts(products, { query: "snapback" }).map((p) => p.id), ["2"], "details are searchable");
  assert.deepEqual(filterProducts(products, { query: "tee", filter: "hidden" }), [], "facet and query compose");
  assert.deepEqual(productFilterCounts(products), { all: 3, active: 2, hidden: 1, low: 1, out: 1 });
});

// ── Field coercion parity with the web inputs ────────────────────────────
test("numeric fields coerce exactly like the web inputs (Number(value))", () => {
  assert.equal(toNumberField("29.95"), 29.95);
  assert.equal(toNumberField(""), 0, "cleared number input records 0, same as the web's Number('')");
  assert.equal(toDimensionField(""), null, "cleared dimension records null (web parity)");
  assert.equal(toDimensionField(null), null);
  assert.equal(toDimensionField(undefined), null);
  assert.equal(toDimensionField("22"), 22);
  assert.equal(toDimensionField(0), 0, "an explicit 0 dimension stays 0, not null");
});

// ── Size variants: shape + immutable ops ─────────────────────────────────
test("legacy string sizes widen to { size, stock_quantity } like the web editor", () => {
  assert.deepEqual(normalizeSizeVariant("M"), { size: "M", stock_quantity: 0 });
  assert.deepEqual(normalizeSizeVariant({ size: "L", stock_quantity: 4 }), { size: "L", stock_quantity: 4 });
  assert.deepEqual(normalizeSizeVariant(undefined), { size: "", stock_quantity: 0 });
});

test("size-row operations are immutable and write the web's variant shape", () => {
  const original = [{ size: "S", stock_quantity: 2 }];
  const added = addSizeVariant(original);
  assert.deepEqual(added, [{ size: "S", stock_quantity: 2 }, { size: "", stock_quantity: 0 }]);
  assert.equal(original.length, 1, "source array untouched");

  const edited = setSizeVariant(added, 1, { size: "M" });
  assert.deepEqual(edited[1], { size: "M", stock_quantity: 0 });
  const restocked = setSizeVariant(edited, 0, { stock_quantity: 9 });
  assert.deepEqual(restocked[0], { size: "S", stock_quantity: 9 });

  const legacy = setSizeVariant(["XL"], 0, { stock_quantity: 3 });
  assert.deepEqual(legacy[0], { size: "XL", stock_quantity: 3 }, "editing a legacy string widens it");

  assert.deepEqual(removeSizeVariant(added, 1), [{ size: "S", stock_quantity: 2 }]);
  assert.deepEqual(addSizeVariant(null), [{ size: "", stock_quantity: 0 }], "null sizes tolerated");
});

// ── Source contracts: write authority, cache and UX parity ───────────────
test("native products workflow writes through the same entity calls as the web", () => {
  const native = read("../src/native/admin/workflows/NativeProductsWorkflow.jsx");
  assert.ok(native.includes("base44.entities.Product.create"), "create through the entity");
  assert.ok(native.includes("base44.entities.Product.update"), "update through the entity");
  assert.ok(native.includes("base44.entities.Product.delete"), "delete through the entity");
  assert.ok(native.includes('queryKey: ["products"]'), "same query key as the web wrapper (shared cache)");
  assert.ok(native.includes('invalidateQueries({ queryKey: ["products"] })'), "invalidates the same key the web invalidates");
  assert.ok(!native.includes("functions.invoke"), "products has no edge-function calls (web parity)");
});

test("uploads reuse the exact client call the web ImageField uses", () => {
  const native = read("../src/native/admin/workflows/NativeProductsWorkflow.jsx");
  const webField = read("../src/components/admin/ImageField.jsx");
  assert.ok(webField.includes("base44.integrations.Core.UploadFile({ file })"), "web upload mechanism unchanged");
  assert.ok(native.includes("base44.integrations.Core.UploadFile({ file })"), "native uploads through the same call");
});

test("no invented audit events: the web ProductsManager dispatches none", () => {
  const web = read("../src/components/admin/ProductsManager.jsx");
  const native = read("../src/native/admin/workflows/NativeProductsWorkflow.jsx");
  assert.ok(!web.includes("rlt_admin_log") && !web.includes("emitAdminLog"), "web dispatches no product audit events");
  // The native file may MENTION the bus in comments, but must not emit on it.
  assert.ok(!native.includes("emitAdminLog") && !native.includes("dispatchEvent"), "native matches: same (empty) event set");
});

test("destructive delete is confirmed and dialogs await via mutateAsync", () => {
  const native = read("../src/native/admin/workflows/NativeProductsWorkflow.jsx");
  assert.ok(native.includes("AdminConfirmSheet"), "delete goes through the confirm sheet");
  assert.ok(native.includes("Delete this product?"), "same confirm title as the web");
  assert.ok(native.includes("This permanently removes the product from the store."), "same confirm copy as the web");
  assert.ok(native.includes("deleteMutation.mutateAsync"), "delete sheet awaits settlement");
  assert.ok(native.includes("createMutation.mutateAsync"), "create drawer awaits settlement");
});

test("toast copy matches the web manager verbatim", () => {
  const native = read("../src/native/admin/workflows/NativeProductsWorkflow.jsx");
  for (const title of ["Product added", "Product saved", "Product removed", "Failed to create product", "Failed to save product", "Failed to delete product"]) {
    assert.ok(native.includes(`"${title}"`), `native keeps the web toast: ${title}`);
  }
});

test("native products UX contracts: windowing, haptics, no hover-only affordances", () => {
  const native = read("../src/native/admin/workflows/NativeProductsWorkflow.jsx");
  assert.ok(native.includes("useWindowedList"), "long lists are windowed");
  assert.ok(native.includes('restoreKey: "admin-products"'), "window depth survives remounts for scroll restore");
  assert.ok(native.includes("emitHaptic"), "haptics on primary actions");
  for (const event of ["tab.select", "action.primary", "mutation.warning", "save.success", "mutation.error"]) {
    assert.ok(native.includes(`"${event}"`), `haptic event ${event} used`);
  }
  assert.ok(!native.includes("group-hover:"), "no hover-only affordances");
  assert.ok(!/from ["']@capacitor/.test(native), "no static @capacitor imports");
  assert.ok(native.includes("NativeEmptyState") && native.includes("NativeSkeleton"), "empty + loading states");
  assert.ok(native.includes("PullToRefresh"), "pull to refresh the products query");
  assert.ok(native.includes("canCreateProduct"), "create button gated by the shared rule");
});
