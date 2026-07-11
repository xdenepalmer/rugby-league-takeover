import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  emptyPartnerDraft,
  canCreatePartner,
  sortPartners,
  buildPartnerCreatePayload,
  buildPartnerUpdatePayload,
  hasPartnerChanges,
} from "../src/native/admin/workflows/partners-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Create: draft + payload parity ───────────────────────────────────────
test("empty draft matches the web add-form seed (PartnersManager.emptyPartner)", () => {
  assert.deepEqual(emptyPartnerDraft(), {
    name: "",
    logo_url: "",
    url: "",
    description: "",
    sort_order: 1,
    is_published: true,
  });
});

test("create requires a name, like the web Add button", () => {
  assert.equal(canCreatePartner(emptyPartnerDraft()), false);
  assert.equal(canCreatePartner({ name: "Vegas Venue" }), true);
  assert.equal(canCreatePartner(null), false);
});

test("create payload carries the exact web six-field set", () => {
  const draft = {
    name: "Vegas Venue",
    logo_url: "https://cdn/logo.png",
    url: "https://venue.example",
    description: "Host venue",
    sort_order: 4,
    is_published: false,
  };
  const payload = buildPartnerCreatePayload(draft);
  // Web parity: Partner.create(draft) — the same six emptyPartner fields.
  assert.deepEqual(payload, draft);
  assert.deepEqual(
    Object.keys(payload).sort(),
    ["description", "is_published", "logo_url", "name", "sort_order", "url"]
  );
  const stringSort = buildPartnerCreatePayload({ ...draft, sort_order: "7" });
  assert.equal(stringSort.sort_order, 7, "sort_order is numeric, like the web input's Number coercion");
  assert.equal(buildPartnerCreatePayload({ name: "X" }).is_published, true, "unset published defaults on (Switch !== false semantics)");
});

// ── Ordering: numeric sort_order like the web manager ────────────────────
test("partners sort by numeric sort_order like the web manager", () => {
  const partners = [
    { id: "a", sort_order: 10 },
    { id: "b", sort_order: 2 },
    { id: "c" }, // missing → 0, sorts first (web: Number(sort_order || 0))
    { id: "d", sort_order: "3" }, // string coerced numerically, not lexically
  ];
  assert.deepEqual(sortPartners(partners).map((p) => p.id), ["c", "b", "d", "a"]);
  assert.deepEqual(partners.map((p) => p.id), ["a", "b", "c", "d"], "input array is not mutated (web copies before sorting)");
  assert.deepEqual(sortPartners(null), []);
});

// ── Update: only changed fields, same names/values the web writes ────────
test("update payload diffs against the record and writes web-shaped fields", () => {
  const partner = {
    id: "p1",
    name: "Old Venue",
    url: "https://old.example",
    description: "Old desc",
    logo_url: "https://cdn/old.png",
    sort_order: 2,
    is_published: true,
  };
  const unchanged = { name: "Old Venue", url: "https://old.example", description: "Old desc", logo_url: "https://cdn/old.png", sort_order: 2, is_published: true };
  assert.deepEqual(buildPartnerUpdatePayload(partner, unchanged), {});
  assert.equal(hasPartnerChanges(partner, unchanged), false);

  const edited = { ...unchanged, name: "New Venue", sort_order: "5", is_published: false };
  const payload = buildPartnerUpdatePayload(partner, edited);
  assert.deepEqual(payload, { name: "New Venue", sort_order: 5, is_published: false });
  assert.ok(!("url" in payload) && !("description" in payload) && !("logo_url" in payload), "untouched fields are not rewritten");
  assert.equal(hasPartnerChanges(partner, edited), true);

  const logoCleared = buildPartnerUpdatePayload(partner, { ...unchanged, logo_url: "" });
  assert.deepEqual(logoCleared, { logo_url: "" }, "clearing the logo writes an empty logo_url, like the web ImageField clear");
});

test("update baselines mirror the web editor defaults (blank text, sort_order 1)", () => {
  const bare = { id: "p2" }; // no name/url/description/logo_url/sort_order/is_published
  const seeded = { name: "", url: "", description: "", logo_url: "", sort_order: 1, is_published: true };
  assert.deepEqual(buildPartnerUpdatePayload(bare, seeded), {}, "seeding the form from a bare record is not a change");
  assert.deepEqual(buildPartnerUpdatePayload(bare, { ...seeded, is_published: false }), { is_published: false });
  assert.deepEqual(buildPartnerUpdatePayload(bare, { ...seeded, sort_order: 3 }), { sort_order: 3 });
  assert.deepEqual(buildPartnerUpdatePayload(bare, { ...seeded, url: "https://x.example" }), { url: "https://x.example" });
});

