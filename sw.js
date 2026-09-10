/* Service worker · Ficha Pododepor
   Objetivo: que la ficha abra al instante y sin conexión en la consulta.
   Sube CACHE_VERSION cada vez que edites index.html, o el iPad seguirá
   sirviendo la versión antigua desde caché. */
const CACHE_VERSION = 'pododepor-v6.5.0';

const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Stale-while-revalidate: responde desde caché (rápido y offline) y de fondo
   se trae la versión nueva para el próximo arranque. */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(req).then(cacheada => {
      const red = fetch(req).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copia = resp.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copia));
        }
        return resp;
      }).catch(() => cacheada);

      return cacheada || red;
    })
  );
});
