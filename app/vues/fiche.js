import { h, naviguer, dureeCourte } from '../rendu.js';
import { encreSur } from '../couleur.js';
import { planche, nuancier, feutres, marques, majPlanche, terminer, reprendreNuancier, planchesDe, contexteNuancier } from '../donnees.js';
import { miseEnPage } from '../preferences.js';
import { panneauTerminer } from './terminer.js';
import { partager } from '../partage.js';

let verrou = null;

async function prendreVerrou() {
  try { verrou = await navigator.wakeLock.request('screen'); } catch { verrou = null; }
}

function relacherVerrou() {
  verrou?.release().catch(() => {});
  verrou = null;
}

function libelleTeinte(entree, attribues) {
  if (entree.teinte) return entree.teinte;
  return attribues.map(f => f.nom).filter(Boolean).join(' + ');
}

/* ---------- mise en page A : ordre du livre, sobre ---------- */

function rangeeA(entree, attribues, ouvrir) {
  const hex = entree.pastille_hex || '#EFE6F4';
  const principal = attribues[0];
  const dessus = attribues[1];

  const reference = principal
    ? h('span', { class: 'reference' }, principal.reference)
    : h('span', { class: 'reference reference--vide' }, 'à attribuer');

  return h('button', { class: 'rangee', onclick: ouvrir },
    h('span', {
      class: 'pastille',
      style: `background:${hex};color:${encreSur(hex)}`
    }, entree.code),
    h('span', { class: 'rangee__texte' },
      h('span', { class: 'rangee__ligne' },
        reference,
        principal && h('span', { class: 'marque' }, principal.marque_nom)),
      h('span', { class: 'teinte' }, libelleTeinte(entree, attribues))),
    dessus && h('span', { class: 'superpose' },
      h('span', { class: 'superpose__ref' }, dessus.reference),
      h('span', { class: 'superpose__libelle' }, '+ dessus')),
    !principal && h('span', { class: 'plus' }, '＋'));
}

/* ---------- mise en page B : manquants en tête, bandes pleines ---------- */

function rangeeB(entree, attribues, ouvrir) {
  const hex = entree.pastille_hex || '#EFE6F4';
  const principal = attribues[0];
  const dessus = attribues[1];

  return h('button', { class: 'rangee rangee--bande', onclick: ouvrir },
    h('span', { class: 'bande', style: `background:${hex};color:${encreSur(hex)}` }, entree.code),
    h('span', { class: 'rangee__corps' },
      h('span', { class: 'rangee__texte' },
        h('span', { class: 'reference reference--large' }, principal.reference),
        h('span', { class: 'teinte' },
          [principal.marque_nom, libelleTeinte(entree, attribues)].filter(Boolean).join(' · '))),
      dessus && h('span', { class: 'badge-superpose' },
        h('span', { class: 'badge-superpose__ref' }, dessus.reference),
        h('span', { class: 'badge-superpose__libelle' }, 'dessus'))));
}

function bandeauManquants(manquants, ouvrir) {
  if (!manquants.length) return null;
  return h('div', { class: 'manquants' },
    h('div', { class: 'manquants__entete' },
      h('span', { class: 'manquants__titre' },
        `${manquants.length} code${manquants.length > 1 ? 's' : ''} t'attend${manquants.length > 1 ? 'ent' : ''} encore`),
      h('span', { class: 'manquants__aide' }, 'tape pour choisir')),
    h('div', { class: 'manquants__bande' },
      manquants.map(e => {
        const hex = e.pastille_hex || '#EFE6F4';
        return h('button', {
          class: 'pastille-manquante',
          style: `background:${hex};color:${encreSur(hex)}`,
          onclick: () => ouvrir(e.code)
        }, e.code);
      })));
}

/* ---------- montage ---------- */

