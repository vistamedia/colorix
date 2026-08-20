import { h, icone } from './rendu.js';
import * as bibliotheque from './vues/bibliotheque.js';
import * as catalogue from './vues/catalogue.js';
import * as album from './vues/album.js';
import * as fiche from './vues/fiche.js';
import * as releverNuancier from './vues/relever-nuancier.js';
import * as proposer from './vues/proposer.js';
import * as attribution from './vues/attribution.js';
import * as pipette from './vues/pipette.js';
import * as feutres from './vues/feutres.js';
import * as importerNuancier from './vues/importer-nuancier.js';
import * as stats from './vues/stats.js';
import * as reglages from './vues/reglages.js';

const ROUTES = [
  [/^\/albums$/, bibliotheque, 'albums'],
  [/^\/catalogue$/, catalogue, 'albums'],
  [/^\/album\/(.+)$/, album, 'albums'],
  [/^\/planche\/([^/]+)$/, fiche, null],
  [/^\/planche\/([^/]+)\/nuancier$/, releverNuancier, null],
  [/^\/planche\/([^/]+)\/proposer$/, proposer, null],
  [/^\/planche\/([^/]+)\/code\/(.+)$/, attribution, null],
  [/^\/pipette\/([^/]+)\/(.+)$/, pipette, null],
  [/^\/feutres$/, feutres, 'feutres'],
  [/^\/feutres\/importer$/, importerNuancier, 'feutres'],
  [/^\/stats$/, stats, 'stats'],
  [/^\/reglages$/, reglages, 'reglages']
];

const ONGLETS = [
  ['albums', 'Albums', '#/albums'],
  ['feutres', 'Feutres', '#/feutres'],
  ['stats', 'Stats', '#/stats'],
  ['reglages', 'Réglages', '#/reglages']
];

const conteneur = document.getElementById('ecran');
const barre = document.getElementById('onglets');
let vueActive = null;

function construireOnglets() {
  for (const [cle, libelle, route] of ONGLETS) {
    barre.append(h('a', { class: 'onglet', href: route, 'data-onglet': cle },
      icone(cle), h('span', {}, libelle)));
  }
}

function marquerOnglet(actif) {
  barre.hidden = !actif;
  for (const lien of barre.children) {
    if (lien.dataset.onglet === actif) lien.setAttribute('aria-current', 'page');
    else lien.removeAttribute('aria-current');
  }
}

async function afficher() {
  const chemin = location.hash.slice(1) || '/albums';
  const trouvee = ROUTES.find(([motif]) => motif.test(chemin));

  if (!trouvee) return naviguer('#/albums');
  const [motif, module, onglet] = trouvee;

  if (vueActive?.demonter) vueActive.demonter();

  const parametres = chemin.match(motif).slice(1).map(decodeURIComponent);
  vueActive = await module.monter(...parametres);

  conteneur.replaceChildren(vueActive.element);
  marquerOnglet(onglet);
  conteneur.scrollTop = 0;
}

/* L'enregistrement du service worker est dans `index.html`, hors du graphe de
   modules : d'ici, une erreur de syntaxe l'empêcherait, et le correctif
   n'arriverait jamais sur l'appareil. */
async function demarrer() {
  construireOnglets();
  addEventListener('hashchange', afficher);
  await afficher();
}

demarrer();
