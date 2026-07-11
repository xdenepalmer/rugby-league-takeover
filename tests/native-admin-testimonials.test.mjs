import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  RATING_OPTIONS,
  ratingLabel,
  isPendingTestimonial,
  sortTestimonials,
  pendingTestimonialCount,
  TESTIMONIAL_QUEUES,
  testimonialQueue,
  testimonialQueueCounts,
  emptyTestimonialDraft,
  canCreateTestimonial,
  buildTestimonialCreatePayload,
  buildTestimonialUpdatePayload,
  hasTestimonialChanges,
  buildApproveTestimonialPayload,
} from "../src/native/admin/workflows/testimonials-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Publish queue: pending floats first, same predicate as the web ───────
test("pending testimonials float above published, then sort_order (web parity)", () => {
  const list = [
    { id: "a", is_published: true, sort_order: 1 },
    { id: "b", is_published: false, sort_order: 9 }, // visitor submission
    { id: "c", sort_order: 2 }, // legacy row, no flag → published (only === false is pending)
    { id: "d", is_published: false, sort_order: 3 },
  ];
  assert.deepEqual(sortTestimonials(list).map((t) => t.id), ["d", "b", "a", "c"]);
  assert.equal(pendingTestimonialCount(list), 2, "pending badge counts is_published === false only");
  assert.equal(isPendingTestimonial({ is_published: false }), true);
  assert.equal(isPendingTestimonial({}), false, "unset flag is NOT pending — exactly the web's === false check");
  assert.equal(isPendingTestimonial({ is_published: true }), false);
});

test("web manager still floats pending with the same === false predicate", () => {
  const web = read("../src/components/admin/TestimonialsManager.jsx");
  assert.ok(web.includes("a.is_published === false ? 0 : 1"), "web pending-first sort unchanged");
  assert.ok(web.includes('t.is_published === false'), "web pending predicate unchanged");
});

test("native queue chips are read-side cuts of the same rule", () => {
  const list = [
    { id: "a", is_published: true, sort_order: 2 },
    { id: "b", is_published: false, sort_order: 1 },
    { id: "c", sort_order: 1 },
  ];
  assert.deepEqual(TESTIMONIAL_QUEUES.map((q) => q.key), ["pending", "live", "all"]);
  assert.deepEqual(testimonialQueue(list, "pending").map((t) => t.id), ["b"]);
  assert.deepEqual(testimonialQueue(list, "live").map((t) => t.id), ["c", "a"]);
  assert.deepEqual(testimonialQueue(list, "all").map((t) => t.id), ["b", "c", "a"], "All keeps the web's combined pending-first order");
  assert.deepEqual(testimonialQueueCounts(list), { pending: 1, live: 2, all: 3 });
});

test("sort_order compares numerically like the web (Number(sort_order || 0))", () => {
  const list = [
    { id: "a", sort_order: 10 },
    { id: "b", sort_order: 2 },
    { id: "c" }, // missing → 0, sorts first
    { id: "d", sort_order: "3" }, // string coerced numerically, not lexically
  ];
  assert.deepEqual(sortTestimonials(list).map((t) => t.id), ["c", "b", "d", "a"]);
});

// ── Create: draft + payload parity ───────────────────────────────────────
test("empty draft matches the web add-form seed (emptyTestimonial)", () => {
  assert.deepEqual(emptyTestimonialDraft(), {
    author_name: "",
    author_role: "",
    quote: "",
    avatar_url: "",
    rating: 5,
    sort_order: 1,
    is_published: true,
  });
});

test("rating options mirror the web select (0 hides stars)", () => {
  assert.deepEqual(RATING_OPTIONS, [0, 1, 2, 3, 4, 5]);
  assert.equal(ratingLabel(0), "No stars");
  assert.equal(ratingLabel(5), "5 ★");
  assert.equal(ratingLabel(undefined), "No stars", "unset rating renders like the web's String(rating ?? 0)");
});

test("create requires a name AND a quote, like the web Add button", () => {
  assert.equal(canCreateTestimonial(emptyTestimonialDraft()), false);
  assert.equal(canCreateTestimonial({ author_name: "Jacko" }), false);
  assert.equal(canCreateTestimonial({ quote: "Best weekend ever" }), false);
  assert.equal(canCreateTestimonial({ author_name: "Jacko", quote: "Best weekend ever" }), true);
  assert.equal(canCreateTestimonial(null), false);
});

