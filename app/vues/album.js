import { h, ailes, deuxChiffres, naviguer } from '../rendu.js';
import { livre, planchesDe, possessions, photosDe, demarrer, avancementNuanciers } from '../donnees.js';

export async function monter(livreId) {
  const [fiche, planches, poss] = await Promise.all([
    livre(livreId), planchesDe(livreId), possessions()
  ]);
  const possession = poss.find(p => p.livre_id === livreId);
  if (!fiche || !possession) return { element: h('div', { class: 'vue' }, h('p', { class: 'vide' }, 'Album introuvable.')) };

  const total = possession.nb_coloriages;
  const faites = planches.filter(p => p.statut === 'termine').length;
  const enCours = planches.find(p => p.statut === 'en_cours');
  const reprise = enCours || planches.find(p => p.statut === 'pas_commence');

  /* L'avancement du nuancier, dans l'angle opposé au numéro : le nombre de
     codes qui attendent encore un feutre, un point quand ils l'ont tous. Rien
     tant que la planche n'a pas été relevée — sans palette, il n'y a rien à
     compter, et un zéro se lirait « complète ». */
  const avancement = await avancementNuanciers(planches.map(p => p.id));
  const marqueNuancier = (id) => {
    const manquants = avancement.get(id);
    if (manquants === undefined) return null;
    return manquants
      ? h('span', {
          class: 'planche__nuancier',
          'aria-label': `${manquants} code${manquants > 1 ? 's' : ''} sans feutre`
        }, manquants)
      : h('span', { class: 'planche__nuancier planche__nuancier--pret', 'aria-label': 'nuancier complet' });
  };

  const urls = [];
  const tuiles = await Promise.all(planches.map(async (p) => {
    const numero = deuxChiffres(p.numero);

    if (p.statut === 'termine') {
      const photos = await photosDe(p.id);
      const vignette = photos.find(ph => ph.vignette) || photos[0];
      if (vignette?.blob) {
        const url = URL.createObjectURL(vignette.blob);
        urls.push(url);
        return h('a', { class: 'planche', href: `#/planche/${p.id}` },
          h('img', { src: url, alt: '' }),
          h('span', { class: 'planche__pilule' }, numero),
          marqueNuancier(p.id));
      }
      return h('a', { class: 'planche planche--finie', href: `#/planche/${p.id}` },
        h('span', { class: 'planche__numero' }, numero),
        h('span', { class: 'planche__coche' }, '✓'),
        marqueNuancier(p.id));
    }

    if (p.statut === 'en_cours') {
      return h('a', { class: 'planche planche--encours', href: `#/planche/${p.id}` },
        h('span', { class: 'planche__numero' }, numero),
        h('span', { class: 'planche__mention' }, 'en cours'),
        marqueNuancier(p.id));
    }

    return h('a', { class: 'planche', href: `#/planche/${p.id}` },
      h('span', { class: 'planche__numero' }, numero),
      marqueNuancier(p.id));
  }));

  const entete = h('header', { class: 'entete entete--decor' },
    ailes(),
    h('div', { class: 'entete__contenu' },
      h('a', { class: 'retour', href: '#/albums' }, '‹ Ma collection'),
      h('h1', { class: 'titre-album' }, fiche.titre),
      h('div', { class: 'progression' },
        h('div', { class: 'progression__piste' },
          h('div', { class: 'progression__part progression__part--album', style: `width:${total ? faites / total * 100 : 0}%` })),
        h('span', { class: 'progression__compte' }, `${faites} sur ${total}`))));

  const corps = h('div', { class: 'corps corps--grille' },
    h('div', { class: 'grille-planches' }, tuiles));

  const actions = reprise ? h('div', { class: 'actions' },
    h('button', {
      class: 'bouton--habille',
      onclick: async () => {
        await demarrer(reprise.id);
        naviguer(`#/planche/${reprise.id}`);
      }
    }, `${enCours ? 'Reprendre' : 'Commencer'} la planche ${reprise.numero} ✦`)) : null;

  return {
    element: h('div', { class: 'vue' }, entete, corps, actions),
    demonter: () => urls.forEach(URL.revokeObjectURL)
  };
}
