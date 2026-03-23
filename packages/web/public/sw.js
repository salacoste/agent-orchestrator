/* global self, caches, fetch, URL */
/**
 * Service Worker — offline cache for PWA (Story 44.8).
 *
 * Strategy:
 * - API routes: network-first, cache fallback for offline
 * - Static assets: cache-first, network update in background
 */

const CACHE_NAME = "ao-pwa-v1";
const API_CACHE = "ao-api-v1";

/** API paths to cache for offline access. */
const CACHEABLE_API_PATTERNS = ["/api/sprint/digest", "/api/workflow/"];

/** Static asset paths to precache. */
const STATIC_ASSETS = ["/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

// Install: precache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== API_CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  const isApi = CACHEABLE_API_PATTERNS.some((pattern) => url.pathname.startsWith(pattern));

  if (isApi) {
    // Network-first: try network, fall back to cache
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // Cache-first for precached static assets
  const isStatic = STATIC_ASSETS.some((asset) => url.pathname === asset);
  if (isStatic) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  }
});
