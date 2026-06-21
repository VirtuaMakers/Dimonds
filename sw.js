const CACHE_NAME = 'dimonds-v65';
const ASSETS = [
  '/Dimonds/',
  '/Dimonds/index.html',
  '/Dimonds/manifest.json',
  '/Dimonds/images/icon-192.png',
  '/Dimonds/images/icon-512.png',
  '/Dimonds/images/joker.jpg',
  '/Dimonds/assets/logo-claude.png',
  '/Dimonds/assets/logo-gemini.png',
  '/Dimonds/assets/logo-llama.png',
  '/Dimonds/assets/logo-mistral.png',
  '/Dimonds/assets/logo-qwen.jpg',
  '/Dimonds/assets/logo-kimi.png',
  '/Dimonds/assets/logo-glm.png',
  '/Dimonds/assets/logo-nemotron.png',
  '/Dimonds/assets/logo-cohere.png',
  '/Dimonds/assets/logo-chatgpt.png',
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
  const url = new URL(e.request.url);

  // Network-first for AI worker requests
  if (url.hostname.includes('workers.dev')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Network-first for HTML (index.html / root) — always get the latest game code
  const isHtml = url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname === '/Dimonds';
  if (isHtml) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for everything else (images, logos, manifest)
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
