const CACHE = 'colorix-22';
const CACHE_COUVERTURES = 'colorix-couvertures-1';

const COQUILLE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './app/styles.css',
  './app/principal.js',
  './app/rendu.js',
  './app/base.js',
  './app/donnees.js',
  './app/couleur.js',
  './app/photo.js',
  './app/zip.js',
  './app/partage.js',
  './app/nuancier-photo.js',
  './app/viseur.js',
  './app/maj.js',
  './app/symboles.js',
  './app/paliers.js',
  './app/preferences.js',
  './app/vues/bibliotheque.js',
  './app/vues/catalogue.js',
  './app/vues/album.js',
  './app/vues/fiche.js',
  './app/vues/relever-nuancier.js',
  './app/vues/proposer.js',
  './app/vues/attribution.js',
  './app/vues/pipette.js',
  './app/vues/terminer.js',
  './app/vues/nommer-symbole.js',
  './app/vues/feutres.js',
  './app/vues/importer-nuancier.js',
  './app/vues/stats.js',
  './app/vues/reglages.js',
  './polices/baloo2-latin.woff2',
  './polices/baloo2-latin-ext.woff2',
  './polices/grotesk-latin.woff2',
  './polices/grotesk-latin-ext.woff2',
  './data/catalogue.json',
  './data/nuanciers/guangna-360.json',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', evenement => {
  evenement.waitUntil(
    caches.open(CACHE)
      /* cache: 'reload' — sans quoi le précache recopie la version périmée
         que le cache HTTP détient encore, et la mise à jour n'arrive jamais. */
      .then(cache => cache.addAll(COQUILLE.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evenement => {
  evenement.waitUntil(
    caches.keys()
      .then(noms => Promise.all(
        noms.filter(nom => nom !== CACHE && nom !== CACHE_COUVERTURES).map(nom => caches.delete(nom))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evenement => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;

  const url = new URL(requete.url);
  if (url.origin !== location.origin) return;

  /* Les couvertures ne sont jamais précachées : cache à la demande après
     premier affichage, repli sur la pastille de couleur. SPECS §4.1. */
  if (url.pathname.includes('/data/couvertures/')) {
    evenement.respondWith(
      caches.open(CACHE_COUVERTURES).then(cache =>
        cache.match(requete).then(connue => connue || fetch(requete).then(reponse => {
          if (reponse.ok) cache.put(requete, reponse.clone());
          return reponse;
        })))
    );
    return;
  }

  evenement.respondWith(
    caches.match(requete, { ignoreSearch: true }).then(connue =>
      connue || fetch(requete).catch(() =>
        requete.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
  );
});
