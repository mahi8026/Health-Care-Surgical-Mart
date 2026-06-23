/**
 * Service Worker — Health Care Surgical Mart PWA
 * v5 — Network-first for HTML, cache-first for assets, auto-update on deploy
 */

const CACHE_NAME = 'hc-mart-v5';

const PRECACHE_URLS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Take control immediately — don't wait for old SW to expire
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      )
    ).then(() => {
      // Take control of all open tabs immediately
      return self.clients.claim();
    })
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. External origins (Sentry, Google Fonts, Firebase, etc.) — always network, never cache
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response('', { status: 503, statusText: 'External resource unavailable' })
      )
    );
    return;
  }

  // 2. API calls — always network, never cache
  if (url.pathname.startsWith('/api')) {
    event.respondWith(fetch(request));
    return;
  }

  // 3. HTML navigation (index.html) — network-first so updates are picked up immediately
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh HTML
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback — serve cached HTML
          return caches.match(request).then((cached) => cached || caches.match('/'));
        })
    );
    return;
  }

  // 4. Static assets (JS, CSS, fonts, images) — cache-first for performance
  //    Vite hashes filenames on every build, so stale cache is never an issue
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || request.method !== 'GET') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      }).catch(() => new Response('', { status: 503 }));
    })
  );
});

// ─── Message: skip waiting (triggered by main.jsx on update detected) ─────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
