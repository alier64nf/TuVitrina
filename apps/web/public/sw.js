const SW_VERSION = 'tuvitrina-v1';
const SHELL_CACHE = `${SW_VERSION}-shell`;
const STOREFRONT_CACHE = `${SW_VERSION}-storefronts`;
const IMAGE_CACHE = `${SW_VERSION}-images`;

const APP_SHELL_URLS = [
  '/',
  '/offline',
  '/ayuda',
  '/herramientas',
  '/manifest.webmanifest',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![SHELL_CACHE, STOREFRONT_CACHE, IMAGE_CACHE].includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function notifyStorefrontUpdated(url) {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel('tuvitrina-sync');
    channel.postMessage({ type: 'STOREFRONT_UPDATED', url });
    channel.close();
  } catch {
    // Ignore broadcast errors in restricted contexts
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin && request.destination !== 'image') {
    return;
  }

  // 1. Storefront catalog JSON API: Stale-While-Revalidate + background refresh notification
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/v1/storefronts/')) {
    event.respondWith(
      caches.open(STOREFRONT_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then(async (response) => {
            if (response && response.ok) {
              const clone = response.clone();
              await cache.put(request, clone);
              if (cached) {
                notifyStorefrontUpdated(url.pathname);
              }
            }
            return response;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(networkPromise);
          return cached;
        }

        const networkResponse = await networkPromise;
        if (networkResponse) return networkResponse;

        return new Response(
          JSON.stringify({
            type: 'about:blank',
            title: 'Sin conexión',
            status: 503,
            detail: 'Sin conexión y sin copia en caché de este catálogo.',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }),
    );
    return;
  }

  // Never cache authenticated seller/admin APIs
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Images: Cache-First with network fallback
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response && (response.ok || response.type === 'opaque')) {
            await cache.put(request, response.clone());
          }
          return response;
        } catch {
          return cached || Response.error();
        }
      }),
    );
    return;
  }

  // 3. Navigations (App pages & public storefronts): Network-First with cached shell & /offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response && response.ok) {
            const cache = await caches.open(SHELL_CACHE);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE);
          const cachedExact = await cache.match(request);
          if (cachedExact) return cachedExact;
          const offlinePage = await cache.match('/offline');
          if (offlinePage) return offlinePage;
          return new Response('Sin conexión a internet.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }),
    );
    return;
  }

  // 4. Static assets (JS/CSS/fonts): Stale-While-Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              void cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => null);
        return cached || (await networkPromise) || Response.error();
      }),
    );
  }
});
