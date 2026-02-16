const CACHE_NAME = 'skillvouch-ai-v2'; // Updated version to invalidate old cache
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker caching files');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker cache addAll failed:', error);
      })
  );
  self.skipWaiting(); // Force activation of new service worker
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // Take control of all clients
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Don't cache API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Don't cache JavaScript, CSS, or other assets (they have hashes)
  if (url.pathname.includes('/assets/') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.jpeg') ||
      url.pathname.endsWith('.gif') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.ico')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
      .catch((error) => {
        console.error('Service Worker fetch failed:', error);
        // Return offline fallback if needed
        return new Response('Offline', { status: 503 });
      })
  );
});
