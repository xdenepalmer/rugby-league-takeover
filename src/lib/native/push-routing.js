/**
 * Notification-tap routing. The (future RLT-IOS-004) APNs sender will put a
 * small data payload on each notification; this maps it to the native
 * screen that should open. Pure and defensive: anything malformed lands on
 * the notification centre instead of crashing a cold launch.
 *
 * Expected payload shapes (documented for the sender):
 *   { type: "forum_reply" | "forum_mention", thread_id }
 *   { type: "news", article_id }
 *   { type: "product_drop", product_id }
 *   { type: "order_update", order_id? }
 *   { type: "admin_announcement", link? }        (link = app path)
 *   { link: "/any/app/path" }                    (generic fallback)
 */
const FALLBACK = "/account/notifications";

export function resolvePushRoute(data) {
  if (!data || typeof data !== "object") return FALLBACK;
  const type = String(data.type || "");
  const enc = (v) => encodeURIComponent(String(v));

  if ((type === "forum_reply" || type === "forum_mention") && data.thread_id) {
    return `/forum/thread/${enc(data.thread_id)}`;
  }
  if (type === "news" && data.article_id) return `/news/${enc(data.article_id)}`;
  if (type === "product_drop" && data.product_id) return `/store/product/${enc(data.product_id)}`;
  if (type === "order_update") return "/account/orders";
  if (typeof data.link === "string" && data.link.startsWith("/") && !data.link.startsWith("//")) {
    return data.link;
  }
  return FALLBACK;
}
