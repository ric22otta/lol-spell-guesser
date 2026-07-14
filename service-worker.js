const APP_CACHE = 'lol-spell-guesser-app-v4.0.2';
const RUNTIME_CACHE = 'lol-spell-guesser-runtime-v4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css?v=4.0.2',
  './js/constants.js',
  './js/storage.js',
  './js/data.js',
  './js/ui.js',
  './js/game.js',
  './js/app.js?v=4.0.2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(APP_CACHE).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => ![APP_CACHE, RUNTIME_CACHE].includes(key)).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(response => {
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
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
    event.respondWith(cacheFirst(request).catch(() => caches.match('./index.html')));
    return;
  }

  if (url.hostname === 'ddragon.leagueoflegends.com') {
    event.respondWith(staleWhileRevalidate(request));
  }
});