test("create payload carries the exact seven web fields", () => {
  const draft = {
    author_name: "Jacko",
    author_role: "Eels fan · Sydney",
    quote: "Best weekend ever",
    avatar_url: "https://x/y.jpg",
    rating: 4,
    sort_order: 3,
    is_published: false,
  };
  const payload = buildTestimonialCreatePayload(draft);
  // Web parity: Testimonial.create(draft) — the emptyTestimonial field set.
  assert.deepEqual(payload, {
    author_name: "Jacko",
    author_role: "Eels fan · Sydney",
    quote: "Best weekend ever",
    avatar_url: "https://x/y.jpg",
    rating: 4,
    sort_order: 3,
    is_published: false,
  });
  assert.deepEqual(
    Object.keys(payload).sort(),
    ["author_name", "author_role", "avatar_url", "is_published", "quote", "rating", "sort_order"],
    "no invented fields"
  );
  const coerced = buildTestimonialCreatePayload({ ...draft, rating: "2", sort_order: "7" });
  assert.equal(coerced.rating, 2, "rating is numeric, like the web select's Number(v)");
  assert.equal(coerced.sort_order, 7, "sort_order is numeric, like the web input's Number coercion");
  assert.equal(buildTestimonialCreatePayload({ author_name: "A", quote: "Q" }).is_published, true, "unset published defaults on (Switch !== false semantics)");
});

// ── Update: only changed fields, same names/values the web writes ────────
test("update payload diffs against the record and writes web-shaped fields", () => {
  const t = {
    id: "t1",
    author_name: "Jacko",
    author_role: "Eels fan",
    quote: "Old quote",
    avatar_url: "",
    rating: 5,
    sort_order: 2,
    is_published: true,
  };
  const unchanged = { author_name: "Jacko", author_role: "Eels fan", quote: "Old quote", avatar_url: "", rating: 5, sort_order: 2, is_published: true };
  assert.deepEqual(buildTestimonialUpdatePayload(t, unchanged), {});
  assert.equal(hasTestimonialChanges(t, unchanged), false);

  const edited = { ...unchanged, quote: "New quote", rating: "3", sort_order: "5", is_published: false };
  const payload = buildTestimonialUpdatePayload(t, edited);
  assert.deepEqual(payload, { quote: "New quote", rating: 3, sort_order: 5, is_published: false });
  assert.ok(!("author_name" in payload), "untouched fields are not rewritten");
  assert.equal(hasTestimonialChanges(t, edited), true);

  const avatarOnly = buildTestimonialUpdatePayload(t, { ...unchanged, avatar_url: "https://x/a.jpg" });
  assert.deepEqual(avatarOnly, { avatar_url: "https://x/a.jpg" }, "avatar writes the same avatar_url field the web ImageField commits");
});

test("update baselines mirror the web editor defaults (blank text, sort 1, rating 0)", () => {
  const bare = { id: "t2" }; // no fields set
  const seeded = { author_name: "", author_role: "", quote: "", avatar_url: "", rating: 0, sort_order: 1, is_published: true };
  assert.deepEqual(buildTestimonialUpdatePayload(bare, seeded), {}, "seeding the form from a bare record is not a change");
  assert.deepEqual(buildTestimonialUpdatePayload(bare, { ...seeded, is_published: false }), { is_published: false });
  assert.deepEqual(buildTestimonialUpdatePayload(bare, { ...seeded, rating: 4 }), { rating: 4 });
});

test("approve writes exactly { is_published: true }, like the web Approve button", () => {
  assert.deepEqual(buildApproveTestimonialPayload(), { is_published: true });
});

// ── Source contracts: entity writes, shared cache, no new authority ──────
test("native testimonials write through the same entity with shared payload builders", () => {
  const src = read("../src/native/admin/workflows/NativeTestimonialsWorkflow.jsx");
  assert.ok(src.includes("Testimonial.create"), "create writes through the Testimonial entity");
  assert.ok(src.includes("Testimonial.update"), "update writes through the Testimonial entity");
  assert.ok(src.includes("Testimonial.delete"), "delete writes through the Testimonial entity");
  assert.ok(src.includes("buildTestimonialCreatePayload"), "create goes through the shared payload builder");
  assert.ok(src.includes("buildTestimonialUpdatePayload"), "update goes through the shared payload builder");
  assert.ok(src.includes("buildApproveTestimonialPayload"), "approve goes through the shared payload builder");
  assert.ok(src.includes('queryKey: ["testimonials"]'), "reads the same cache key as the web panels");
  assert.ok(src.includes('invalidateQueries({ queryKey: ["testimonials"] })'), "every write invalidates the web's key");
  assert.ok(!src.includes('invalidateQueries({ queryKey: ["adminAttention"] })'), "testimonials never feed the attention queue (web parity)");
});

