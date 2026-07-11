import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EMPTY_GALLERY_DRAFT,
  GALLERY_TYPE_OPTIONS,
  GALLERY_FILTERS,
  galleryTypeMeta,
  getYoutubeId,
  sortGalleryItems,
  galleryEventGroups,
  isGalleryItemPublished,
  filterGalleryItems,
  applyDraftMediaType,
  canSubmitGalleryDraft,
  buildGalleryCreatePayload,
  buildGalleryEditPayload,
  buildGalleryPublishTogglePayload,
  galleryPreviewSrc,
  galleryItemUrl,
} from "../src/native/admin/workflows/gallery-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Draft shape: byte-for-byte the web manager's `empty` ─────────────────
test("create draft carries exactly the web GalleryManager field set", () => {
  assert.deepEqual(EMPTY_GALLERY_DRAFT, {
    title: "",
    media_type: "photo",
    media_url: "",
    embed_url: "",
    thumbnail_url: "",
    event_label: "",
    sort_order: 1,
    is_published: true,
  });
  const web = read("../src/components/admin/GalleryManager.jsx");
  for (const field of Object.keys(EMPTY_GALLERY_DRAFT)) {
    assert.ok(web.includes(field), `web manager also writes ${field}`);
  }
});

test("create payload sends the same fields with numeric sort_order — nothing invented", () => {
  const payload = buildGalleryCreatePayload({
    ...EMPTY_GALLERY_DRAFT,
    title: "Vegas try",
    media_url: "https://cdn/x.jpg",
    event_label: "Las Vegas 2024",
    sort_order: "3",
  });
  assert.deepEqual(Object.keys(payload).sort(), Object.keys(EMPTY_GALLERY_DRAFT).sort(), "no extra fields ever");
  assert.equal(payload.sort_order, 3, "sort_order coerced to a number like the web input");
  assert.equal(payload.thumbnail_url, "", "thumbnail_url rides along empty (web parity)");
  assert.equal(payload.is_published, true);
  assert.equal(buildGalleryCreatePayload({ ...EMPTY_GALLERY_DRAFT, is_published: false }).is_published, false);
});

test("submit gate mirrors the web disabled rule: media_url OR embed_url required", () => {
  assert.equal(canSubmitGalleryDraft(EMPTY_GALLERY_DRAFT), false);
  assert.equal(canSubmitGalleryDraft({ ...EMPTY_GALLERY_DRAFT, media_url: "https://x/y.jpg" }), true);
  assert.equal(canSubmitGalleryDraft({ ...EMPTY_GALLERY_DRAFT, embed_url: "https://youtu.be/abc" }), true);
  assert.equal(canSubmitGalleryDraft(null), false);
});

test("switching media type clears both URL fields (web Select onValueChange)", () => {
  const draft = { ...EMPTY_GALLERY_DRAFT, media_url: "https://x/y.jpg", embed_url: "https://f/b" };
  const next = applyDraftMediaType(draft, "youtube");
  assert.equal(next.media_type, "youtube");
  assert.equal(next.media_url, "");
  assert.equal(next.embed_url, "");
  assert.equal(next.title, draft.title, "other fields survive the switch");
  assert.deepEqual(GALLERY_TYPE_OPTIONS.map((o) => o.value), ["photo", "video", "youtube", "facebook"]);
});

// ── Edit: partial single-field semantics, never the whole record ─────────
test("edit payload contains only changed fields with the web's names and coercions", () => {
  const item = { id: "g1", title: "Old", event_label: "Vegas", sort_order: 2 };
  assert.deepEqual(buildGalleryEditPayload(item, { title: "Old", event_label: "Vegas", sort_order: 2 }), {}, "no-op edit writes nothing");
  assert.deepEqual(buildGalleryEditPayload(item, { title: "New", event_label: "Vegas", sort_order: 2 }), { title: "New" });
  assert.deepEqual(
    buildGalleryEditPayload(item, { title: "Old", event_label: "", sort_order: "5" }),
    { event_label: "", sort_order: 5 },
    "cleared label + numeric sort both carried"
  );
  assert.deepEqual(buildGalleryEditPayload(item, { title: "Old", event_label: "Vegas", sort_order: "abc" }), {}, "non-numeric sort never written");
  assert.deepEqual(
    buildGalleryEditPayload({ id: "g2" }, { title: "", event_label: "", sort_order: 1 }),
    {},
    "missing fields on the item compare as empty/default"
  );
});

