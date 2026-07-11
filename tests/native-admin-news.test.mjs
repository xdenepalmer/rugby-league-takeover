import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NEWS_FILTERS,
  filterNews,
  newsCounts,
  emptyNewsArticle,
  buildArticleEditPayload,
  buildPublishTogglePayload,
  canCreateArticle,
  isArticlePublished,
} from "../src/native/admin/workflows/news-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Create draft: byte-parity with the web NewsManager's emptyArticle ────
test("empty article draft mirrors the web defaults", () => {
  const draft = emptyNewsArticle();
  assert.deepEqual(Object.keys(draft).sort(), ["author", "body", "image_url", "is_published", "published_date", "title"]);
  assert.equal(draft.title, "");
  assert.equal(draft.body, "");
  assert.equal(draft.image_url, "");
  assert.equal(draft.author, "RLT Vegas", "web default author");
  assert.equal(draft.is_published, true, "web defaults to publish immediately");
  assert.equal(draft.published_date, new Date().toISOString().slice(0, 10), "today, same slice the web uses");
});

test("create is gated on a title, exactly like the web button", () => {
  assert.equal(canCreateArticle(emptyNewsArticle()), false);
  assert.equal(canCreateArticle({ ...emptyNewsArticle(), title: "Vegas bound" }), true);
  assert.equal(canCreateArticle(null), false);
});

// ── Published rule + edit payload parity ─────────────────────────────────
test("published unless explicitly false (web rule: is_published !== false)", () => {
  assert.equal(isArticlePublished({ is_published: true }), true);
  assert.equal(isArticlePublished({}), true, "legacy articles without the flag count as published");
  assert.equal(isArticlePublished({ is_published: false }), false);
});

test("edit payload carries the full six-field set the web EditForm writes", () => {
  const article = {
    id: "a1",
    title: "Kickoff",
    published_date: "2026-03-01",
    author: "Deb",
    is_published: false,
    image_url: "https://img/x.jpg",
    body: "Full story",
    created_date: "2026-02-28", // never part of the payload
  };
  const payload = buildArticleEditPayload(article);
  assert.deepEqual(payload, {
    title: "Kickoff",
    published_date: "2026-03-01",
    author: "Deb",
    is_published: false,
    image_url: "https://img/x.jpg",
    body: "Full story",
  });
  // Same empty-string fallbacks as the web seed.
  assert.deepEqual(buildArticleEditPayload({}), {
    title: "",
    published_date: "",
    author: "",
    is_published: true,
    image_url: "",
    body: "",
  });
});

test("publish toggle flips is_published but never narrows the payload", () => {
  const live = { title: "T", published_date: "2026-03-01", author: "A", is_published: true, image_url: "u", body: "b" };
  const unpublished = buildPublishTogglePayload(live);
  assert.equal(unpublished.is_published, false);
  assert.deepEqual(Object.keys(unpublished).sort(), ["author", "body", "image_url", "is_published", "published_date", "title"]);
  assert.equal(unpublished.title, "T", "other fields carried unchanged");
  const republished = buildPublishTogglePayload({ ...live, is_published: false });
  assert.equal(republished.is_published, true);
  assert.equal(buildPublishTogglePayload({ title: "legacy" }).is_published, false, "legacy no-flag article counts as live → toggle unpublishes");
});

// ── List filters + search ────────────────────────────────────────────────
test("news filters split published/draft on the web rule", () => {
  const articles = [
    { id: "1", title: "Live one", is_published: true },
    { id: "2", title: "Legacy no flag" },
    { id: "3", title: "Hidden draft", is_published: false },
  ];
  assert.deepEqual(NEWS_FILTERS.map((f) => f.key), ["all", "published", "draft"]);
  assert.deepEqual(filterNews(articles, { filter: "published" }).map((a) => a.id), ["1", "2"]);
  assert.deepEqual(filterNews(articles, { filter: "draft" }).map((a) => a.id), ["3"]);
  assert.deepEqual(newsCounts(articles), { all: 3, published: 2, draft: 1 });
});

