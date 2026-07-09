/* MMA Manager — service worker
   Estratégia: network-first com cache runtime.
   No install, pré-cacheia assets críticos (HTML/CSS/JS core).
   JS modules restantes são cacheados sob demanda na primeira visita.
   CDNs também são cacheados runtime — app funciona offline após 1 visita. */
const CACHE = 'mma-manager-v3';
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './css/main.css',
  './css/motion.css',
  './css/three-arena.css',
  './css/components.css',
];

// Arquivos JS que garantem o boot do app — o resto é cacheado sob demanda
const JS_CORE = [
  './js/app.js',
  './js/config/game-config.js',
  './js/utils/helpers.js',
  './js/utils/gaussian.js',
  './js/services/db.js',
  './js/services/notification-service.js',
  './js/services/toast.js',
  './js/motion/motion-engine.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Assets críticos em lote (se um falhar, o install falha — é o comportamento desejado)
    await cache.addAll(LOCAL_ASSETS);
    // JS core: cada arquivo individualmente para não bloquear o install
    for (const url of JS_CORE) {
      try {
        const res = await fetch(url);
        if (res.ok) await cache.put(url, res);
      } catch { /* arquivo será cacheado na primeira visita normal */ }
    }
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