test("publish toggle writes the exact web quick-action payload", () => {
  assert.deepEqual(buildGalleryPublishTogglePayload({ is_published: true }), { is_published: false });
  assert.deepEqual(buildGalleryPublishTogglePayload({ is_published: false }), { is_published: true });
  // Web parity quirk: an item with is_published undefined is treated as
  // published in the UI, and !undefined toggles it to an explicit true.
  assert.deepEqual(buildGalleryPublishTogglePayload({}), { is_published: true });
});

// ── List rules ───────────────────────────────────────────────────────────
test("items sort by sort_order ascending with 0 default (web parity)", () => {
  const sorted = sortGalleryItems([
    { id: "b", sort_order: 5 },
    { id: "c" },
    { id: "a", sort_order: "2" },
  ]);
  assert.deepEqual(sorted.map((i) => i.id), ["c", "a", "b"]);
});

test("filters and search cover type, drafts, and text fields", () => {
  const items = [
    { id: "1", media_type: "photo", title: "Try line", event_label: "Vegas", media_url: "https://cdn/a.jpg", sort_order: 1 },
    { id: "2", media_type: "youtube", embed_url: "https://youtu.be/zzz", is_published: false, sort_order: 2 },
    { id: "3", media_type: "video", title: "Fan cam", media_url: "https://cdn/b.mp4", sort_order: 3 },
  ];
  assert.deepEqual(GALLERY_FILTERS.map((f) => f.key), ["all", "photo", "video", "youtube", "facebook", "drafts"]);
  assert.equal(filterGalleryItems(items).length, 3);
  assert.deepEqual(filterGalleryItems(items, { filter: "photo" }).map((i) => i.id), ["1"]);
  assert.deepEqual(filterGalleryItems(items, { filter: "drafts" }).map((i) => i.id), ["2"]);
  assert.deepEqual(filterGalleryItems(items, { query: "vegas" }).map((i) => i.id), ["1"]);
  assert.deepEqual(filterGalleryItems(items, { query: "youtu.be" }).map((i) => i.id), ["2"]);
  assert.equal(filterGalleryItems(items, { filter: "video", query: "vegas" }).length, 0);
});

test("published state and event groups mirror the web stats row", () => {
  assert.equal(isGalleryItemPublished({ is_published: true }), true);
  assert.equal(isGalleryItemPublished({}), true, "undefined counts as published (web parity)");
  assert.equal(isGalleryItemPublished({ is_published: false }), false);
  assert.deepEqual(
    galleryEventGroups([{ event_label: "Vegas" }, { event_label: "Vegas" }, {}]),
    { Vegas: 2, Unlabelled: 1 }
  );
});

