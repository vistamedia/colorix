import { h, degradeCouverture, naviguer, sansAccent } from '../rendu.js';
import { catalogue, possessions, posseder } from '../donnees.js';

function panneauAjout(livre, surAjout) {
  const champ = h('input', {
    type: 'number', inputmode: 'numeric', min: '1', max: '400',
    placeholder: 'nombre de planches', class: 'champ champ--nombre'
  });

  const valider = () => {
    const nombre = parseInt(champ.value, 10);
    if (!nombre || nombre < 1 || nombre > 400) {
      champ.focus();
      return;
    }
    surAjout(nombre);
  };

  const panneau = h('div', { class: 'panneau' },
    h('div', { class: 'panneau__voile', onclick: () => panneau.remove() }),
    h('div', { class: 'panneau__feuille' },
      h('h2', { class: 'panneau__titre' }, livre.titre),
      h('p', { class: 'panneau__note' },
        `Combien de planches à colorier dans ce livre ? Il compte ${livre.nb_pages} pages, `,
        'ce qui ne donne pas le nombre de planches — compte-les et saisis le total.'),
      champ,
      h('div', { class: 'panneau__actions' },
        h('button', { class: 'bouton--secondaire', onclick: () => panneau.remove() }, 'Annuler'),
        h('button', { class: 'bouton bouton--primaire', onclick: valider }, 'Créer les planches'))));

  document.body.append(panneau);
  champ.focus();
}

export async function monter() {
  const [cat, possedes] = await Promise.all([catalogue(), possessions()]);
  const deja = new Set(possedes.map(p => p.livre_id));

  const liste = h('div', { class: 'corps corps--liste' });

  const dessiner = (filtre) => {
    const mots = sansAccent(filtre).split(/\s+/).filter(Boolean);
    const retenus = cat.livres.filter(l => {
      const cible = sansAccent(`${l.titre} ${l.collection} ${l.annee} ${l.auteur || ''}`);
      return mots.every(m => cible.includes(m));
    });

    liste.replaceChildren(...(retenus.length ? retenus.map(l => ligne(l)) : [
      h('p', { class: 'vide' }, h('strong', {}, 'Aucun livre'), 'Essaie un autre mot.')
    ]));
    compteur.textContent = `${retenus.length} livre${retenus.length > 1 ? 's' : ''}`;
  };

  const ligne = (livre) => {
    const possede = deja.has(livre.id);
    const degrade = degradeCouverture(livre.collection, livre.ean13);

    const vignette = h('div', { class: 'vignette', style: `background-image:${degrade}` });
    vignette.append(h('img', { src: livre.couverture, alt: '', loading: 'lazy', onerror: function () { this.remove(); } }));

    return h('button', {
      class: `ligne-catalogue${possede ? ' ligne-catalogue--possede' : ''}`,
      disabled: possede,
      onclick: () => panneauAjout(livre, async (nombre) => {
        await posseder(livre.id, nombre);
        naviguer(`#/album/${livre.id}`);
      })
    },
      vignette,
      h('div', { class: 'ligne-catalogue__texte' },
        h('div', { class: 'ligne-catalogue__titre' }, livre.titre),
        h('div', { class: 'ligne-catalogue__meta' }, `${livre.annee} · ${livre.nb_pages} pages`)),
      h('span', { class: 'ligne-catalogue__marque' }, possede ? '✓' : '＋'));
  };

  const recherche = h('input', {
    type: 'search', class: 'champ', placeholder: 'Chercher un titre, une collection…',
    oninput: (e) => dessiner(e.target.value)
  });
  const compteur = h('span', { class: 'progression__compte' });

  const entete = h('header', { class: 'entete entete--sobre' },
    h('div', { class: 'entete__contenu' },
      h('a', { class: 'retour retour--sombre', href: '#/albums' }, '‹ Ma collection'),
      h('h1', { class: 'titre-album' }, 'Catalogue'),
      recherche,
      compteur));

  dessiner('');
  return { element: h('div', { class: 'vue' }, entete, liste) };
}
