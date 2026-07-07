/**
 * Offline foundation for news: the last successful news fetch is kept in
 * localStorage (rlt_ convention, LRU-capped like forum-read-tracker) so the
 * News page can still show recent articles when the app opens offline —
 * important in the native shell where there is no service worker cache.
 */
const STORAGE_KEY = "rlt_recent_news";
const MAX_ARTICLES = 30;

export function getRecentNews() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentNews(articles) {
  if (!Array.isArray(articles) || articles.length === 0) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(articles.slice(0, MAX_ARTICLES)));
  } catch {
    // Storage full/blocked — offline fallback is best-effort only.
  }
}
