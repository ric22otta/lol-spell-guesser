const APP_VERSION = '4.0.3';
const APP_CACHE = `lol-spell-guesser-app-v${APP_VERSION}`;
const RUNTIME_CACHE = `lol-spell-guesser-runtime-v${APP_VERSION}`;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest?v=4.0.3',
  './css/style.css?v=4.0.3',
  './js/constants.js?v=4.0.3',
  './js/storage.js?v=4.0.3',
  './js/data.js?v=4.0.3',
  './js/ui.js?v=4.0.3',
  './js/game.js?v=4.0.3',
  './js/app.js?v=4.0.3',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './reset-cache.html'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== APP_CACHE && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
    );
  }
});

async function networkFirst(request, fallbackUrl = null) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(async response => {
    if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  if (cached) {
    networkPromise.catch(() => null);
    return cached;
  }
  return (await networkPromise) || new Response('', { status: 504, statusText: 'Offline' });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(request, './index.html'));
    } else {
      event.respondWith(networkFirst(request));
    }
    return;
  }

  if (url.hostname === 'ddragon.leagueoflegends.com') {
    event.respondWith(staleWhileRevalidate(request));
  }
});
