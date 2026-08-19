const HEURES_REQUISES = 72;
const NB_BLOCS = 50;
const TAILLE_BLOC = 1024 * 1024;

const sections = new Map(
  ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].map(id => [id, document.getElementById(id)])
);

function poser(id, cle, valeur) {
  const liste = sections.get(id).querySelector('dl');
  let ligne = liste.querySelector(`[data-cle="${cle}"]`);
  if (!ligne) {
    ligne = document.createElement('div');
    ligne.dataset.cle = cle;
    ligne.innerHTML = '<dt></dt><dd></dd>';
    ligne.querySelector('dt').textContent = cle;
    liste.append(ligne);
  }
  ligne.querySelector('dd').textContent = valeur;
  ecrireRapport();
}

function verdict(id, etat, texte) {
  const pastille = sections.get(id).querySelector('.verdict');
  pastille.dataset.etat = etat;
  pastille.textContent = texte;
  ecrireRapport();
}

function journaliser(id, texte) {
  sections.get(id).querySelector('.journal').textContent = texte;
  ecrireRapport();
}

function vider(id) {
  sections.get(id).querySelector('dl').replaceChildren();
}

function surAction(nom, traitement) {
  const bouton = document.querySelector(`[data-action="${nom}"]`);
  bouton.addEventListener('click', () => traitement(bouton));
  return bouton;
}

function octets(n) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1048576).toFixed(2)} Mo`;
}

function duree(ms) {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(s % 60).padStart(2, '0')} s`;
}

/* ---------- V1 : hébergement ---------- */

function verifierHebergement() {
  poser('v1', 'origine', location.origin);
  poser('v1', 'protocole', location.protocol);
  poser('v1', 'contexte sûr', String(window.isSecureContext));

  const enHttps = location.protocol === 'https:';
  if (enHttps && window.isSecureContext) {
    verdict('v1', 'ok', 'OK');
  } else {
    verdict('v1', 'echec', 'ÉCHEC');
    poser('v1', 'cause', enHttps
      ? 'contexte non sûr — certificat probablement invalide'
      : 'servi hors HTTPS, le service worker est refusé');
  }
}

/* ---------- V2 : service worker ---------- */

function modeAffichage() {
  if (navigator.standalone) return 'standalone (icône iOS)';
  if (matchMedia('(display-mode: standalone)').matches) return 'standalone';
  return 'onglet Safari';
}

async function verifierServiceWorker() {
  poser('v2', 'affichage', modeAffichage());
  poser('v2', 'réseau', navigator.onLine ? 'en ligne' : 'hors ligne');

  if (!('serviceWorker' in navigator)) {
    verdict('v2', 'echec', 'ÉCHEC');
    poser('v2', 'cause', 'API service worker absente');
    return;
  }

  try {
    const inscription = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    poser('v2', 'portée', inscription.scope);
    await navigator.serviceWorker.ready;

    const cles = await caches.keys();
    poser('v2', 'caches', cles.join(', ') || 'aucun');
    if (cles.length) {
      const entrees = await (await caches.open(cles[0])).keys();
      poser('v2', 'entrées', String(entrees.length));
    }

    const etatControleur = () => poser('v2', 'contrôleur',
      navigator.serviceWorker.controller ? 'actif' : 'absent — recharge la page');
    navigator.serviceWorker.addEventListener('controllerchange', etatControleur);
    etatControleur();

    verdict('v2', 'attente', 'À TESTER');
  } catch (erreur) {
    verdict('v2', 'echec', 'ÉCHEC');
    poser('v2', 'cause', erreur.message);
  }
}

surAction('sonder-cache', async bouton => {
  bouton.disabled = true;
  try {
    const reponse = await fetch('./sonde.txt', { cache: 'no-store' });
    const origine = reponse.headers.get('X-Colorix-Origine') || 'inconnue';
    poser('v2', 'sonde', `${(await reponse.text()).trim()} — via ${origine}`);
    const horsLigne = !navigator.onLine;
    verdict('v2', origine === 'cache' && horsLigne ? 'ok' : 'attente',
      origine === 'cache' && horsLigne ? 'OK' : 'À TESTER');
    journaliser('v2', origine !== 'cache'
      ? `Servi depuis « ${origine} » : le cache ne couvre pas cette ressource.`
      : horsLigne
        ? 'Servi depuis le cache, en mode avion : la vérification est remplie.'
        : 'Servi depuis le cache, mais tu es en ligne. Repasse en mode avion et refais ce test.');
  } catch (erreur) {
    poser('v2', 'sonde', `échec — ${erreur.message}`);
    journaliser('v2', 'Rien n’a été servi : le cache ne couvre pas cette ressource.');
  }
  bouton.disabled = false;
});

/* ---------- V3 : persistance ---------- */