test("avatar upload reuses the exact web ImageField client call", () => {
  const src = read("../src/native/admin/workflows/NativeTestimonialsWorkflow.jsx");
  const web = read("../src/components/admin/ImageField.jsx");
  assert.ok(web.includes("base44.integrations.Core.UploadFile({ file })"), "web upload mechanism unchanged");
  assert.ok(src.includes("base44.integrations.Core.UploadFile({ file })"), "native upload uses the same client call");
  assert.ok(src.includes("avatar_url"), "upload commits to the same avatar_url field");
});

test("native testimonials invent no new endpoints, storage or entities", () => {
  const src = read("../src/native/admin/workflows/NativeTestimonialsWorkflow.jsx");
  const helpers = read("../src/native/admin/workflows/testimonials-helpers.js");
  for (const [name, code] of [["workflow", src], ["helpers", helpers]]) {
    assert.ok(!code.includes("functions.invoke"), `${name}: the web TestimonialsManager calls no edge functions`);
    assert.ok(!code.includes("localStorage"), `${name}: testimonials never touch localStorage`);
    assert.ok(!code.includes("rlt_admin_log"), `${name}: the web TestimonialsManager emits no admin-log events, so neither do we`);
    assert.ok(!/from ["']@capacitor/.test(code), `${name}: no static capacitor imports`);
  }
  const entityWrites = src.match(/base44\.entities\.(\w+)\./g) || [];
  assert.ok(entityWrites.every((m) => m.includes(".Testimonial.")), "only the Testimonial entity is touched");
});

test("destructive delete is confirmed and dialogs await settlement", () => {
  const src = read("../src/native/admin/workflows/NativeTestimonialsWorkflow.jsx");
  assert.ok(src.includes("AdminConfirmSheet"), "delete goes through the confirm sheet");
  assert.ok(src.includes('variant="destructive"'), "delete confirm is styled destructive");
  assert.ok(src.includes("deleteMutation.mutateAsync"), "delete awaits settlement before navigating away");
  assert.ok(src.includes("createMutation.mutateAsync"), "add drawer awaits settlement before closing");
  assert.ok(src.includes("updateMutation.mutateAsync"), "save/approve await settlement before clearing the draft");
  assert.ok(src.includes("MobileActionDrawer"), "the add form lives in the house drawer");
});

test("native testimonials UX contract: haptics, skeletons, windowing, no hover-only", () => {
  const src = read("../src/native/admin/workflows/NativeTestimonialsWorkflow.jsx");
  assert.ok(!src.includes("group-hover:"), "no actions hidden behind hover");
  assert.ok(src.includes("NativeSkeleton"), "loading shows skeletons");
  assert.ok(src.includes("NativeEmptyState"), "empty queue shows the empty state");
  assert.ok(src.includes("useWindowedList"), "long lists render windowed");
  assert.ok(src.includes("restoreKey"), "windowing remembers depth for scroll restoration");
  assert.ok(src.includes("PullToRefresh"), "list refreshes natively");
  assert.ok(src.includes("NativeTopBar"), "self-chromed with a top bar");
  assert.ok(src.includes('fallback="/admin/content"'), "top bar falls back to the content hub");
  for (const event of ["tab.select", "action.primary", "mutation.warning", "save.success", "mutation.error"]) {
    assert.ok(src.includes(`"${event}"`), `emits ${event} haptic`);
  }
});

test("pending submissions surface their submitter and an approve affordance", () => {
  const src = read("../src/native/admin/workflows/NativeTestimonialsWorkflow.jsx");
  assert.ok(src.includes("user_email"), "shows the visitor's email on pending rows (web parity)");
  assert.ok(src.includes("Pending review"), "pending banner mirrors the web wording");
  assert.ok(src.includes("Approve"), "approve action is present");
  assert.ok(src.includes("isPendingTestimonial"), "pending state uses the shared predicate");
});
