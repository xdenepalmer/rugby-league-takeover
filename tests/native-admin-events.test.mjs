import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  emptyEvent,
  emptyTicket,
  isEventPublished,
  isEventComingSoon,
  canCreateEvent,
  sortEvents,
  eventCounts,
  updateTicket,
  addTicket,
  removeTicket,
  addPhoto,
  removePhoto,
} from "../src/native/admin/workflows/events-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Create drafts: byte-parity with the web EventsManager ────────────────
test("empty event draft mirrors the web emptyEvent field for field", () => {
  const draft = emptyEvent();
  assert.deepEqual(draft, {
    title: "",
    event_date: "",
    start_time: "",
    location: "",
    address: "",
    blurb: "",
    ticket_url: "",
    tickets: [],
    photo_urls: [],
    is_coming_soon: true,
    is_published: true,
    sort_order: 1,
  });
});

test("empty ticket tier mirrors the web emptyTicket, note field included", () => {
  // `note` has no input on either surface but is part of the stored shape —
  // new tiers must carry the identical field set the web writes.
  assert.deepEqual(emptyTicket(), { name: "", price_aud: 0, url: "", note: "", sold_out: false });
});

test("create is gated on a title, exactly like the web button", () => {
  assert.equal(canCreateEvent(emptyEvent()), false);
  assert.equal(canCreateEvent({ ...emptyEvent(), title: "Pre-Game Party" }), true);
  assert.equal(canCreateEvent(null), false);
});

// ── Published / coming-soon rules ────────────────────────────────────────
test("published unless explicitly false (web rule: is_published !== false)", () => {
  assert.equal(isEventPublished({ is_published: true }), true);
  assert.equal(isEventPublished({}), true, "legacy events without the flag count as published");
  assert.equal(isEventPublished({ is_published: false }), false);
});

test("coming-soon switch reads is_coming_soon !== false (web rule)", () => {
  assert.equal(isEventComingSoon({ is_coming_soon: true }), true);
  assert.equal(isEventComingSoon({}), true, "unset flag reads as coming soon, like the web switch");
  assert.equal(isEventComingSoon({ is_coming_soon: false }), false);
});

// ── Ordering + counts ────────────────────────────────────────────────────
test("events sort by Number(sort_order || 0) ascending, like the web list", () => {
  const events = [
    { id: "b", sort_order: 3 },
    { id: "a", sort_order: 1 },
    { id: "none" }, // missing sort_order → 0, first
    { id: "str", sort_order: "2" }, // numeric strings compare numerically
  ];
  assert.deepEqual(sortEvents(events).map((e) => e.id), ["none", "a", "str", "b"]);
  assert.deepEqual(sortEvents(null), []);
  const input = [{ id: "x", sort_order: 2 }, { id: "y", sort_order: 1 }];
  sortEvents(input);
  assert.equal(input[0].id, "x", "sorting never mutates the cached list");
});

test("header counts mirror the web stats line (total + published)", () => {
  const events = [
    { id: "1", is_published: true },
    { id: "2" }, // legacy no-flag counts as published
    { id: "3", is_published: false },
  ];
  assert.deepEqual(eventCounts(events), { total: 3, published: 2 });
  assert.deepEqual(eventCounts(null), { total: 0, published: 0 });
});

// ── Ticket tier + photo list operations ──────────────────────────────────
test("ticket updates patch one tier immutably (web TicketsEditor semantics)", () => {
  const tickets = [
    { name: "GA", price_aud: 50, url: "", note: "", sold_out: false },
    { name: "VIP", price_aud: 150, url: "", note: "", sold_out: false },
  ];
  const next = updateTicket(tickets, 1, { sold_out: true, price_aud: 175 });
  assert.equal(next[1].sold_out, true);
  assert.equal(next[1].price_aud, 175);
  assert.equal(next[1].name, "VIP", "unpatched fields carried");
  assert.equal(next[0].sold_out, false, "other tiers untouched");
  assert.equal(tickets[1].sold_out, false, "input never mutated");
});

test("add/remove tier match the web editor: append emptyTicket, filter by index", () => {
  const one = addTicket([]);
  assert.equal(one.length, 1);
  assert.deepEqual(one[0], emptyTicket(), "new tiers carry the full web field set");
  const two = addTicket(one);
  assert.equal(two.length, 2);
  assert.deepEqual(removeTicket(two, 0).length, 1);
  assert.deepEqual(removeTicket(null, 0), []);
});

test("photo add/remove match the web uploader/grid: append url, filter by url", () => {
  const urls = addPhoto(addPhoto([], "https://img/a.jpg"), "https://img/b.jpg");
  assert.deepEqual(urls, ["https://img/a.jpg", "https://img/b.jpg"]);
  assert.deepEqual(removePhoto(urls, "https://img/a.jpg"), ["https://img/b.jpg"]);
  assert.deepEqual(addPhoto(null, "u"), ["u"]);
  assert.deepEqual(removePhoto(null, "u"), []);
});