// ── Media previews ───────────────────────────────────────────────────────
test("youtube id extraction matches the web regex behavior", () => {
  assert.equal(getYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(getYoutubeId("https://youtu.be/abc123"), "abc123");
  assert.equal(getYoutubeId("https://www.youtube.com/embed/xyz?t=10"), "xyz");
  assert.equal(getYoutubeId("https://www.facebook.com/video/1"), null);
  assert.equal(getYoutubeId(""), null);
  assert.equal(getYoutubeId(undefined), null);
});

test("preview resolution follows the web ItemPreview order", () => {
  assert.equal(galleryPreviewSrc({ media_type: "photo", media_url: "https://cdn/p.jpg" }), "https://cdn/p.jpg");
  assert.equal(
    galleryPreviewSrc({ media_type: "youtube", embed_url: "https://youtu.be/abc" }),
    "https://img.youtube.com/vi/abc/mqdefault.jpg"
  );
  assert.equal(
    galleryPreviewSrc({ media_type: "video", media_url: "https://cdn/v.mp4", thumbnail_url: "https://cdn/t.jpg" }),
    "https://cdn/t.jpg",
    "non-photo media falls back to thumbnail_url, never the raw video URL"
  );
  assert.equal(galleryPreviewSrc({ media_type: "video", media_url: "https://cdn/v.mp4" }), null);
  assert.equal(galleryPreviewSrc(null), null);
  assert.equal(galleryItemUrl({ media_url: "https://a" }), "https://a");
  assert.equal(galleryItemUrl({ embed_url: "https://b" }), "https://b");
  assert.equal(galleryItemUrl({}), "");
  assert.equal(galleryTypeMeta("photo").label, "Photo");
  assert.equal(galleryTypeMeta("weird").label, "weird", "unknown types still render");
});

// ── Source contracts: parity + safety ────────────────────────────────────
test("native gallery writes through the same entity calls as the web", () => {
  const native = read("../src/native/admin/workflows/NativeGalleryWorkflow.jsx");
  assert.ok(native.includes("GalleryItem.create("), "create through the entity");
  assert.ok(native.includes("GalleryItem.update("), "update through the entity");
  assert.ok(native.includes("GalleryItem.delete("), "delete through the entity");
  assert.ok(native.includes('queryKey: ["gallery"]'), "shares the web module's query key");
  assert.ok(native.includes('invalidateQueries({ queryKey: ["gallery"] })'), "invalidates the same key the web refresh does");
  assert.ok(!native.includes("functions.invoke"), "gallery has no edge functions on the web — none invented");
  assert.ok(!native.includes("localStorage"), "gallery keeps no local config");
});

test("uploads reuse the exact web mechanism (MediaUploader → Core.UploadFile)", () => {
  const native = read("../src/native/admin/workflows/NativeGalleryWorkflow.jsx");
  assert.ok(native.includes('from "@/components/admin/MediaUploader"'), "reuses the shared uploader component");
  const uploader = read("../src/components/admin/MediaUploader.jsx");
  assert.ok(uploader.includes("base44.integrations.Core.UploadFile"), "which uploads via the same client call");
});

test("destructive delete is confirmed; the drawer create awaits settlement", () => {
  const native = read("../src/native/admin/workflows/NativeGalleryWorkflow.jsx");
  assert.ok(native.includes("AdminConfirmSheet"), "delete goes through a confirm sheet");
  assert.ok(native.includes("deleteMutation.mutateAsync"), "confirm sheet awaits the delete");
  assert.ok(native.includes("createMutation.mutateAsync"), "create drawer awaits the save before closing");
  assert.ok(native.includes("canSubmitGalleryDraft"), "submit gate uses the shared web rule");
  assert.ok(native.includes("buildGalleryCreatePayload"), "create goes through the parity payload builder");
  assert.ok(native.includes("buildGalleryEditPayload"), "edits write changed fields only via the shared builder");
});

test("native gallery is mobile-native: haptics, windowing, no hover-only UI, no static capacitor", () => {
  const native = read("../src/native/admin/workflows/NativeGalleryWorkflow.jsx");
  assert.ok(!native.includes("group-hover:"), "no hover-only affordances");
  assert.ok(!/import[^;]*from\s+["']@capacitor/.test(native), "no static @capacitor imports");
  assert.ok(native.includes("useWindowedList"), "long lists are windowed");
  assert.ok(native.includes("restoreKey"), "windowing carries a restoreKey for scroll restoration");
  for (const event of ["tab.select", "action.primary", "mutation.warning", "save.success", "mutation.error"]) {
    assert.ok(native.includes(`"${event}"`), `emits ${event} haptic`);
  }
  assert.ok(native.includes("NativeEmptyState") && native.includes("NativeSkeleton"), "empty + loading states");
  assert.ok(native.includes("PullToRefresh"), "pull to refresh on the list");
  assert.ok(native.includes('fallback="/admin/content"'), "self-chromed with a section-hub fallback");
});

test("no audit events invented: the web GalleryManager dispatches none", () => {
  const web = read("../src/components/admin/GalleryManager.jsx");
  assert.ok(!web.includes("rlt_admin_log"), "web gallery writes no admin-log events");
  const native = read("../src/native/admin/workflows/NativeGalleryWorkflow.jsx");
  assert.ok(!native.includes("emitAdminLog"), "so native must not invent them");
});
