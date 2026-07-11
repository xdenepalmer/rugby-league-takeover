/**
 * Pure logic for the native Gallery workflow. Mirrors the web
 * GalleryManager's rules — the create-draft shape, the "needs a media_url or
 * embed_url" submit gate, media-type switching resetting URLs, sort_order
 * numeric coercion, event-label grouping, and the thumbnail-resolution order
 * — so the native screens write payload-parity updates through the same
 * GalleryItem entity.
 */

/** Exact create-draft shape the web GalleryManager submits (its `empty`). */
export const EMPTY_GALLERY_DRAFT = {
  title: "",
  media_type: "photo",
  media_url: "",
  embed_url: "",
  thumbnail_url: "",
  event_label: "",
  sort_order: 1,
  is_published: true,
};

/** Same extraction the web manager uses for YouTube thumbnails. */
export function getYoutubeId(url) {
  const match = url?.match(/(?:v=|youtu\.be\/|embed\/)([^&?/]+)/);
  return match ? match[1] : null;
}

export const GALLERY_TYPE_OPTIONS = [
  { value: "photo", label: "Photo" },
  { value: "video", label: "Video (upload)" },
  { value: "youtube", label: "YouTube link" },
  { value: "facebook", label: "Facebook link" },
];

export const GALLERY_TYPE_META = {
  photo: { label: "Photo", tone: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" },
  video: { label: "Video", tone: "border-blue-400/30 bg-blue-400/10 text-blue-400" },
  youtube: { label: "YouTube", tone: "border-red-400/30 bg-red-400/10 text-red-400" },
  facebook: { label: "Facebook", tone: "border-blue-500/30 bg-blue-500/10 text-blue-500" },
};

export const galleryTypeMeta = (type) =>
  GALLERY_TYPE_META[type] || { label: type || "Media", tone: "border-border bg-muted/20 text-muted-foreground" };

/** Same ordering the web manager renders: sort_order ascending, 0 default. */
export function sortGalleryItems(items) {
  return [...(items || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

/** Event-label summary groups (web parity: "Unlabelled" bucket). */
export function galleryEventGroups(items) {
  return (items || []).reduce((acc, item) => {
    const key = item.event_label || "Unlabelled";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

/** Web parity: an item counts as published unless is_published === false. */
export const isGalleryItemPublished = (item) => item?.is_published !== false;

export const GALLERY_FILTERS = [
  { key: "all", label: "All" },
  { key: "photo", label: "Photos" },
  { key: "video", label: "Videos" },
  { key: "youtube", label: "YouTube" },
  { key: "facebook", label: "Facebook" },
  { key: "drafts", label: "Drafts" },
];

export function filterGalleryItems(items, { query = "", filter = "all" } = {}) {
  const q = query.trim().toLowerCase();
  return sortGalleryItems(items).filter((item) => {
    if (filter === "drafts") {
      if (isGalleryItemPublished(item)) return false;
    } else if (filter !== "all" && (item.media_type || "") !== filter) {
      return false;
    }
    if (!q) return true;
    return [item.title, item.event_label, item.media_url, item.embed_url]
      .map((v) => String(v || "").toLowerCase())
      .some((v) => v.includes(q));
  });
}

/**
 * Web parity: switching media type clears both URL fields so a photo URL
 * never rides along on a YouTube item (GalleryManager's Select onValueChange).
 */
export function applyDraftMediaType(draft, mediaType) {
  return { ...draft, media_type: mediaType, media_url: "", embed_url: "" };
}

/** Web parity: submit is blocked until a media_url OR embed_url exists. */
export function canSubmitGalleryDraft(draft) {
  return Boolean(draft?.media_url || draft?.embed_url);
}

/**
 * The exact entity payload the web create sends: the full draft shape,
 * nothing more, with sort_order coerced to a number the way the web input
 * does (Number(e.target.value)).
 */
export function buildGalleryCreatePayload(draft) {
  return {
    title: draft.title || "",
    media_type: draft.media_type || "photo",
    media_url: draft.media_url || "",
    embed_url: draft.embed_url || "",
    thumbnail_url: draft.thumbnail_url || "",
    event_label: draft.event_label || "",
    sort_order: Number(draft.sort_order || 0),
    is_published: draft.is_published !== false,
  };
}

/**
 * The web edit form writes single-field partial updates on blur ({title},
 * {event_label}, {sort_order: Number}). The native detail form saves once,
 * so build the same partial: only the fields that actually changed, with the
 * same names and coercions — never the whole record.
 */
export function buildGalleryEditPayload(item, form) {
  const data = {};
  if ((form.title ?? "") !== (item.title || "")) data.title = form.title ?? "";
  if ((form.event_label ?? "") !== (item.event_label || "")) data.event_label = form.event_label ?? "";
  const nextSort = Number(form.sort_order);
  if (Number.isFinite(nextSort) && nextSort !== Number(item.sort_order ?? 1)) data.sort_order = nextSort;
  return data;
}

/** Same publish-toggle payload the web quick action writes. */
export function buildGalleryPublishTogglePayload(item) {
  return { is_published: !item.is_published };
}

/**
 * Thumbnail resolution mirroring the web ItemPreview: photo media_url first,
 * then a derived YouTube thumbnail, then thumbnail_url, else no image.
 */
export function galleryPreviewSrc(item) {
  if (!item) return null;
  if (item.media_type === "photo" && item.media_url) return item.media_url;
  if (item.media_type === "youtube" && item.embed_url) {
    const id = getYoutubeId(item.embed_url);
    if (id) return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
  }
  return item.thumbnail_url || null;
}

/** The externally-openable URL for an item (web shows media_url ?? embed_url). */
export const galleryItemUrl = (item) => item?.media_url || item?.embed_url || "";
