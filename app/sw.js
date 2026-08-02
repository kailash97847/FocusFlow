/**
 * sw.js — FocusFlow service worker.
 * Precache-first for app shell; network-first fallback keeps content fresh.
 * Bump CACHE_VERSION on every release to roll caches.
 */

const CACHE_VERSION = 'focusflow-v1.0.0';
const PRECACHE = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.webmanifest',
  './js/core/timer.js',
  './js/core/settings.js',
  './js/core/tasks.js',
  './js/core/stats.js',
  './js/services/storage.js',
  './js/services/audio.js',
  './js/services/notify.js',
  './js/ui/app.js',
  './assets/favicon.svg',
  './assets/favicon-32.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Navigation requests: network-first so updates ship instantly, cache fallback offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  // Static assets: cache-first, populate on miss.
  event.respondWith(
    caches.match(request).then((hit) => hit ?? fetch(request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
      }
      return res;
    }).catch(() => hit)),
  );
});
