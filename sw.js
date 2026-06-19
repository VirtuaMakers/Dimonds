const CACHE_NAME = 'dimonds-v9';
const ASSETS = [
  '/Dimonds/',
  '/Dimonds/index.html',
  '/Dimonds/manifest.json',
  '/Dimonds/images/icon-192.png',
  '/Dimonds/images/icon-512.png',
  '/Dimonds/assets/logo-claude.png',
  '/Dimonds/assets/logo-gemini.png',
  '/Dimonds/assets/logo-llama.png',
  '/Dimonds/assets/logo-mistral.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first for AI worker requests; cache-first for everything else
  if (e.request.url.includes('workers.dev')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok && e.request.method === 'GET') {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return res;
    }))
  );
});
