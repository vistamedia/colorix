/* Mise à jour à la demande. Sans elle, la nouvelle coquille n'arrive qu'au
   deuxième lancement : le service worker s'installe au premier, la page n'en
   profite qu'au suivant. Retirer la web app de l'écran d'accueil marcherait
   aussi, mais iOS efface alors son IndexedDB — tout serait perdu. */

const EST_VERSION = /^colorix-\d+$/;

export async function versionInstallee() {
  const noms = await caches.keys();
  return noms.find(nom => EST_VERSION.test(nom)) || null;
}

/* Attend qu'un worker sorte de l'installation, dans un sens ou dans l'autre. */
function attendreEtat(worker) {
  return new Promise(resolve => {
    const regarder = () => {
      if (worker.state !== 'activated' && worker.state !== 'redundant') return;
      worker.removeEventListener('statechange', regarder);
      resolve(worker.state);
    };
    worker.addEventListener('statechange', regarder);
    regarder();
  });
}

export async function chercherMiseAJour() {
  const enregistrement = await navigator.serviceWorker?.getRegistration();
  if (!enregistrement) return 'sans-worker';

  /* skipWaiting() peut avoir activé le nouveau worker avant que update() ne
     rende la main : on le retient au vol plutôt que de le chercher après. */
  let nouveau = null;
  const surTrouvaille = () => { nouveau = enregistrement.installing; };
  enregistrement.addEventListener('updatefound', surTrouvaille);
  try {
    await enregistrement.update();
  } catch {
    return 'hors-ligne';
  } finally {
    enregistrement.removeEventListener('updatefound', surTrouvaille);
  }

  nouveau = nouveau || enregistrement.installing || enregistrement.waiting;
  if (!nouveau) return 'a-jour';

  return await attendreEtat(nouveau) === 'redundant' ? 'echec' : 'installee';
}
