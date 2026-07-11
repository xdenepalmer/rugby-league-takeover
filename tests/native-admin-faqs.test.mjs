import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FAQ_SCOPES,
  faqScope,
  faqsForScope,
  faqScopeCounts,
  emptyFaqDraft,
  canCreateFaq,
  buildFaqCreatePayload,
  buildFaqUpdatePayload,
  hasFaqChanges,
} from "../src/native/admin/workflows/faqs-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Scopes: mirror the web FaqManager exactly ────────────────────────────
test("faq scopes mirror the web manager (store + general, legacy → store)", () => {
  assert.deepEqual(FAQ_SCOPES.map((s) => s.key), ["store", "general"]);
  const faqs = [
    { id: "1", category: "store" },
    { id: "2" }, // legacy row with no category — the old default was store
    { id: "3", category: "general" },
    { id: "4", category: "" }, // empty string is falsy → store, like the web predicate
  ];
  assert.deepEqual(faqsForScope(faqs, "store").map((f) => f.id), ["1", "2", "4"]);
  assert.deepEqual(faqsForScope(faqs, "general").map((f) => f.id), ["3"]);
  assert.deepEqual(faqScopeCounts(faqs), { store: 3, general: 1 });
  assert.equal(faqScope("nonsense").key, "store", "unknown scope falls back to store (web parity)");
});

test("scope predicates are byte-compatible with the web SCOPES", () => {
  const web = read("../src/components/admin/FaqManager.jsx");
  assert.ok(web.includes('f.category === "store" || !f.category'), "web store predicate unchanged");
  assert.ok(web.includes('f.category === "general"'), "web general predicate unchanged");
  // Same rows must land in the same scope on both surfaces.
  const legacy = { category: undefined };
  assert.equal(FAQ_SCOPES[0].matches(legacy), true);
  assert.equal(FAQ_SCOPES[1].matches(legacy), false);
});

test("scope lists sort by numeric sort_order like the web manager", () => {
  const faqs = [
    { id: "a", category: "store", sort_order: 10 },
    { id: "b", category: "store", sort_order: 2 },
    { id: "c", category: "store" }, // missing → 0, sorts first (web: Number(sort_order || 0))
    { id: "d", category: "store", sort_order: "3" }, // string coerced numerically, not lexically
  ];
  assert.deepEqual(faqsForScope(faqs, "store").map((f) => f.id), ["c", "b", "d", "a"]);
});

// ── Create: draft + payload parity ───────────────────────────────────────
test("empty draft matches the web add-form seed", () => {
  assert.deepEqual(emptyFaqDraft("general"), {
    question: "",
    answer: "",
    category: "general",
    sort_order: 1,
    is_published: true,
  });
  assert.equal(emptyFaqDraft().category, "store", "default category is store (web default prop)");
});

test("create requires a question, like the web Add button", () => {
  assert.equal(canCreateFaq(emptyFaqDraft()), false);
  assert.equal(canCreateFaq({ question: "How do returns work?" }), true);
  assert.equal(canCreateFaq(null), false);
});

test("create payload carries the exact web field set and forces the scope's category", () => {
  const draft = { question: "Q?", answer: "A.", category: "store", sort_order: 4, is_published: false };
  const payload = buildFaqCreatePayload(draft, "general");
  // Web parity: Faq.create({ ...draft, category }) — same five fields, and
  // the manager's category prop always overrides whatever the draft held.
  assert.deepEqual(payload, { question: "Q?", answer: "A.", sort_order: 4, is_published: false, category: "general" });
  assert.deepEqual(Object.keys(payload).sort(), ["answer", "category", "is_published", "question", "sort_order"]);
  const stringSort = buildFaqCreatePayload({ ...draft, sort_order: "7" }, "store");
  assert.equal(stringSort.sort_order, 7, "sort_order is numeric, like the web input's Number coercion");
  assert.equal(buildFaqCreatePayload({ question: "Q" }, "store").is_published, true, "unset published defaults on (Switch !== false semantics)");
});

// ── Update: only changed fields, same names/values the web writes ────────
test("update payload diffs against the record and writes web-shaped fields", () => {
  const faq = { id: "f1", question: "Old?", answer: "Old.", sort_order: 2, is_published: true, category: "store" };
  const unchanged = { question: "Old?", answer: "Old.", sort_order: 2, is_published: true };
  assert.deepEqual(buildFaqUpdatePayload(faq, unchanged), {});
  assert.equal(hasFaqChanges(faq, unchanged), false);

  const edited = { question: "New?", answer: "Old.", sort_order: "5", is_published: false };
  const payload = buildFaqUpdatePayload(faq, edited);
  assert.deepEqual(payload, { question: "New?", sort_order: 5, is_published: false });
  assert.ok(!("answer" in payload), "untouched fields are not rewritten");
  assert.ok(!("category" in payload), "category is never rewritten by the editor (web parity)");
  assert.equal(hasFaqChanges(faq, edited), true);
});

