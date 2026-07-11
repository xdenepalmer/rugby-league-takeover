/**
 * Pure logic for the native News workflow. Mirrors the web NewsManager's
 * rules exactly — draft defaults, the "published unless explicitly false"
 * status rule, and the full 6-field update payload the web edit form always
 * writes — so native saves are payload-parity with the web panel.
 *
 * The web NewsManager dispatches no rlt_admin_log events, so this module
 * deliberately emits none either (audit parity is "same events", including
 * zero).
 */

/** Web parity: NewsManager's `emptyArticle` create draft, field for field. */
export function emptyNewsArticle() {
  return {
    title: "",
    body: "",
    image_url: "",
    published_date: new Date().toISOString().slice(0, 10),
    author: "RLT Vegas",
    is_published: true,
  };
}

/** Web rule: an article counts as published unless is_published is exactly false. */
export function isArticlePublished(article) {
  return article?.is_published !== false;
}

/**
 * The exact edit draft the web EditForm seeds and saves — ALL six fields,
 * every time, with the same empty-string fallbacks. Quick actions reuse this
 * so a native update never writes a narrower payload than the web does.
 */
export function buildArticleEditPayload(article = {}) {
  return {
    title: article.title || "",
    published_date: article.published_date || "",
    author: article.author || "",
    is_published: article.is_published !== false,
    image_url: article.image_url || "",
    body: article.body || "",
  };
}

/**
 * Publish/unpublish toggle payload: the full web edit payload with
 * is_published flipped (the web toggles this via the same full-form save).
 */
export function buildPublishTogglePayload(article) {
  return {
    ...buildArticleEditPayload(article),
    is_published: !isArticlePublished(article),
  };
}

/** Web parity: the create button is disabled until a title exists. */
export function canCreateArticle(draft) {
  return Boolean(draft?.title);
}

// Status chips: the web header surfaces Total / Published / Draft counts.
export const NEWS_FILTERS = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
];

export function filterNews(articles, { query = "", filter = "all" } = {}) {
  const q = query.trim().toLowerCase();
  return (articles || []).filter((article) => {
    if (filter === "published" && !isArticlePublished(article)) return false;
    if (filter === "draft" && isArticlePublished(article)) return false;
    if (!q) return true;
    return [article.title, article.body, article.author]
      .map((v) => String(v || "").toLowerCase())
      .some((v) => v.includes(q));
  });
}

export function newsCounts(articles) {
  return Object.fromEntries(NEWS_FILTERS.map((f) => [f.key, filterNews(articles, { filter: f.key }).length]));
}
