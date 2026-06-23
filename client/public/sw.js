/**
 * Service Worker — Health Care Surgical Mart PWA
 * Strategy: network-first for API calls, cache-first for static assets
 */

const CACHE_NAME = 'hc-mart-v1';

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install: pre-cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for /api, cache-first for everything else
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Always go to network for API calls — never serve stale data
  if (url.pathname.startsWith('/api') || url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first for static assets (JS, CSS, images, fonts)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache successful same-origin GET responses
        if (!response || response.status !== 200 || request.method !== 'GET') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    })
  );
});