export async function monter(coloriageId) {
  const courante = await planche(coloriageId);
  if (!courante) return { element: h('div', { class: 'vue' }, h('p', { class: 'vide' }, 'Planche introuvable.')) };

  const [contexte, tousFeutres, listeMarques, soeurs] = await Promise.all([
    contexteNuancier(courante.livre_id), feutres(), marques(), planchesDe(courante.livre_id)
  ]);
  const fiche = contexte.fiche;
  const n = await nuancier(coloriageId, contexte.jeu, contexte.teintes);

  const parId = new Map(tousFeutres.map(f => [f.id, f]));
  const nomMarque = new Map(listeMarques.map(m => [m.id, m.nom]));
  const resoudre = (ids) => ids
    .map(id => parId.get(id))
    .filter(Boolean)
    .map(f => ({ ...f, marque_nom: nomMarque.get(f.marque_id) || '' }));

  const attribuees = n.entrees.filter(e => e.feutres.length);
  const manquantes = n.entrees.filter(e => !e.feutres.length);
  const ouvrir = (code) => naviguer(`#/planche/${coloriageId}/code/${encodeURIComponent(code)}`);

  const layout = miseEnPage();
  const part = n.entrees.length ? attribuees.length / n.entrees.length * 100 : 0;

  const entete = h('header', { class: `entete ${layout === 'B' ? 'entete--decor' : 'entete--sobre'}` },
    layout === 'B' && h('div', { class: 'halo' }),
    layout === 'B' && h('div', { class: 'aile aile--grande' }),
    h('div', { class: 'entete__contenu' },
      h('div', { class: 'entete__ligne' },
        h('div', { class: 'entete__identite' },
          h('div', { class: 'sur-titre' }, fiche ? fiche.titre.replace(/\s*[-—]\s*/, ' · ') : ''),
          h('h1', { class: 'titre-planche' }, `Planche ${courante.numero}`)),
        courante.statut === 'en_cours' && h('span', { class: 'chip' }, 'En cours'),
        courante.statut === 'termine' && h('span', { class: 'chip chip--fini' }, 'Terminé')),
      h('div', { class: 'progression' },
        h('div', { class: 'progression__piste' },
          h('div', { class: 'progression__part', style: `width:${part}%` })),
        h('span', { class: 'progression__compte' },
          `${attribuees.length} / ${n.entrees.length}${layout === 'A' ? ' codes' : ''}`))));

  const liste = layout === 'A'
    ? n.entrees.map(e => rangeeA(e, resoudre(e.feutres), () => ouvrir(e.code)))
    : attribuees.map(e => rangeeB(e, resoudre(e.feutres), () => ouvrir(e.code)));

  const corps = h('div', { class: 'corps' },
    n.entrees.length
      ? liste
      : h('p', { class: 'vide' },
          h('strong', {}, 'Aucun code'),
          'Ce livre n’a pas encore de jeu de codes. Renseigne-le dans les réglages de l’album.'));

  /* chrono : un seul bouton, pas de remise à zéro visible. SPECS §5. */
  let cumul = courante.duree_cumulee_s || 0;
  let depuis = null;
  let battement = null;

  const affichageChrono = h('span', {}, dureeCourte(cumul));
  const pastille = h('span', { class: 'pastille-chrono' });
  const boutonChrono = h('button', { class: 'bouton bouton--chrono' }, pastille, affichageChrono);

  const rafraichirChrono = () => {
    affichageChrono.textContent = dureeCourte(cumul + (depuis ? Math.round((Date.now() - depuis) / 1000) : 0));
  };
  const arreterChrono = async () => {
    if (!depuis) return;
    cumul += Math.round((Date.now() - depuis) / 1000);
    depuis = null;
    clearInterval(battement);
    battement = null;
    pastille.classList.remove('pastille-chrono--actif');
    await majPlanche(coloriageId, { duree_cumulee_s: cumul });
    rafraichirChrono();
  };
  boutonChrono.addEventListener('click', () => {
    if (depuis) return arreterChrono();
    depuis = Date.now();
    pastille.classList.add('pastille-chrono--actif');
    battement = setInterval(rafraichirChrono, 1000);
  });

  const derniereFinie = soeurs
    .filter(p => p.id !== coloriageId && p.statut === 'termine')
    .sort((a, b) => (b.date_fin || '').localeCompare(a.date_fin || ''))[0];

  const reprise = derniereFinie && manquantes.length
    ? h('button', {
        class: 'bouton--secondaire',
        onclick: async () => {
          await reprendreNuancier(derniereFinie.id, coloriageId, contexte);
          location.reload();
        }
      }, `Reprendre le nuancier de la planche ${derniereFinie.numero}`)
    : null;

  const employes = attribuees.flatMap(e => resoudre(e.feutres));

  const boutonTerminer = courante.statut === 'termine'
    ? h('button', {
        class: 'bouton bouton--primaire',
        onclick: () => partager(courante, fiche, employes).catch(() => {})
      }, 'Partager ✦')
    : h('button', {
        class: 'bouton bouton--primaire',
        onclick: async () => {
          await arreterChrono();
          panneauTerminer(courante, async (sujet) => {
            await terminer(coloriageId, sujet);
            naviguer(`#/album/${courante.livre_id}`);
          });
        }
      }, 'Terminé ✦');

  const actions = h('div', { class: `actions${reprise ? ' actions--colonne' : ''}` },
    reprise,
    reprise
      ? h('div', { class: 'actions__ligne' }, boutonChrono, boutonTerminer)
      : [boutonChrono, boutonTerminer]);

  prendreVerrou();

  return {
    element: h('div', { class: 'vue' },
      entete,
      layout === 'B' ? bandeauManquants(manquantes, ouvrir) : null,
      corps,
      actions),
    demonter: () => { arreterChrono(); relacherVerrou(); }
  };
}
