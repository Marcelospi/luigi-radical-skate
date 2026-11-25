// Service Worker do Luigi Radical Skate (PWA Offline + Atualização Segura)
const CACHE_NAME = 'luigi-skate-v7';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/audio.js',
  './js/particles.js',
  './js/progression.js',
  './js/character_manager.js',
  './js/game_physics.js',
  './js/game_world.js',
  './js/leaderboard_online.js',
  './js/cloud_auth.js',
  './js/main.js',
  './assets/characters.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/portraits/portrait_luigi_3d.png',
  './assets/sprites/luigi_3d_skate.png',
  './assets/sprites/luigi_3d_duck.png',
  './assets/sprites/luigi_3d_jump.png',
  './assets/sprites/luigi_3d_trick.png',
  './assets/rig/head_luigi.png',
  './assets/rig/helmet_overlay.png',
  './assets/rig/torso.png',
  './assets/rig/arm_upper.png',
  './assets/rig/arm_lower.png',
  './assets/rig/thigh.png',
  './assets/rig/shin_shoe.png',
  './assets/rig/skateboard.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isBypassHost(url) {
  const host = url.hostname || '';
  return host.includes('googleapis.com')
    || host.includes('gstatic.com')
    || host.includes('firebaseapp.com')
    || host.includes('firebasestorage.app')
    || host.includes('identitytoolkit');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (isBypassHost(url)) return;

  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  // Em localhost (JOGAR.bat): Network-First para refletir edições locais na hora e funcionar offline
  if (isLocal) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Em produção HTTPS: Stale-While-Revalidate para assets do próprio domínio
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
  }
});