// ── Source contracts: payload parity + native UX rules ───────────────────
test("native events writes through the same entity calls as the web manager", () => {
  const web = read("../src/components/admin/EventsManager.jsx");
  const native = read("../src/native/admin/workflows/NativeEventsWorkflow.jsx");
  for (const call of ["EventContent.create(", "EventContent.update(", "EventContent.delete("]) {
    assert.ok(web.includes(call), `web writes via ${call}`);
    assert.ok(native.includes(call), `native writes via the same ${call}`);
  }
  assert.ok(!/base44\.functions\.invoke/.test(native), "events has no edge functions on the web — native adds none");
  assert.ok(!/localStorage/.test(native), "events reads no localStorage config on the web — native adds none");
});

test("native events shares the web cache key and refresh behaviour", () => {
  const native = read("../src/native/admin/workflows/NativeEventsWorkflow.jsx");
  assert.ok(native.includes('queryKey: ["events"]'), "same ['events'] key the web panel uses");
  assert.ok(native.includes('EventContent.list("sort_order", 100)'), "same list sort/limit as the module registry");
  assert.ok(native.includes('invalidateQueries({ queryKey: ["events"] })'), "writes invalidate the shared key");
  assert.ok(!native.includes("refetchQueries"), "web parity: EventsManager only invalidates — native must not diverge");
});

test("photo upload reuses the exact web upload call", () => {
  const web = read("../src/components/admin/EventsManager.jsx");
  const native = read("../src/native/admin/workflows/NativeEventsWorkflow.jsx");
  const call = "base44.integrations.Core.UploadFile({ file })";
  assert.ok(web.includes(call), "web PhotoUploader uploads via Core.UploadFile");
  assert.ok(native.includes(call), "native uses the identical client call");
});

test("event_date keeps the web value shape by reusing the same DateTimePicker", () => {
  const web = read("../src/components/admin/EventsManager.jsx");
  const native = read("../src/native/admin/workflows/NativeEventsWorkflow.jsx");
  assert.ok(web.includes("DateTimePicker"), "premise: the web manager picks dates with DateTimePicker");
  assert.ok(native.includes('from "@/components/admin/DateTimePicker"'), "native reuses the exact picker (PT ISO offset shape)");
});

test("delete is confirmed, awaited, and destructive-styled", () => {
  const native = read("../src/native/admin/workflows/NativeEventsWorkflow.jsx");
  assert.ok(native.includes("AdminConfirmSheet"), "delete goes through the confirm sheet");
  assert.ok(native.includes('variant="destructive"'), "confirm sheet is destructive");
  assert.ok(native.includes("deleteMutation.mutateAsync"), "the awaiting dialog uses mutateAsync");
  assert.ok(native.includes('emitHaptic("mutation.warning")'), "destructive intent haptic");
});

test("events emits no admin-log events (the web manager dispatches none)", () => {
  const web = read("../src/components/admin/EventsManager.jsx");
  assert.ok(!web.includes("rlt_admin_log"), "premise: web events has no audit events");
  const native = read("../src/native/admin/workflows/NativeEventsWorkflow.jsx");
  assert.ok(!native.includes("emitAdminLog"), "native must not invent audit events the web never wrote");
});

test("edit draft is seeded from the full event record (full-payload saves, web parity)", () => {
  const native = read("../src/native/admin/workflows/NativeEventsWorkflow.jsx");
  assert.ok(native.includes("draft ?? event"), "detail editor seeds from the whole record like the web EventCard");
  assert.ok(native.includes("data: editDraft"), "save sends the full draft, never a narrowed payload");
});

test("ticket tier writes keep the web field semantics", () => {
  const native = read("../src/native/admin/workflows/NativeEventsWorkflow.jsx");
  assert.ok(native.includes("price_aud: Number(e.target.value)"), "price coerced to Number, like the web editor");
  assert.ok(native.includes("ticket.sold_out === true"), "sold_out switch reads strict equality, like the web");
});

test("native events UX contracts: no hover-gating, windowed list, haptics, no static capacitor", () => {
  const native = read("../src/native/admin/workflows/NativeEventsWorkflow.jsx");
  assert.ok(!native.includes("group-hover:"), "no hover-only affordances");
  assert.ok(native.includes("useWindowedList") && native.includes("restoreKey"), "long list is windowed with scroll restore");
  assert.ok(native.includes("PullToRefresh"), "pull to refresh on the list");
  assert.ok(native.includes("NativeEmptyState") && native.includes("NativeSkeleton"), "empty + loading states");
  for (const event of ["tab.select", "action.primary", "mutation.warning", "save.success", "mutation.error"]) {
    assert.ok(native.includes(`"${event}"`), `haptic ${event} wired`);
  }
  assert.ok(!/^import[^\n]*@capacitor/m.test(native), "no static @capacitor imports");
});