test("update baselines mirror the web editor defaults (blank text, sort_order 1)", () => {
  const bare = { id: "f2", category: "store" }; // no question/answer/sort_order/is_published
  const seeded = { question: "", answer: "", sort_order: 1, is_published: true };
  assert.deepEqual(buildFaqUpdatePayload(bare, seeded), {}, "seeding the form from a bare record is not a change");
  assert.deepEqual(buildFaqUpdatePayload(bare, { ...seeded, is_published: false }), { is_published: false });
  assert.deepEqual(buildFaqUpdatePayload(bare, { ...seeded, sort_order: 3 }), { sort_order: 3 });
});

// ── Source contracts: entity writes, shared cache, no new authority ──────
test("native faqs write through the same entity with shared payload builders", () => {
  const src = read("../src/native/admin/workflows/NativeFaqsWorkflow.jsx");
  assert.ok(src.includes("Faq.create"), "create writes through the Faq entity");
  assert.ok(src.includes("Faq.update"), "update writes through the Faq entity");
  assert.ok(src.includes("Faq.delete"), "delete writes through the Faq entity");
  assert.ok(src.includes("buildFaqCreatePayload"), "create goes through the shared payload builder");
  assert.ok(src.includes("buildFaqUpdatePayload"), "update goes through the shared payload builder");
  assert.ok(src.includes('queryKey: ["faqs"]'), "reads the same cache key as the web panels");
  assert.ok(src.includes('invalidateQueries({ queryKey: ["faqs"] })'), "every write invalidates the web's key");
  assert.ok(!src.includes("invalidateQueries({ queryKey: [\"adminAttention\"] })"), "faqs never feed the attention queue (web parity)");
});

test("native faqs invent no new endpoints, storage or entities", () => {
  const src = read("../src/native/admin/workflows/NativeFaqsWorkflow.jsx");
  const helpers = read("../src/native/admin/workflows/faqs-helpers.js");
  for (const [name, code] of [["workflow", src], ["helpers", helpers]]) {
    assert.ok(!code.includes("functions.invoke"), `${name}: the web FaqManager calls no edge functions`);
    assert.ok(!code.includes("localStorage"), `${name}: faqs never touch localStorage`);
    assert.ok(!code.includes("UploadFile") && !code.includes("integrations"), `${name}: no uploads in this module`);
    assert.ok(!code.includes("rlt_admin_log"), `${name}: the web FaqManager emits no admin-log events, so neither do we`);
    assert.ok(!/from ["']@capacitor/.test(code), `${name}: no static capacitor imports`);
  }
  const entityWrites = src.match(/base44\.entities\.(\w+)\./g) || [];
  assert.ok(entityWrites.every((m) => m.includes(".Faq.")), "only the Faq entity is touched");
});

test("destructive delete is confirmed and dialogs await settlement", () => {
  const src = read("../src/native/admin/workflows/NativeFaqsWorkflow.jsx");
  assert.ok(src.includes("AdminConfirmSheet"), "delete goes through the confirm sheet");
  assert.ok(src.includes('variant="destructive"'), "delete confirm is styled destructive");
  assert.ok(src.includes("deleteMutation.mutateAsync"), "delete awaits settlement before navigating away");
  assert.ok(src.includes("createMutation.mutateAsync"), "add drawer awaits settlement before closing");
  assert.ok(src.includes("updateMutation.mutateAsync"), "save awaits settlement before clearing the draft");
  assert.ok(src.includes("MobileActionDrawer"), "the add form lives in the house drawer");
});

test("native faqs UX contract: haptics, skeletons, windowing, no hover-only", () => {
  const src = read("../src/native/admin/workflows/NativeFaqsWorkflow.jsx");
  assert.ok(!src.includes("group-hover:"), "no actions hidden behind hover");
  assert.ok(src.includes("NativeSkeleton"), "loading shows skeletons");
  assert.ok(src.includes("NativeEmptyState"), "empty scope shows the empty state");
  assert.ok(src.includes("useWindowedList"), "long lists render windowed");
  assert.ok(src.includes("restoreKey"), "windowing remembers depth for scroll restoration");
  assert.ok(src.includes("PullToRefresh"), "list refreshes natively");
  assert.ok(src.includes("NativeTopBar"), "self-chromed with a top bar");
  assert.ok(src.includes('fallback="/admin/content"'), "top bar falls back to the content hub");
  for (const event of ["tab.select", "action.primary", "mutation.warning", "save.success", "mutation.error"]) {
    assert.ok(src.includes(`"${event}"`), `emits ${event} haptic`);
  }
});