test("search matches title, body and author", () => {
  const articles = [
    { id: "1", title: "Allegiant opener", body: "Storm v Broncos", author: "Deb" },
    { id: "2", title: "Ticket news", body: "On sale Friday", author: "Mia" },
  ];
  assert.deepEqual(filterNews(articles, { query: "broncos" }).map((a) => a.id), ["1"]);
  assert.deepEqual(filterNews(articles, { query: "MIA" }).map((a) => a.id), ["2"]);
  assert.deepEqual(filterNews(articles, { query: "friday", filter: "published" }).map((a) => a.id), ["2"]);
  assert.equal(filterNews(articles, { query: "nowhere" }).length, 0);
  assert.equal(filterNews(articles, {}).length, 2);
  assert.equal(filterNews(null, { query: "x" }).length, 0);
});

// ── Source contracts: payload parity + native UX rules ───────────────────
test("native news writes through the same entity calls as the web manager", () => {
  const web = read("../src/components/admin/NewsManager.jsx");
  const native = read("../src/native/admin/workflows/NativeNewsWorkflow.jsx");
  for (const call of ["NewsArticle.create(", "NewsArticle.update(", "NewsArticle.delete("]) {
    assert.ok(web.includes(call), `web writes via ${call}`);
    assert.ok(native.includes(call), `native writes via the same ${call}`);
  }
  assert.ok(!/base44\.functions\.invoke/.test(native), "news has no edge functions on the web — native adds none");
});

test("native news shares the web cache key and refresh behaviour", () => {
  const native = read("../src/native/admin/workflows/NativeNewsWorkflow.jsx");
  assert.ok(native.includes('queryKey: ["news"]'), "same ['news'] key the web panel uses");
  assert.ok(native.includes('NewsArticle.list("-published_date", 50)'), "same list sort/limit as the module registry");
  assert.ok(native.includes("invalidateQueries") && native.includes("refetchQueries"), "web parity: invalidate AND refetch after writes");
});

test("image upload reuses the exact web upload call", () => {
  const web = read("../src/components/admin/ImageField.jsx");
  const native = read("../src/native/admin/workflows/NativeNewsWorkflow.jsx");
  const call = "base44.integrations.Core.UploadFile({ file })";
  assert.ok(web.includes(call), "web ImageField uploads via Core.UploadFile");
  assert.ok(native.includes(call), "native uses the identical client call");
});

test("delete is confirmed, awaited, and destructive-styled", () => {
  const native = read("../src/native/admin/workflows/NativeNewsWorkflow.jsx");
  assert.ok(native.includes("AdminConfirmSheet"), "delete goes through the confirm sheet");
  assert.ok(native.includes('variant="destructive"'), "confirm sheet is destructive");
  assert.ok(native.includes("deleteMutation.mutateAsync"), "the awaiting dialog uses mutateAsync");
  assert.ok(native.includes('emitHaptic("mutation.warning")'), "destructive intent haptic");
});

test("news emits no admin-log events (the web manager dispatches none)", () => {
  const web = read("../src/components/admin/NewsManager.jsx");
  assert.ok(!web.includes("rlt_admin_log"), "premise: web news has no audit events");
  const native = read("../src/native/admin/workflows/NativeNewsWorkflow.jsx");
  assert.ok(!native.includes("emitAdminLog"), "native must not invent audit events the web never wrote");
});

test("native news UX contracts: no hover-gating, windowed list, haptics, no static capacitor", () => {
  const native = read("../src/native/admin/workflows/NativeNewsWorkflow.jsx");
  assert.ok(!native.includes("group-hover:"), "no hover-only affordances");
  assert.ok(native.includes("useWindowedList") && native.includes("restoreKey"), "long list is windowed with scroll restore");
  assert.ok(native.includes("PullToRefresh"), "pull to refresh on the list");
  assert.ok(native.includes("NativeEmptyState") && native.includes("NativeSkeleton"), "empty + loading states");
  for (const event of ["tab.select", "action.primary", "mutation.warning", "save.success", "mutation.error"]) {
    assert.ok(native.includes(`"${event}"`), `haptic ${event} wired`);
  }
  assert.ok(!/^import[^\n]*@capacitor/m.test(native), "no static @capacitor imports");
});
