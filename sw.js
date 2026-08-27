const CACHE_PREFIX = 'japan-offline-trip-booklet-v';
const CACHE_NAME = 'japan-offline-trip-booklet-v1.9.2';
const APP_SHELL = './index.html';
const CORE = [APP_SHELL, './japan-offline-trip-booklet.webmanifest', './icon-192.svg', './icon-512.svg'];
const scopedURL = path => new URL(path, self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const path of CORE) {
      const request = new Request(scopedURL(path), { cache: 'reload' });
      const response = await fetch(request);
      if (!response || !response.ok) throw new Error('Failed to cache app shell resource: ' + path);
      await cache.put(request, response);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const freshRequest = new Request(request, { cache: 'no-store' });
        const response = await fetch(freshRequest);
        if (response && response.ok) {
          cache.put(scopedURL(APP_SHELL), response.clone()).catch(() => {});
        }
        return response;
      } catch (error) {
        return (await cache.match(scopedURL(APP_SHELL))) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok && CORE.some(item => scopedURL(item) === url.href)) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (error) {
      return Response.error();
    }
  })());
});
