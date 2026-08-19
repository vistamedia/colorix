import { h, ailes, deuxChiffres, degradeCouverture, dureeCourte } from '../rendu.js';
import { albumsPossedes, planchesDe, photosDe, feutres, marques } from '../donnees.js';
import { palierAtteint, palierSuivant, PALIERS } from '../paliers.js';
import * as base from '../base.js';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const cleMois = (iso) => iso.slice(0, 7);

export async function monter() {
  const albums = await albumsPossedes();
  const toutes = (await Promise.all(albums.map(a => planchesDe(a.id)))).flat();
  const finies = toutes.filter(p => p.statut === 'termine' && p.date_fin);
  const [tousFeutres, listeMarques, nuanciers] = await Promise.all([
    feutres(), marques(), base.lireTout('nuanciers')
  ]);
  const nomMarque = new Map(listeMarques.map(m => [m.id, m.nom]));
  const parId = new Map(tousFeutres.map(f => [f.id, f]));

  const palier = palierAtteint(finies.length);
  const prochain = palierSuivant(finies.length);

  const urls = [];

  /* --- mosaïque par mois --- */
  const parMois = new Map();
  for (const p of finies) {
    const cle = cleMois(p.date_fin);
    if (!parMois.has(cle)) parMois.set(cle, []);
    parMois.get(cle).push(p);
  }
  const mosaique = h('div', {});
  for (const [cle, planches] of [...parMois.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    const [annee, mois] = cle.split('-');
    const grille = h('div', { class: 'mosaique' });
    for (const p of planches) {
      const photos = await photosDe(p.id);
      const vignette = photos.find(ph => ph.vignette) || photos[0];
      if (vignette?.blob) {
        const url = URL.createObjectURL(vignette.blob);
        urls.push(url);
        grille.append(h('div', { class: 'mosaique__case' }, h('img', { src: url, alt: '' })));
      } else {
        grille.append(h('div', { class: 'mosaique__case mosaique__case--vide' }, deuxChiffres(p.numero)));
      }
    }
    mosaique.append(
      h('h3', { class: 'stats__mois' }, `${MOIS[+mois - 1]} ${annee}`, h('span', {}, planches.length)),
      grille);
  }

  /* --- calendrier des douze derniers mois --- */
  const parJour = new Map();
  for (const p of finies) {
    const jour = p.date_fin.slice(0, 10);
    parJour.set(jour, (parJour.get(jour) || 0) + 1);
  }
  const calendrier = h('div', { class: 'calendrier' });
  const aujourdhui = new Date();
  for (let i = 364; i >= 0; i--) {
    const jour = new Date(aujourdhui.getTime() - i * 86400000).toISOString().slice(0, 10);
    const combien = parJour.get(jour) || 0;
    calendrier.append(h('span', {
      class: 'calendrier__jour',
      style: combien ? `background:var(--fee-flora);opacity:${Math.min(1, 0.35 + combien * 0.25)}` : '',
      title: `${jour}${combien ? ` · ${combien}` : ''}`
    }));
  }

  /* --- palmarès des feutres et usure --- */
  const emplois = new Map();
  for (const n of nuanciers) {
    for (const entree of n.entrees) {
      for (const id of entree.feutres) emplois.set(id, (emplois.get(id) || 0) + 1);
    }
  }
  const palmares = [...emplois.entries()]
    .map(([id, n]) => ({ feutre: parId.get(id), emplois: n }))
    .filter(x => x.feutre)
    .sort((a, b) => b.emplois - a.emplois);

  const maximum = palmares[0]?.emplois || 1;
  const barresFeutres = h('div', { class: 'palmares' },
    palmares.slice(0, 12).map(({ feutre, emplois }) =>
      h('div', { class: 'palmares__ligne' },
        h('span', { class: 'palmares__pastille', style: `background:${feutre.hex || '#EFE6F4'}` }),
        h('span', { class: 'palmares__ref' }, feutre.reference),
        h('span', { class: 'palmares__nom' }, feutre.nom),
        h('span', { class: 'palmares__barre' },
          h('span', { class: 'palmares__part', style: `width:${emplois / maximum * 100}%` })),
        h('span', { class: 'palmares__compte' }, emplois))));

  const courses = tousFeutres
    .filter(f => f.etat === 'a_sec' || f.etat === 'faible')
    .map(f => ({ f, emplois: emplois.get(f.id) || 0 }))
    .sort((a, b) => b.emplois - a.emplois);

  /* --- durées --- */
  const chronometrees = finies.filter(p => p.duree_cumulee_s > 0);
  const moyenne = chronometrees.length
    ? Math.round(chronometrees.reduce((s, p) => s + p.duree_cumulee_s, 0) / chronometrees.length)
    : null;

  const entete = h('header', { class: 'entete entete--decor' },
    ailes(),
    h('div', { class: 'entete__contenu' },
      h('h1', { class: 'titre-ecran' }, 'Mon travail'),
      h('div', { class: 'resumes' },
        h('div', { class: 'resume' },
          h('div', { class: 'resume__valeur' }, finies.length),
          h('div', { class: 'resume__libelle' }, 'planches finies')),
        h('div', { class: 'resume' },
          h('div', { class: 'resume__valeur' }, moyenne ? dureeCourte(moyenne) : '—'),
          h('div', { class: 'resume__libelle' }, 'durée moyenne')),
        h('div', { class: 'resume resume--large' },
          h('div', { class: palier ? 'resume__palier' : 'resume__valeur' }, palier ? palier.nom : '—'),
          h('div', { class: 'resume__libelle' },
            prochain ? `${prochain.seuil - finies.length} avant ${prochain.nom}` : 'palier ultime')))));

  const corps = h('div', { class: 'corps corps--stats' },
    h('h2', { class: 'section__titre' }, 'Progression par album'),
    albums.map(a => h('div', { class: 'stats__album' },
      h('div', { class: 'stats__album-ligne' },
        h('span', { class: 'stats__album-titre' }, a.titre),
        h('span', { class: 'carte-album__compte' }, `${a.faits} sur ${a.nb_coloriages}`)),
      h('div', { class: 'barre-album' },
        h('div', {
          class: 'barre-album__part',
          style: `width:${a.nb_coloriages ? a.faits / a.nb_coloriages * 100 : 0}%;background:${degradeCouverture(a.collection, a.ean13)}`
        })))),

    h('h2', { class: 'section__titre' }, 'Les paliers'),
    h('div', { class: 'paliers' }, PALIERS.map(p => h('span', {
      class: `palier${finies.length >= p.seuil ? ' palier--atteint' : ''}`
    }, p.nom))),

    h('h2', { class: 'section__titre' }, 'Une année de coloriage'),
    calendrier,

    finies.length ? h('h2', { class: 'section__titre' }, 'La mosaïque') : null,
    mosaique,

    palmares.length ? h('h2', { class: 'section__titre' }, 'Feutres les plus employés') : null,
    palmares.length ? barresFeutres : null,

    courses.length ? h('h2', { class: 'section__titre' }, 'À racheter') : null,
    courses.length ? h('div', { class: 'courses' }, courses.map(({ f, emplois }) =>
      h('div', { class: `course course--${f.etat}` },
        h('span', { class: 'palmares__pastille', style: `background:${f.hex || '#EFE6F4'}` }),
        h('span', { class: 'palmares__ref' }, f.reference),
        h('span', { class: 'palmares__nom' }, `${nomMarque.get(f.marque_id) || ''} · ${f.nom}`),
        h('span', { class: 'course__emplois' }, `${emplois} planche${emplois > 1 ? 's' : ''}`)))) : null,

    !finies.length ? h('p', { class: 'vide' },
      h('strong', {}, 'Rien à montrer pour l’instant'),
      'Termine une planche et elle apparaîtra ici.') : null);

  return {
    element: h('div', { class: 'vue' }, entete, corps),
    demonter: () => urls.forEach(URL.revokeObjectURL)
  };
}
