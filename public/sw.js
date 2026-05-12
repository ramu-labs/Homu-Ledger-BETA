// Bump this version whenever you want to force-evict old caches.
const CACHE_NAME = "homu-v44";

// Install: nothing to pre-cache. Pages require auth, so pre-fetching them
// would cache the login redirect as the page response (wrong). Static assets
// (_next/static/*) are handled below with cache-first.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Static assets (_next/static): cache-first (content-addressed, safe)
// - Navigation (HTML pages): network-ONLY, no caching.
//   Pages are server-rendered with auth checks. If we cache them, a redirect
//   (e.g. 307 → /login) gets stored as the page response, breaking hydration.
// - Everything else: network-only (pass-through)
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Static assets: cache-first (immutable, content-addressed hashes)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Navigation requests: pure network-only.
  // Do NOT cache: the server may redirect to /login if the session expired,
  // and fetch() follows that redirect — caching the result would store the
  // login page HTML under the original URL, causing React hydration loops.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request));
    return;
  }

  // Everything else (API calls, images, etc.): network-only passthrough.
  // The SW doesn't intercept — just let the browser handle it.
});
