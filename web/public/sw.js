/**
 * @file sw.js
 * @description Service Worker for EmitDocs Progressive Web App (PWA).
 * @architecture Handles precaching of app shell assets, Cache-First strategy for static
 * files and PDF worker, Network-First for HTML navigation with SPA fallback, and Network-First
 * with read-only cache fallback for GET /api requests.
 */

const CACHE_VERSION = 'v1';
const PRECACHE_NAME = `emitdocs-precache-${CACHE_VERSION}`;
const RUNTIME_CACHE = `emitdocs-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/pwa/site.webmanifest',
  '/favicon.svg',
  '/favicon.ico',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/pwa/maskable-192.png',
  '/pwa/maskable-512.png',
  '/pdf.worker.min.mjs',
];

// 1. Install Event: Precache static core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            fetch(url).then((response) => {
              if (response.ok) {
                return cache.put(url, response);
              }
              return Promise.reject(new Error(`Failed to fetch ${url}`));
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up outdated caches and claim clients immediately
self.addEventListener('activate', (event) => {
  const currentCaches = [PRECACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => !currentCaches.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// 3. Message Event: Handle user-directed SKIP_WAITING from update toast
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 4. Fetch Event: Intelligent routing based on request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-http(s) requests or external origin analytics/speed-insights
  if (!url.protocol.startsWith('http')) return;

  // A. Navigation requests (HTML pages) -> Network-First, SPA index.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Fallback to cached route or root index.html
          const cached = await caches.match(request);
          if (cached) return cached;
          const spaShell = await caches.match('/index.html');
          return spaShell || Response.error();
        })
    );
    return;
  }

  // B. API requests (/api/*)
  if (url.pathname.startsWith('/api/')) {
    // Non-GET requests (mutations) must go to network only
    if (request.method !== 'GET') {
      return;
    }

    // GET requests: Network-First with read-only cache fallback
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response(
            JSON.stringify({
              error: 'Offline',
              message: 'You are currently offline and this data is not cached.',
              isOffline: true,
            }),
            {
              status: 503,
              statusText: 'Service Unavailable (Offline)',
              headers: { 'Content-Type': 'application/json' },
            }
          );
        })
    );
    return;
  }

  // C. Static assets (assets, icons, fonts, pdf worker, images) -> Cache-First
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/pwa/') ||
    url.pathname.startsWith('/standard_fonts/') ||
    url.pathname === '/pdf.worker.min.mjs' ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|ico|woff2?|ttf|eot)$/i);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // D. Default fallback for other GET requests: Stale-While-Revalidate
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
  }
});