// ── Source contracts: entity writes, shared cache, no new authority ──────
test("native partners write through the same entity with shared payload builders", () => {
  const src = read("../src/native/admin/workflows/NativePartnersWorkflow.jsx");
  assert.ok(src.includes("Partner.create"), "create writes through the Partner entity");
  assert.ok(src.includes("Partner.update"), "update writes through the Partner entity");
  assert.ok(src.includes("Partner.delete"), "delete writes through the Partner entity");
  assert.ok(src.includes("buildPartnerCreatePayload"), "create goes through the shared payload builder");
  assert.ok(src.includes("buildPartnerUpdatePayload"), "update goes through the shared payload builder");
  assert.ok(src.includes('queryKey: ["partners"]'), "reads the same cache key as the web panels");
  assert.ok(src.includes('invalidateQueries({ queryKey: ["partners"] })'), "every write invalidates the web's key");
  assert.ok(!src.includes('invalidateQueries({ queryKey: ["adminAttention"] })'), "partners never feed the attention queue (web parity)");
});

test("logo uploads reuse the exact web upload mechanism", () => {
  const src = read("../src/native/admin/workflows/NativePartnersWorkflow.jsx");
  // The web ImageField uploads via base44.integrations.Core.UploadFile;
  // MediaUploader is the shared component wrapping that same client call.
  assert.ok(src.includes("MediaUploader"), "logo upload goes through the shared uploader");
  assert.ok(src.includes('accept="image/*"'), "logo uploads accept images only, like the web ImageField");
  const uploader = read("../src/components/admin/MediaUploader.jsx");
  assert.ok(uploader.includes("base44.integrations.Core.UploadFile"), "uploader uses the same client call the web ImageField uses");
  assert.ok(src.includes("logo_url"), "uploaded/pasted URLs land in logo_url, the web field");
});

test("native partners invent no new endpoints, storage or entities", () => {
  const src = read("../src/native/admin/workflows/NativePartnersWorkflow.jsx");
  const helpers = read("../src/native/admin/workflows/partners-helpers.js");
  for (const [name, code] of [["workflow", src], ["helpers", helpers]]) {
    assert.ok(!code.includes("functions.invoke"), `${name}: the web PartnersManager calls no edge functions`);
    assert.ok(!code.includes("localStorage"), `${name}: partners never touch localStorage`);
    assert.ok(!code.includes("rlt_admin_log"), `${name}: the web PartnersManager emits no admin-log events, so neither do we`);
    assert.ok(!/from ["']@capacitor/.test(code), `${name}: no static capacitor imports`);
  }
  assert.ok(!helpers.includes("UploadFile") && !helpers.includes("integrations"), "helpers stay pure — no upload client");
  const entityWrites = src.match(/base44\.entities\.(\w+)\./g) || [];
  assert.ok(entityWrites.length > 0 && entityWrites.every((m) => m.includes(".Partner.")), "only the Partner entity is touched");
});

test("destructive delete is confirmed and dialogs await settlement", () => {
  const src = read("../src/native/admin/workflows/NativePartnersWorkflow.jsx");
  assert.ok(src.includes("AdminConfirmSheet"), "delete goes through the confirm sheet");
  assert.ok(src.includes('variant="destructive"'), "delete confirm is styled destructive");
  assert.ok(src.includes("deleteMutation.mutateAsync"), "delete awaits settlement before navigating away");
  assert.ok(src.includes("createMutation.mutateAsync"), "add drawer awaits settlement before closing");
  assert.ok(src.includes("updateMutation.mutateAsync"), "save awaits settlement before clearing the draft");
  assert.ok(src.includes("MobileActionDrawer"), "the add form lives in the house drawer");
});

test("native partners UX contract: haptics, skeletons, windowing, no hover-only", () => {
  const src = read("../src/native/admin/workflows/NativePartnersWorkflow.jsx");
  assert.ok(!src.includes("group-hover:"), "no actions hidden behind hover");
  assert.ok(src.includes("NativeSkeleton"), "loading shows skeletons");
  assert.ok(src.includes("NativeEmptyState"), "empty list shows the empty state");
  assert.ok(src.includes("useWindowedList"), "long lists render windowed");
  assert.ok(src.includes("restoreKey"), "windowing remembers depth for scroll restoration");
  assert.ok(src.includes("PullToRefresh"), "list refreshes natively");
  assert.ok(src.includes("NativeTopBar"), "self-chromed with a top bar");
  assert.ok(src.includes('fallback="/admin/content"'), "top bar falls back to the content hub");
  for (const event of ["tab.select", "action.primary", "mutation.warning", "save.success", "mutation.error"]) {
    assert.ok(src.includes(`"${event}"`), `emits ${event} haptic`);
  }
});