function ouvrirBase() {
  return new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open('colorix-verifications', 1);
    requete.onupgradeneeded = () => {
      const base = requete.result;
      base.createObjectStore('blocs');
      base.createObjectStore('meta');
    };
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

function transiger(base, magasins, mode, traitement) {
  return new Promise((resoudre, rejeter) => {
    const transaction = base.transaction(magasins, mode);
    const resultat = traitement(transaction);
    transaction.oncomplete = () => resoudre(resultat);
    transaction.onerror = () => rejeter(transaction.error);
    transaction.onabort = () => rejeter(transaction.error);
  });
}

function lire(magasin, cle) {
  return new Promise((resoudre, rejeter) => {
    const requete = magasin.get(cle);
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

function fabriquerBloc(index) {
  const donnees = new Uint8Array(TAILLE_BLOC);
  for (let i = 0; i < TAILLE_BLOC; i++) donnees[i] = (i * 31 + index * 17) & 255;
  return new Blob([donnees]);
}

function blocIntact(donnees, index) {
  if (donnees.length !== TAILLE_BLOC) return false;
  return [0, 524288, TAILLE_BLOC - 1].every(i => donnees[i] === ((i * 31 + index * 17) & 255));
}

async function etatPersistance() {
  if (!navigator.storage) return;
  const accorde = await navigator.storage.persisted();
  const definitif = accorde || await navigator.storage.persist();
  poser('v3', 'persistance', definitif ? 'accordée' : 'refusée');
  const { usage, quota } = await navigator.storage.estimate();
  poser('v3', 'quota', `${octets(usage)} utilisés sur ${octets(quota)}`);
}

surAction('ecrire-50mo', async bouton => {
  bouton.disabled = true;
  const base = await ouvrirBase();
  const debut = Date.now();
  try {
    for (let index = 0; index < NB_BLOCS; index++) {
      const bloc = fabriquerBloc(index);
      await transiger(base, ['blocs'], 'readwrite', t => t.objectStore('blocs').put(bloc, index));
      journaliser('v3', `Écriture ${index + 1} / ${NB_BLOCS}…`);
    }
    await transiger(base, ['meta'], 'readwrite', t =>
      t.objectStore('meta').put({ date: Date.now(), blocs: NB_BLOCS }, 'ecriture'));
    journaliser('v3', `${NB_BLOCS} Mo écrits en ${duree(Date.now() - debut)}. Ferme l’app et reviens dans 72 h.`);
    await relirePersistance();
  } catch (erreur) {
    journaliser('v3', `Écriture interrompue : ${erreur.message}`);
    verdict('v3', 'echec', 'ÉCHEC');
  }
  base.close();
  bouton.disabled = false;
});

async function relirePersistance() {
  const base = await ouvrirBase();
  const marque = await transiger(base, ['meta'], 'readonly', t => lire(t.objectStore('meta'), 'ecriture'));

  vider('v3');
  await etatPersistance();

  if (!marque) {
    poser('v3', 'écriture', 'aucune');
    verdict('v3', 'attente', 'À FAIRE');
    journaliser('v3', 'Rien n’a encore été écrit. Lance « Écrire 50 Mo », puis reviens dans 72 h.');
    base.close();
    return;
  }

  const ecoule = Date.now() - marque.date;
  poser('v3', 'écrit le', new Date(marque.date).toLocaleString('fr-FR'));
  poser('v3', 'ancienneté', duree(ecoule));

  let intacts = 0;
  for (let index = 0; index < marque.blocs; index++) {
    const bloc = await transiger(base, ['blocs'], 'readonly', t => lire(t.objectStore('blocs'), index));
    if (bloc && blocIntact(new Uint8Array(await bloc.arrayBuffer()), index)) intacts++;
  }
  base.close();

  poser('v3', 'blocs relus', `${intacts} / ${marque.blocs}`);
  const heures = ecoule / 3600000;

  if (intacts !== marque.blocs) {
    verdict('v3', 'echec', 'ÉCHEC');
    journaliser('v3', `Des données ont disparu après ${duree(ecoule)}. Le stockage n’est pas fiable pour les photos.`);
  } else if (heures >= HEURES_REQUISES) {
    verdict('v3', 'ok', 'OK');
    journaliser('v3', `50 Mo intacts après ${duree(ecoule)}. Vérification remplie.`);
  } else {
    verdict('v3', 'attente', 'EN COURS');
    journaliser('v3', `Intact, mais il reste ${duree((HEURES_REQUISES - heures) * 3600000)} avant les 72 h.`);
  }
}

surAction('relire', async bouton => {
  bouton.disabled = true;
  journaliser('v3', 'Relecture…');
  await relirePersistance();
  bouton.disabled = false;
});

surAction('effacer', async bouton => {
  bouton.disabled = true;
  const base = await ouvrirBase();
  await transiger(base, ['blocs', 'meta'], 'readwrite', t => {
    t.objectStore('blocs').clear();
    t.objectStore('meta').clear();
  });
  base.close();
  journaliser('v3', 'Effacé.');
  await relirePersistance();
  bouton.disabled = false;
});

/* ---------- V4 : format de capture ---------- */

function signature(donnees) {
  const hexa = [...donnees.slice(0, 16)].map(o => o.toString(16).padStart(2, '0')).join(' ');
  const texte = n => String.fromCharCode(...donnees.slice(n, n + 4));

  let format = 'inconnu';
  if (donnees[0] === 0xFF && donnees[1] === 0xD8 && donnees[2] === 0xFF) format = 'JPEG';
  else if (texte(0) === '\x89PNG') format = 'PNG';
  else if (texte(4) === 'ftyp') format = `ISO-BMFF, marque « ${texte(8)} »`;
  else if (texte(0) === 'RIFF' && texte(8) === 'WEBP') format = 'WebP';

  return { hexa, format };
}

const voiesTestees = new Map();

async function analyserFichier(fichier, voie) {
  journaliser('v4', `Analyse de « ${fichier.name} »…`);

  const entete = new Uint8Array(await fichier.slice(0, 16).arrayBuffer());
  const { hexa, format } = signature(entete);

  const debut = performance.now();
  try {
    const image = await createImageBitmap(fichier);
    const msDecodage = Math.round(performance.now() - debut);

    const facteur = Math.min(1, 1600 / Math.max(image.width, image.height));
    const largeur = Math.round(image.width * facteur);
    const hauteur = Math.round(image.height * facteur);
    const toile = new OffscreenCanvas(largeur, hauteur);
    toile.getContext('2d').drawImage(image, 0, 0, largeur, hauteur);
    const jpeg = await toile.convertToBlob({ type: 'image/jpeg', quality: 0.8 });

    poser('v4', voie, `${format} · ${fichier.type || 'type vide'} · ${image.width}×${image.height}`
      + ` en ${msDecodage} ms → ${largeur}×${hauteur}, ${octets(jpeg.size)}`);
    image.close();

    voiesTestees.set(voie, format);
    verdict('v4', 'ok', `OK ${voiesTestees.size}/3`);
    journaliser('v4', [...voiesTestees.values()].every(f => f === 'JPEG')
      ? `Safari livre du JPEG et le canvas le relit : pipeline direct, aucun décodeur à embarquer. Octets : ${hexa}`
      : `Formats bruts mêlés (${[...voiesTestees.values()].join(', ')}), mais le canvas les relit tous. Aucun décodeur à embarquer.`);
  } catch (erreur) {
    poser('v4', voie, `${format} — décodage impossible : ${erreur.message}`);
    verdict('v4', 'echec', 'ÉCHEC');
    journaliser('v4', `Le canvas ne sait pas lire ce fichier (${format}). Il faudra décoder côté client, ce qui change l’architecture des photos.`);
  }
}

for (const champ of document.querySelectorAll('#v4 input[type=file]')) {
  champ.addEventListener('change', () => {
    if (champ.files[0]) analyserFichier(champ.files[0], champ.dataset.voie);
  });
}

/* ---------- V5 : partage ---------- */

async function imageEssai() {
  const toile = new OffscreenCanvas(1200, 1200);
  const pinceau = toile.getContext('2d');
  const fond = pinceau.createLinearGradient(0, 0, 1200, 1200);
  fond.addColorStop(0, '#3B1E5C');
  fond.addColorStop(0.55, '#7A2B7E');
  fond.addColorStop(1, '#C4218F');
  pinceau.fillStyle = fond;
  pinceau.fillRect(0, 0, 1200, 1200);
  pinceau.fillStyle = '#FFC22E';
  pinceau.font = 'bold 96px -apple-system, system-ui, sans-serif';
  pinceau.textAlign = 'center';
  pinceau.fillText('Colorix', 600, 630);
  const blob = await toile.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  return new File([blob], 'colorix-essai.jpg', { type: 'image/jpeg' });
}

surAction('partager', async bouton => {
  bouton.disabled = true;
  try {
    const fichier = await imageEssai();
    poser('v5', 'fichier', `${octets(fichier.size)}, ${fichier.type}`);

    if (!navigator.canShare || !navigator.canShare({ files: [fichier] })) {
      poser('v5', 'canShare', 'refusé pour les fichiers');
      verdict('v5', 'echec', 'ÉCHEC');
      journaliser('v5', 'Le partage de fichier n’est pas accepté. Le bouton de partage devra se limiter au texte.');
      bouton.disabled = false;
      return;
    }

    poser('v5', 'canShare', 'accepté');
    await navigator.share({ files: [fichier], text: 'Colorix — essai de partage' });
    poser('v5', 'partage', 'feuille validée');
    verdict('v5', 'ok', 'OK');
    journaliser('v5', 'Vérifie maintenant que la photo est bien arrivée entière dans l’app cible.');
  } catch (erreur) {
    const annule = erreur.name === 'AbortError';
    poser('v5', 'partage', annule ? 'annulé' : `échec — ${erreur.message}`);
    verdict('v5', annule ? 'attente' : 'echec', annule ? 'ANNULÉ' : 'ÉCHEC');
    journaliser('v5', annule ? 'Feuille de partage fermée sans choisir d’app.' : erreur.message);
  }
  bouton.disabled = false;
});

/* ---------- V6 : Wake Lock ---------- */

let verrou = null;
let obtenuLe = 0;
let minuteur = 0;

const boutonRelacher = surAction('relacher', async () => {
  if (verrou) await verrou.release();
});

surAction('verrou', async bouton => {
  poser('v6', 'affichage', modeAffichage());

  if (!('wakeLock' in navigator)) {
    poser('v6', 'API', 'absente');
    verdict('v6', 'echec', 'ÉCHEC');
    journaliser('v6', 'Pas de Wake Lock : l’écran s’éteindra pendant le coloriage. L’app ne devra rien afficher à ce sujet.');
    return;
  }

  try {
    verrou = await navigator.wakeLock.request('screen');
    obtenuLe = Date.now();
    bouton.disabled = true;
    boutonRelacher.disabled = false;
    poser('v6', 'état', 'tenu');
    verdict('v6', 'ok', 'TENU');
    journaliser('v6', 'Pose le téléphone et laisse tourner. Si l’écran s’éteint, la vérification échoue.');

    minuteur = setInterval(() => poser('v6', 'tenu depuis', duree(Date.now() - obtenuLe)), 1000);

    verrou.addEventListener('release', () => {
      clearInterval(minuteur);
      poser('v6', 'état', `relâché après ${duree(Date.now() - obtenuLe)}`);
      verdict('v6', 'attente', 'RELÂCHÉ');
      journaliser('v6', document.visibilityState === 'hidden'
        ? 'Relâché parce que l’app est passée en arrière-plan : c’est le comportement normal.'
        : 'Relâché alors que l’app était au premier plan — à me signaler.');
      verrou = null;
      bouton.disabled = false;
      boutonRelacher.disabled = true;
    });
  } catch (erreur) {
    poser('v6', 'état', `refusé — ${erreur.message}`);
    verdict('v6', 'echec', 'ÉCHEC');
    journaliser('v6', erreur.message);
  }
});

/* ---------- rapport ---------- */

function ecrireRapport() {
  const lignes = [
    `Colorix — vérifications du jalon 0`,
    `${new Date().toLocaleString('fr-FR')} · ${modeAffichage()} · ${navigator.onLine ? 'en ligne' : 'hors ligne'}`,
    navigator.userAgent,
    ''
  ];
  for (const [id, section] of sections) {
    const titre = section.querySelector('h2').textContent;
    const etat = section.querySelector('.verdict').textContent;
    lignes.push(`${titre} → ${etat}`);
    for (const ligne of section.querySelectorAll('dl div')) {
      lignes.push(`   ${ligne.querySelector('dt').textContent} : ${ligne.querySelector('dd').textContent}`);
    }
    const journal = section.querySelector('.journal');
    if (journal && journal.textContent) lignes.push(`   → ${journal.textContent}`);
    lignes.push('');
  }
  document.getElementById('rapport').value = lignes.join('\n');
}

surAction('copier', async () => {
  const zone = document.getElementById('rapport');
  const journal = document.querySelector('#rapport-section .journal');
  try {
    await navigator.clipboard.writeText(zone.value);
    journal.textContent = 'Rapport copié.';
  } catch {
    zone.removeAttribute('readonly');
    zone.select();
    journal.textContent = 'Copie automatique refusée : sélectionne le texte et copie-le à la main.';
  }
});

/* ---------- démarrage ---------- */

if (modeAffichage() === 'onglet Safari') {
  const bandeau = document.getElementById('avertissement');
  bandeau.textContent = 'Tu es dans Safari : V2, V3 et V6 ne peuvent pas se valider ici. Partager → Sur l’écran d’accueil, puis rouvre depuis l’icône.';
  bandeau.hidden = false;
}

verifierHebergement();
await verifierServiceWorker();
await relirePersistance();
poser('v6', 'affichage', modeAffichage());
poser('v6', 'API', 'wakeLock' in navigator ? 'disponible' : 'absente');
ecrireRapport();
