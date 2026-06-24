/* Service worker for the Bodybuilding Tracker PWA.
 *
 * Strategy:
 *  - Navigations: network-first, fall back to the cached app shell when offline
 *    (so the app always loads the latest version online, but still opens in a gym
 *    with no signal).
 *  - Other same-origin GETs (Vite's content-hashed JS/CSS, icons): cache-first,
 *    then network, caching whatever is fetched. Hashed filenames are immutable,
 *    so this is safe and needs no precache manifest.
 *
 * App data lives in localStorage, which the service worker never touches — it
 * only caches the static app shell. Bump CACHE on a breaking change to evict old
 * shells.
 */
const CACHE = 'bb-tracker-v1';
const SHELL = [
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // allSettled so one missing asset can't abort the whole install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('index.html'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached),
    ),
  );
});
