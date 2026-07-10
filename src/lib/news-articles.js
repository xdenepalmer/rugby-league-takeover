/**
 * Article-level helpers for the News surface: canonical per-article URLs
 * (shared links used to point at bare /news), reading metadata, related
 * articles, bookmark persistence, and an offline lookup over the bounded
 * recent-news cache (rlt_recent_news, capped at 30, saved on every
 * successful fetch — see recent-news.js).
 */
import { getRecentNews } from "./recent-news.js";

export const SAVED_ARTICLES_KEY = "rlt_saved_articles";
const MAX_SAVED = 50;

export function articlePath(article) {
  return article?.id ? `/news/${encodeURIComponent(article.id)}` : "/news";
}

export function findArticle(articles, id) {
  if (!id) return null;
  return (articles || []).find((a) => String(a?.id) === String(id)) || null;
}

/** Offline fallback: resolve an article from the bounded local cache. */
export function findCachedArticle(id) {
  return findArticle(getRecentNews(), id);
}

export function readingTimeMinutes(body) {
  const words = String(body || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Same-category articles first, then recency; excludes the article itself. */
export function relatedArticles(articles, article, limit = 3) {
  if (!article) return [];
  const others = (articles || []).filter((a) => a?.id && a.id !== article.id && a.is_published !== false);
  const sameCategory = others.filter((a) => a.category && a.category === article.category);
  const rest = others.filter((a) => !sameCategory.includes(a));
  return [...sameCategory, ...rest].slice(0, limit);
}

export function getSavedArticleIds(storage) {
  try {
    const parsed = JSON.parse((storage || localStorage).getItem(SAVED_ARTICLES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function isArticleSaved(id, storage) {
  return getSavedArticleIds(storage).includes(String(id));
}

/** Toggle a bookmark; returns the new saved state. Bounded MRU list. */
export function toggleSavedArticle(id, storage) {
  const store = storage || localStorage;
  const key = String(id);
  const current = getSavedArticleIds(store);
  const saved = current.includes(key);
  const next = saved ? current.filter((v) => v !== key) : [key, ...current].slice(0, MAX_SAVED);
  try {
    store.setItem(SAVED_ARTICLES_KEY, JSON.stringify(next));
  } catch {
    // Best-effort persistence.
  }
  return !saved;
}
