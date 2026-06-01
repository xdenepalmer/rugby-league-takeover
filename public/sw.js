// BUILD_ID is replaced at build time (see vite.config.js) so this file is
// byte-different on every publish — that's what lets the browser detect updates.
const BUILD_ID = "__BUILD_ID__";
const CACHE_NAME = `rlt-${BUILD_ID}`;
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

// Same-origin static build assets (hashed JS/CSS chunks, icons, fonts). Caching
// these makes repeat launches instant and lets the app shell work offline.
const isStaticAsset = (request, url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    ["script", "style", "font", "image"].includes(request.destination));

self.addEventListener("install", (event) => {
  // Pre-cache the shell, but do NOT skipWaiting automatically — the new worker
  // waits until the user accepts the in-app update prompt (or all tabs close),
  // so we never swap code out from under an active session.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// The page asks the waiting worker to take over (triggered by the update prompt).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Serve from cache immediately, refresh in the background.
const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === "basic") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (isBypassedRequest(request)) return;

  const url = new URL(request.url);

  // App navigations: network-first so users always get the latest HTML, with an
  // offline fallback when the network is unavailable.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  // Hashed static assets: stale-while-revalidate for instant, offline-capable loads.
  if (isStaticAsset(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
