const CACHE = 'colorix-verifs-6';
const COQUILLE = [
  './',
  './index.html',
  './diagnostic.js',
  './manifest.webmanifest',
  './sonde.txt',
  './icon-192.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', evenement => {
  evenement.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(COQUILLE.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evenement => {
  evenement.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(nom => nom !== CACHE).map(nom => caches.delete(nom))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evenement => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;

  evenement.respondWith(
    caches.match(requete, { ignoreSearch: true }).then(depuisCache => {
      if (depuisCache) return marquer(depuisCache, 'cache');
      return fetch(requete)
        .then(reponse => marquer(reponse, 'reseau'))
        .catch(() => requete.mode === 'navigate'
          ? caches.match('./index.html').then(page => page ? marquer(page, 'cache') : Response.error())
          : Response.error());
    })
  );
});

function marquer(reponse, origine) {
  const entetes = new Headers(reponse.headers);
  entetes.set('X-Colorix-Origine', origine);
  entetes.set('X-Colorix-Cache', CACHE);
  return reponse.blob().then(corps => new Response(corps, {
    status: reponse.status,
    statusText: reponse.statusText,
    headers: entetes
  }));
}
