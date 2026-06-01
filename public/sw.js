const CACHE_NAME = "rlt-shell-v1";
const SHELL_URLS = ["/", "/offline.html", "/manifest.webmanifest"];

const isBypassedRequest = (request) => {
  const url = new URL(request.url);
  if (request.method !== "GET") return true;
  if (request.headers.has("authorization")) return true;
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.includes("createCheckout")) return true;
  if (url.pathname.includes("forumAction")) return true;
  if (url.searchParams.has("access_token") || url.searchParams.has("app_id")) return true;
  return false;
};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (isBypassedRequest(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
