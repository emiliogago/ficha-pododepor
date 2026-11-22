/* Service worker · Vídeo PD
   - Núcleo de la app: se precarga al instalar (abre sin conexión).
   - Detección automática (MediaPipe, ~20 MB): se guarda la primera vez que se usa.
   Sube CACHE_VERSION cada vez que cambies index.html, app.js o pose.js.
   OJO: comparte origen con la Ficha PD, así que SOLO borra cachés con prefijo 'videopd-'. */
const CACHE_VERSION = 'videopd-v1.0.0';
const CACHE_IA = 'videopd-ia-0.10.14';   // no cambia al actualizar la app: no se vuelve a bajar

const NUCLEO = [
  './', './index.html', './app.js', './pose.js', './manifest.webmanifest',
  './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(NUCLEO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('videopd-') && k !== CACHE_VERSION && k !== CACHE_IA).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  const url = new URL(req.url);

  // Archivos de IA: caché primero (pesan mucho y no cambian).
  if (url.pathname.includes('/vendor/')) {
    e.respondWith(caches.open(CACHE_IA).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const resp = await fetch(req);
      if (resp && resp.status === 200) c.put(req, resp.clone());
      return resp;
    }));
    return;
  }

  // Resto: stale-while-revalidate.
  e.respondWith(caches.match(req).then(cacheada => {
    const red = fetch(req).then(resp => {
      if (resp && resp.status === 200 && resp.type === 'basic') {
        const copia = resp.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, copia));
      }
      return resp;
    }).catch(() => cacheada);
    return cacheada || red;
  }));
});
