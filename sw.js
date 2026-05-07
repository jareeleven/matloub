// MATLOUB — Service Worker PWA
const CACHE_NAME = 'matloub-v1';
const ASSETS = [
  '/matloub/',
  '/matloub/index.html',
  '/matloub/admin.html',
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap'
];

// Installation — mise en cache des ressources essentielles
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activation — suppression des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — stratégie Network First (données toujours fraîches)
// avec fallback cache si hors ligne
self.addEventListener('fetch', event => {
  // Ignorer les requêtes Firebase (toujours en ligne)
  if (event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic') && event.request.url.includes('firebasejs')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Mettre en cache la nouvelle version
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Hors ligne — utiliser le cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Page offline de secours
          if (event.request.destination === 'document') {
            return caches.match('/matloub/index.html');
          }
        });
      })
  );
});
